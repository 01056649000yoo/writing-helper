"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveAnswers,
  requestOutline,
  getOutlineSharedQuestionCandidates,
  getStudentRoomQuestions,
  submitHanjaWriting,
  submitOneLineShare,
  submitQuestionGenerator,
  submitQuestionVoting,
} from "@/app/actions/student-actions";
import { getMatchingConfiguredKeywords, normalizeOneLineShareConfig } from "@/lib/one-line-share";
import { normalizeHanjaWritingConfig, sentenceContainsWord } from "@/lib/hanja-writing";
import type {
  ActivityType,
  HanjaWritingConfig,
  OneLineShareConfig,
  QuestionCardSet,
  QuestionGeneratorConfig,
  QuestionGeneratorSubmission,
  QuestionVotingConfig,
} from "@/features/activities/types";
import { isActivityType } from "@/features/activities/types";
import type { OutlineTemplateAnswer, OutlineTemplate } from "@/features/activities/types";
import { getDefaultOutlineTemplate } from "@/lib/outline-templates";
import { StudentSpellingTextarea } from "@/components/student-spelling-textarea";
import { BadgeCircle } from "@/components/badge-circle";
import {
  QUESTION_GENERATOR_MODE_META,
  normalizeQuestionGeneratorConfig,
} from "@/features/activities/question-generator/config";
import {
  getQuestionAreaByCardLabel,
  groupCardSetsByArea,
  type QuestionAreaId,
} from "@/features/activities/question-generator/areas";
import type { QuestionGeneratorMode } from "@/features/activities/types";

type Step =
  | "outline_sections"
  | "question_build"
  | "question_submitting"
  | "question_voting"
  | "one_line_share"
  | "one_line_submitting"
  | "hanja_writing"
  | "hanja_submitting";

type QuestionSelection = QuestionGeneratorSubmission["selections"][number];
type OutlineSectionKey = "처음" | "가운데" | "끝";

type OutlineSharedQuestion = {
  id: string;
  text: string;
  /** 우리 반이 좋은 질문으로 고른 표 수. 투표 전이면 0이다. */
  votes?: number;
};

type OutlineSharedQuestionRoom = {
  roomId: string;
  title: string;
  topic: string;
  createdAt: string;
  isActive: boolean;
  questions: OutlineSharedQuestion[];
};

const SHARED_QUESTION_ITEM_PREFIX = "shared-question:";

/*
 * 개요 임시 저장 — 아지트 학생 글쓰기(`StudentWriting.jsx`)와 **같은 값·같은 자리**를 쓴다(2026-08-24).
 *
 * 예전에는 `개요 완성하기` 를 눌러야 처음 저장됐다. 20분 적다가 태블릿이 꺼지거나 뒤로 가기를 누르면
 * 전부 사라졌다.
 *
 * 저장하는 곳이 둘이다 — 이 단말(`localStorage`)과 서버. 단말 저장은 빠르지만 그 기기에만 남고,
 * 서버 저장은 어디서든 이어 쓸 수 있지만 자주 보내면 한 반 30명이 동시에 몰린다.
 * 그래서 단말은 자주(3초), 서버는 드물게(2분) 저장한다. 아지트와 같은 간격이다.
 *
 * ⚠️ 내용이 그대로면 보내지 않는다. 그래야 가만히 있는 학생이 2분마다 서버를 두드리지 않는다.
 */
const LOCAL_DRAFT_DEBOUNCE_MS = 3000;
const DB_BACKUP_INTERVAL_MS = 120000;
const outlineDraftStorageKey = (sessionId: string) => `writing_helper_outline_draft:${sessionId}`;

/** 카드 묶음 이름을 학생 화면 표기(`상상 카드`)로 맞춘다. */
function buildCardSetLabel(cardSet: QuestionCardSet) {
  const normalized = cardSet.label.trim();
  return normalized.endsWith("카드") ? normalized : `${normalized} 카드`;
}

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const editMode = searchParams.get("edit") === "1";

  const [roomId, setRoomId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [questionGeneratorConfig, setQuestionGeneratorConfig] = useState<QuestionGeneratorConfig | null>(null);
  const [questionVotingConfig, setQuestionVotingConfig] = useState<QuestionVotingConfig | null>(null);
  const [oneLineShareConfig, setOneLineShareConfig] = useState<OneLineShareConfig | null>(null);
  const [hanjaWritingConfig, setHanjaWritingConfig] = useState<HanjaWritingConfig | null>(null);
  const [hanjaContents, setHanjaContents] = useState<string[]>([""]);
  const [step, setStep] = useState<Step | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  // outline_builder 전용 상태
  const [outlineTemplate, setOutlineTemplate] = useState<OutlineTemplate | null>(null);
  // 교사가 `선생님 틀 그대로`를 고르면 항목을 빼거나 더할 수 없다. 옛 방에는 값이 없어 허용이 기본이다.
  const [outlineEditable, setOutlineEditable] = useState(true);
  const [templateAnswers, setTemplateAnswers] = useState<OutlineTemplateAnswer[]>([]);
  // 교사 항목을 빼도 답변은 잠시 보존한다. 실수로 뺐다가 다시 넣으면 작성하던 내용이 돌아온다.
  const [excludedTemplateItemIds, setExcludedTemplateItemIds] = useState<string[]>([]);
  const [outlineSubmitting, setOutlineSubmitting] = useState(false);
  // 끌어서 옮기는 중인 항목. 태블릿에서는 끌기가 어려워 ▲▼ 단추도 함께 둔다.
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  // 자동 저장 시각·수동 저장 확인. 아지트와 같이 자동과 수동을 구분해 보여 준다.
  const [outlineSavedAt, setOutlineSavedAt] = useState<Date | null>(null);
  const [outlineManualSavedAt, setOutlineManualSavedAt] = useState<Date | null>(null);
  const [outlineSaveError, setOutlineSaveError] = useState("");
  const [outlineManualSaving, setOutlineManualSaving] = useState(false);
  const [sharedQuestionPickerSection, setSharedQuestionPickerSection] = useState<OutlineSectionKey | null>(null);
  const [sharedQuestionRooms, setSharedQuestionRooms] = useState<OutlineSharedQuestionRoom[]>([]);
  const [sharedQuestionLoading, setSharedQuestionLoading] = useState(false);
  const [sharedQuestionLoaded, setSharedQuestionLoaded] = useState(false);
  const [sharedQuestionError, setSharedQuestionError] = useState("");
  const [topic, setTopic] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [error, setError] = useState("");
  const [selectedCardSetId, setSelectedCardSetId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [remixedQuestion, setRemixedQuestion] = useState("");
  const [questionSelections, setQuestionSelections] = useState<QuestionSelection[]>([]);
  const [editingSelectionId, setEditingSelectionId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<QuestionAreaId | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(true);
  const [selectedVotingQuestionIds, setSelectedVotingQuestionIds] = useState<string[]>([]);
  const [oneLineContent, setOneLineContent] = useState("");

  const maxSelections = questionGeneratorConfig?.maxSelections ?? 1;
  const questionMode: QuestionGeneratorMode = questionGeneratorConfig?.mode ?? "card_remix";
  const questionModeMeta = QUESTION_GENERATOR_MODE_META[questionMode];

  const enabledCardSets = useMemo(() => {
    const allowedIds = new Set(questionGeneratorConfig?.enabledCardSetIds ?? []);
    const source = allowedIds.size > 0
      ? (questionGeneratorConfig?.cardSets ?? []).filter((cardSet) => allowedIds.has(cardSet.id))
      : (questionGeneratorConfig?.cardSets ?? []);
    return source;
  }, [questionGeneratorConfig]);

  const selectedCardSet = useMemo(
    () => enabledCardSets.find((cardSet) => cardSet.id === selectedCardSetId) ?? null,
    [enabledCardSets, selectedCardSetId]
  );
  // 선생님이 고른 카드 묶음을 **큰 카테고리**로 묶는다(상상·반전, 마음·가치 …).
  // 2026-08-19에 역할(탐정 모드·상담사 모드)을 걷어내고 카테고리로 바꿨다.
  const availableAreas = useMemo(() => groupCardSetsByArea(enabledCardSets), [enabledCardSets]);
  const selectedArea = useMemo(
    () => availableAreas.find((entry) => entry.area.id === selectedAreaId) ?? null,
    [availableAreas, selectedAreaId]
  );
  // 카드 방식은 "카테고리 → 그 안의 카드 묶음"으로 좁히고, 선생님 추천 질문은 바로 카드를 고른다.
  const areaCardSets = useMemo(() => {
    if (questionMode !== "card_remix") return enabledCardSets;
    return selectedArea?.cardSets ?? [];
  }, [enabledCardSets, questionMode, selectedArea]);
  const activeCardSet = useMemo(() => {
    if (questionMode === "card_remix" && !selectedArea) return null;
    return areaCardSets.find((cardSet) => buildCardSetLabel(cardSet) === selectedCategoryLabel) ?? areaCardSets[0] ?? null;
  }, [areaCardSets, questionMode, selectedArea, selectedCategoryLabel]);
  const activeCategoryLabel = activeCardSet ? buildCardSetLabel(activeCardSet) : null;
  const filteredPrompts = useMemo(() => {
    const promptSource = activeCardSet ?? selectedCardSet;
    if (!promptSource) return [];
    const query = promptSearch.trim().toLowerCase();
    if (!query) return promptSource.prompts;
    return promptSource.prompts.filter((prompt) => prompt.toLowerCase().includes(query));
  }, [activeCardSet, promptSearch, selectedCardSet]);

  const votingMaxSelections = questionVotingConfig?.maxSelections ?? 1;

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  useEffect(() => {
    if (!roomId) return;

    if (!sessionId) {
      startTransition(() => {
        setError("학생 세션 정보를 찾지 못했습니다. 입장 화면에서 다시 시도해주세요.");
        setPageLoading(false);
      });
      return;
    }

    let active = true;
    startTransition(() => setPageLoading(true));

    getStudentRoomQuestions(sessionId, roomId).then((data) => {
      if (!active) return;

      if (!data) {
        setError("학생 세션을 확인하지 못했습니다. 입장 화면에서 다시 시도해주세요.");
        setPageLoading(false);
        return;
      }

      setTopic(data.topic ?? "");
      setTopicDescription(typeof data.topic_description === "string" ? data.topic_description : "");

      const type = data.activity_type ?? "outline_builder";
      if (!isActivityType(type)) {
        setError("이 활동은 현재 지원하지 않습니다. 선생님께 새 활동을 만들어 달라고 요청해주세요.");
        setActivityType(null);
        setPageLoading(false);
        return;
      }
      setActivityType(type);

      if (type === "question_generator") {
        setQuestionGeneratorConfig(normalizeQuestionGeneratorConfig(data.activity_config));
        const existingSubmission = data.existing_submission as QuestionGeneratorSubmission | null;
        // 화면이 하나라 처음 들어와도, 고치러 다시 들어와도 같은 곳에서 이어 한다.
        setQuestionSelections(existingSubmission?.selections ?? []);
        setStep("question_build");
      } else if (type === "question_voting") {
        const votingConfig = normalizeQuestionVotingConfig(data.activity_config);
        setQuestionVotingConfig(votingConfig);
        const existingVotingSubmission = data.existing_voting_submission;
        if (existingVotingSubmission?.selectedQuestionIds?.length) {
          const allowedIds = new Set(votingConfig.sourceQuestions.map((question) => question.id));
          setSelectedVotingQuestionIds(
            existingVotingSubmission.selectedQuestionIds.filter((questionId) => allowedIds.has(questionId))
          );
        }
        setStep("question_voting");
      } else if (type === "one_line_share") {
        setOneLineShareConfig(normalizeOneLineShareConfig(data.activity_config));
        setOneLineContent(data.existing_one_line_submission?.content ?? "");
        setStep("one_line_share");
      } else if (type === "hanja_writing") {
        const config = normalizeHanjaWritingConfig(data.activity_config);
        setHanjaWritingConfig(config);
        const existingHanja = data.existing_hanja_writing_submission as { contents?: string[] } | null;
        const nextCount = config?.sentenceCount ?? 1;
        const nextContents = Array.from({ length: nextCount }, (_, index) => existingHanja?.contents?.[index] ?? "");
        setHanjaContents(nextContents);
        setStep("hanja_writing");
      } else {
        // outline_builder
        const config = data.activity_config as Record<string, unknown> | null;
        const subjectType = (config?.subjectType as import("@/types").SubjectType | undefined) ?? "생활문";
        const template = data.outline_template ?? getDefaultOutlineTemplate(subjectType);
        const editable = config?.studentEditable !== false;
        setOutlineTemplate(template);
        setOutlineEditable(editable);
        const savedAnswers = (data.existing_outline_answers ?? []) as OutlineTemplateAnswer[];
        const savedByItemId = new Map(savedAnswers.map((answer) => [answer.itemId, answer]));
        const teacherItemIds = new Set(template.sections.flatMap((section) => section.items.map((item) => item.id)));
        const teacherAnswers = template.sections.flatMap((section) => section.items.map((item) => (
          savedByItemId.get(item.id) ?? {
            section: section.key,
            itemId: item.id,
            label: item.label,
            answer: "",
          }
        )));
        const studentAddedAnswers = savedAnswers.filter((answer) => !teacherItemIds.has(answer.itemId));
        const hasSavedSelection = savedAnswers.length > 0 || data.session_status === "done";

        // 새 활동은 교사가 제시한 항목을 모두 펼친 채 시작한다. 완성본을 고치러 왔을 때는
        // 저장 결과에 없던 교사 항목을 학생이 전에 뺀 것으로 복원해 같은 선택을 유지한다.
        //
        // ⚠️ 학생이 갈래 안에서 순서를 바꿀 수 있으므로(2026-08-24) **저장된 순서를 그대로 이어야
        //    한다**. 교사 틀 순서로 다시 세우면 다음에 들어왔을 때 학생이 옮긴 순서가 사라진다.
        //    저장본에 없던 항목(학생이 뺐던 교사 항목)은 뒤로 보낸다 — 정렬이 안정적이라
        //    저장본이 없을 때는 교사 틀 순서가 그대로 남는다.
        const savedOrder = new Map(savedAnswers.map((answer, index) => [answer.itemId, index]));
        const orderedAnswers = [...teacherAnswers, ...studentAddedAnswers].sort((left, right) => (
          (savedOrder.get(left.itemId) ?? Number.MAX_SAFE_INTEGER)
          - (savedOrder.get(right.itemId) ?? Number.MAX_SAFE_INTEGER)
        ));
        /*
         * 이 단말에 서버보다 **새로운** 임시본이 있으면 그것으로 잇는다.
         * 서버 저장은 2분 간격이라, 그 사이에 화면이 꺼졌다면 단말 쪽이 최신이다.
         * ⚠️ 무조건 단말을 우선하면 다른 기기에서 이어 쓴 내용을 덮어쓴다. 시각을 비교해야 한다.
         */
        const serverSavedAt = typeof data.existing_answers_saved_at === "string"
          ? Date.parse(data.existing_answers_saved_at)
          : 0;
        let restored = orderedAnswers;
        try {
          const raw = window.localStorage.getItem(outlineDraftStorageKey(sessionId));
          const localDraft = raw ? JSON.parse(raw) : null;
          const localSavedAt = localDraft?.savedAt ? Date.parse(localDraft.savedAt) : 0;
          if (Array.isArray(localDraft?.answers) && localDraft.answers.length > 0
              && localSavedAt > serverSavedAt) {
            restored = localDraft.answers as OutlineTemplateAnswer[];
            setOutlineSavedAt(new Date(localSavedAt));
          } else if (serverSavedAt > 0 && savedAnswers.length > 0) {
            setOutlineSavedAt(new Date(serverSavedAt));
          }
        } catch {
          // 임시본을 못 읽어도 서버 저장본으로 이어 쓸 수 있다. 화면은 그대로 진행한다.
        }
        setTemplateAnswers(restored);
        setExcludedTemplateItemIds(editable && hasSavedSelection
          ? teacherAnswers.filter((answer) => !savedByItemId.has(answer.itemId)).map((answer) => answer.itemId)
          : []);
        setStep("outline_sections");
      }
      setPageLoading(false);
    });

    return () => {
      active = false;
    };
  }, [editMode, roomId, sessionId]);

  /*
   * 임시 저장에 담을 항목을 만든다.
   *
   * ⚠️ **제출과 달리 빈 항목도 담는다.** 제출은 `label && answer` 가 있는 것만 보내는데, 그 목록을
   *    임시 저장에 그대로 쓰면 아직 안 쓴 교사 항목이 저장본에서 빠진다. 다시 들어올 때 저장본에
   *    없는 교사 항목은 **학생이 뺀 것**으로 되살아나므로, 반쯤 쓰다 만 개요에서 안 쓴 항목이
   *    통째로 `뺀 항목` 으로 사라진다. 그래서 뺀 것만 걸러 내고 나머지는 모두 담는다.
   */
  const buildOutlineDraftAnswers = useCallback(() => {
    const excluded = new Set(excludedTemplateItemIds);
    return templateAnswers
      .filter((answer) => !excluded.has(answer.itemId))
      .map((answer) => ({ ...answer, label: answer.label.trim(), answer: answer.answer.trim() }));
  }, [excludedTemplateItemIds, templateAnswers]);

  const outlineDraftRef = useRef<OutlineTemplateAnswer[]>([]);
  const lastLocalDraftRef = useRef<string | null>(null);
  const lastServerDraftRef = useRef<string | null>(null);
  const serverSavingRef = useRef(false);
  const outlineDraftStateRef = useRef({ sessionId: "", step, outlineSubmitting });

  outlineDraftRef.current = buildOutlineDraftAnswers();
  outlineDraftStateRef.current = { sessionId, step, outlineSubmitting };

  /** 이 단말에만 남긴다. 빠르지만 다른 기기에서는 보이지 않는다. */
  const saveLocalOutlineDraft = useCallback(() => {
    const { sessionId: id, step: currentStep } = outlineDraftStateRef.current;
    if (!id || currentStep !== "outline_sections") return;

    const answers = outlineDraftRef.current;
    const snapshot = JSON.stringify(answers);
    if (answers.length === 0 || snapshot === lastLocalDraftRef.current) return;

    try {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(outlineDraftStorageKey(id), JSON.stringify({ savedAt, answers }));
      lastLocalDraftRef.current = snapshot;
      setOutlineSavedAt(new Date(savedAt));
      setOutlineSaveError("");
    } catch {
      setOutlineSaveError("이 단말의 임시저장 공간이 부족해요. 선생님께 알려 주세요.");
    }
  }, []);

  /** 서버에 남긴다. 다른 기기에서도 이어 쓸 수 있지만 자주 보내지 않는다. */
  const backupOutlineDraftToServer = useCallback(async () => {
    const { sessionId: id, step: currentStep, outlineSubmitting: submitting } = outlineDraftStateRef.current;
    if (!id || currentStep !== "outline_sections" || submitting || serverSavingRef.current) return;

    const answers = outlineDraftRef.current;
    const snapshot = JSON.stringify(answers);
    if (answers.length === 0 || snapshot === lastServerDraftRef.current) return;

    serverSavingRef.current = true;
    try {
      const result = await saveAnswers(id, answers);
      if (!result.error) {
        lastServerDraftRef.current = snapshot;
        setOutlineSavedAt(new Date());
        setOutlineSaveError("");
      }
    } finally {
      serverSavingRef.current = false;
    }
  }, []);

  /** 학생이 `임시 저장` 을 직접 눌렀을 때. 단말과 서버에 한꺼번에 남기고 눈에 보이게 알린다. */
  async function handleOutlineManualSave() {
    if (outlineManualSaving) return;
    const answers = outlineDraftRef.current;
    if (answers.length === 0) {
      setOutlineSaveError("아직 적은 것이 없어요.");
      return;
    }

    setOutlineManualSaving(true);
    try {
      const result = await saveAnswers(sessionId, answers);
      if (result.error) {
        setOutlineSaveError(result.error);
        return;
      }
      lastServerDraftRef.current = JSON.stringify(answers);
      saveLocalOutlineDraft();
      setOutlineSavedAt(new Date());
      setOutlineSaveError("");
      // 화면 안에서 잠깐만 알린다. 키보드를 닫지 않아 학생이 바로 이어 쓸 수 있다.
      setOutlineManualSavedAt(new Date());
      window.setTimeout(() => setOutlineManualSavedAt(null), 4000);
    } finally {
      setOutlineManualSaving(false);
    }
  }

  /* 단말 저장 — 손을 멈추면 3초 뒤에 조용히 남긴다. */
  useEffect(() => {
    if (step !== "outline_sections") return undefined;
    const timer = window.setTimeout(() => saveLocalOutlineDraft(), LOCAL_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [templateAnswers, excludedTemplateItemIds, step, saveLocalOutlineDraft]);

  /* 서버 저장 — 2분마다. 내용이 그대로면 보내지 않는다. */
  useEffect(() => {
    if (step !== "outline_sections") return undefined;
    const timer = window.setInterval(() => {
      saveLocalOutlineDraft();
      void backupOutlineDraftToServer();
    }, DB_BACKUP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [step, saveLocalOutlineDraft, backupOutlineDraftToServer]);

  /*
   * 화면을 덮거나 떠날 때 마지막으로 한 번 남긴다.
   * ⚠️ 여기가 없으면 "쓰다가 홈 버튼을 눌렀다"가 그대로 유실이 된다. 태블릿에서 가장 흔한 경우다.
   */
  useEffect(() => {
    const flush = () => {
      if (outlineDraftStateRef.current.step !== "outline_sections") return;
      saveLocalOutlineDraft();
      void backupOutlineDraftToServer();
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saveLocalOutlineDraft, backupOutlineDraftToServer]);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-xl font-bold text-gray-800">활동을 준비하고 있어요</h1>
          <p className="text-sm text-gray-500 mt-3">학생 정보를 확인한 뒤 알맞은 활동 화면으로 이동합니다.</p>
        </div>
      </div>
    );
  }

  if (error && (!activityType || !step)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800">학생 참여를 이어갈 수 없어요</h1>
          <p className="text-sm text-red-500 mt-3 whitespace-pre-line">{error}</p>
          <button
            onClick={() => router.push(`/room/${roomId}`)}
            className="w-full mt-6 py-4 bg-slate-700 text-white rounded-2xl font-bold text-base hover:bg-slate-800 transition-colors"
          >
            입장 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  function handleTemplateAnswerChange(itemId: string, value: string) {
    setTemplateAnswers((prev) => {
      if (prev.some((a) => a.itemId === itemId)) {
        return prev.map((a) => a.itemId === itemId ? { ...a, answer: value } : a);
      }
      // 과거 저장본처럼 상태에 아직 없는 교사 항목도 처음 적을 때 안전하게 만들어 준다.
      const found = (outlineTemplate?.sections ?? []).flatMap((section) => (
        section.items.map((item) => ({ section: section.key, item }))
      )).find((entry) => entry.item.id === itemId);
      if (!found) return prev;
      return [...prev, { section: found.section, itemId, label: found.item.label, answer: value }];
    });
  }

  function handleTemplateLabelChange(itemId: string, value: string) {
    setTemplateAnswers((prev) =>
      prev.map((a) => a.itemId === itemId ? { ...a, label: value } : a)
    );
  }

  function excludeTemplateItem(itemId: string) {
    setExcludedTemplateItemIds((prev) => prev.includes(itemId) ? prev : [...prev, itemId]);
  }

  function restoreTemplateItem(item: { id: string; label: string }, section: OutlineSectionKey) {
    setExcludedTemplateItemIds((prev) => prev.filter((itemId) => itemId !== item.id));
    setTemplateAnswers((prev) => prev.some((answer) => answer.itemId === item.id)
      ? prev
      : [...prev, { section, itemId: item.id, label: item.label, answer: "" }]);
  }

  function addCustomTemplateItem(section: "처음" | "가운데" | "끝") {
    const itemId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTemplateAnswers((prev) => [...prev, { section, itemId, label: "", answer: "" }]);
  }

  /*
   * 갈래(처음·가운데·끝) 안에서 항목 순서를 바꾼다(2026-08-24 요청).
   *
   * 불러온 질문이 늘 갈래 맨 뒤에 붙어, 하고 싶은 자리에 둘 수 없었다.
   *
   * ⚠️ 순서의 원본은 `templateAnswers` 배열 **하나**다. 화면이 교사 항목과 학생 항목을 각각
   *    다른 곳에서 순서를 받아 그리면, 옮겨도 화면이 안 따라오거나 저장된 순서와 어긋난다.
   * ⚠️ 뺀 항목은 화면에 없다. 화면에 보이는 것끼리 자리를 바꿔야 학생 눈에 한 칸씩 움직인다.
   *    그래서 전체 배열이 아니라 **보이는 항목만** 골라 그 안에서 자리를 맞바꾼다.
   */
  function moveTemplateItem(itemId: string, direction: -1 | 1) {
    setTemplateAnswers((prev) => {
      const current = prev.find((answer) => answer.itemId === itemId);
      if (!current) return prev;

      const excluded = new Set(excludedTemplateItemIds);
      const visibleIndexes = prev
        .map((answer, index) => ({ answer, index }))
        .filter(({ answer }) => answer.section === current.section && !excluded.has(answer.itemId))
        .map(({ index }) => index);

      const at = visibleIndexes.indexOf(prev.indexOf(current));
      const target = visibleIndexes[at + direction];
      if (at < 0 || target === undefined) return prev;

      const next = [...prev];
      const from = visibleIndexes[at];
      [next[from], next[target]] = [next[target], next[from]];
      return next;
    });
  }

  /** 끌어서 놓기로 옮길 때, 놓은 자리 **앞**에 끼워 넣는다(자리 맞바꾸기가 아니다). */
  function dropTemplateItem(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    setTemplateAnswers((prev) => {
      const from = prev.findIndex((answer) => answer.itemId === draggedId);
      const to = prev.findIndex((answer) => answer.itemId === targetId);
      if (from < 0 || to < 0) return prev;
      // 갈래를 넘어가는 이동은 하지 않는다. 처음·가운데·끝은 글의 구조라 뜻이 달라진다.
      if (prev[from].section !== prev[to].section) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(next.findIndex((answer) => answer.itemId === targetId), 0, moved);
      return next;
    });
  }

  function buildSharedQuestionItemId(
    section: OutlineSectionKey,
    sourceRoomId: string,
    questionId: string,
  ) {
    return `${SHARED_QUESTION_ITEM_PREFIX}${sourceRoomId}:${questionId}:${section}`;
  }

  async function openSharedQuestionPicker(section: OutlineSectionKey) {
    setSharedQuestionPickerSection(section);
    setSharedQuestionError("");
    if (sharedQuestionLoading) return;

    setSharedQuestionLoaded(false);
    setSharedQuestionLoading(true);
    const result = await getOutlineSharedQuestionCandidates(sessionId, roomId);
    if (result.error) {
      setSharedQuestionError(result.error);
    } else {
      setSharedQuestionRooms(result.rooms as OutlineSharedQuestionRoom[]);
      setSharedQuestionLoaded(true);
    }
    setSharedQuestionLoading(false);
  }

  function addSharedQuestionTemplateItem(
    section: OutlineSectionKey,
    sourceRoomId: string,
    question: OutlineSharedQuestion,
  ) {
    const itemId = buildSharedQuestionItemId(section, sourceRoomId, question.id);
    setTemplateAnswers((prev) => prev.some((answer) => answer.itemId === itemId)
      ? prev
      : [...prev, { section, itemId, label: question.text, answer: "" }]);
    setSharedQuestionPickerSection(null);
  }

  function removeTemplateItem(itemId: string) {
    setTemplateAnswers((prev) => prev.filter((a) => a.itemId !== itemId));
  }

  async function handleOutlineSectionSubmit() {
    if (outlineSubmitting) return;
    setError("");

    const excludedItemIds = new Set(excludedTemplateItemIds);
    const submittable = templateAnswers
      .filter((answer) => !excludedItemIds.has(answer.itemId))
      .map((a) => ({ ...a, label: a.label.trim(), answer: a.answer.trim() }))
      .filter((a) => a.label && a.answer);

    if (submittable.length === 0) {
      setError("적은 항목이 없어요. 한 가지 이상 골라서 써 보세요.");
      return;
    }

    setOutlineSubmitting(true);

    const saveResult = await saveAnswers(sessionId, submittable);
    if (saveResult.error) {
      setError(saveResult.error);
      setOutlineSubmitting(false);
      return;
    }

    const result = await requestOutline(sessionId, submittable);
    if (result.error) {
      setError(result.error);
      setOutlineSubmitting(false);
      return;
    }
    // 완성했으면 이 단말의 임시본을 지운다. 남겨 두면 다시 들어올 때 낡은 것이 되살아난다.
    try {
      window.localStorage.removeItem(outlineDraftStorageKey(sessionId));
    } catch {
      // 못 지워도 서버 저장본이 더 새것이라 복원에서 밀린다.
    }
    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  /**
   * 질문 카드를 누르면 곧바로 오른쪽 입력창 옆에 붙는다 — 화면을 넘기지 않는다.
   * 카드는 대부분 "~ 질문을 만들어 보세요" 같은 **관점 안내**라 그대로 옮겨 적을 것이 아니다.
   * 물음표로 끝나는 완성된 질문일 때만 입력창에 담아 고쳐 쓰게 한다.
   */
  function selectQuestionPrompt(prompt: string, cardSet: QuestionCardSet | null) {
    const source = cardSet ?? activeCardSet;
    if (!source) return;
    setSelectedCardSetId(source.id);
    setSelectedPrompt(prompt);
    setRemixedQuestion(/[?？]\s*$/.test(prompt) ? prompt : "");
    setError("");
  }

  /** 입력창을 비운다(카테고리 선택은 그대로 두어 다음 질문을 바로 고를 수 있게 한다). */
  function clearQuestionEditor() {
    setEditingSelectionId(null);
    setSelectedCardSetId(null);
    setSelectedPrompt(null);
    setRemixedQuestion("");
    setError("");
  }

  /** 쓴 질문을 목록에 담는다. 저장해도 화면은 그대로다. */
  function saveQuestionSelection() {
    const normalizedQuestion = remixedQuestion.trim();
    if (!normalizedQuestion) {
      setError("오늘 주제에 맞게 바꾼 질문을 적어주세요.");
      return;
    }

    if (!editingSelectionId && questionSelections.length >= maxSelections) {
      setError(`질문을 이미 ${maxSelections}개 담았어요. 오른쪽 목록에서 질문을 눌러 고쳐 보세요.`);
      return;
    }

    const isDirect = questionMode === "direct";
    const selection: QuestionSelection = {
      id: editingSelectionId ?? `selection-${Date.now()}`,
      method: isDirect ? "direct" : "card_remix",
      cardSetId: isDirect ? "custom" : selectedCardSet?.id ?? "custom",
      cardSetLabel: isDirect
        ? "직접 질문 만들기"
        : selectedCardSet?.label ?? "직접 쓴 질문",
      originalPrompt: isDirect ? null : selectedPrompt,
      remixedQuestion: normalizedQuestion,
    };

    setQuestionSelections((prev) => (
      editingSelectionId
        ? prev.map((current) => (current.id === editingSelectionId ? selection : current))
        : [...prev, selection]
    ));
    clearQuestionEditor();
  }

  /** 담은 질문을 모두 제출한다. 제출 뒤에도 결과 화면에서 다시 고칠 수 있다. */
  async function submitQuestionSelections() {
    const pending = remixedQuestion.trim();
    // 쓰다 만 질문이 있으면 먼저 담아 준다 — 눌렀는데 사라지는 일이 없게.
    let nextSelections = questionSelections;
    if (pending) {
      const isDirect = questionMode === "direct";
      const selection: QuestionSelection = {
        id: editingSelectionId ?? `selection-${Date.now()}`,
        method: isDirect ? "direct" : "card_remix",
        cardSetId: isDirect ? "custom" : selectedCardSet?.id ?? "custom",
        cardSetLabel: isDirect ? "직접 질문 만들기" : selectedCardSet?.label ?? "직접 쓴 질문",
        originalPrompt: isDirect ? null : selectedPrompt,
        remixedQuestion: pending,
      };
      nextSelections = editingSelectionId
        ? questionSelections.map((current) => (current.id === editingSelectionId ? selection : current))
        : [...questionSelections, selection].slice(0, maxSelections);
    }

    if (nextSelections.length === 0) {
      setError("질문을 한 개 이상 만들어 주세요.");
      return;
    }

    setQuestionSelections(nextSelections);
    clearQuestionEditor();
    setStep("question_submitting");

    const result = await submitQuestionGenerator(sessionId, roomId, { selections: nextSelections });
    if (result.error) {
      setError(result.error);
      setStep("question_build");
      return;
    }

    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  function removeQuestionSelection(selectionId: string) {
    if (editingSelectionId === selectionId) clearQuestionEditor();
    setQuestionSelections((prev) => prev.filter((selection) => selection.id !== selectionId));
  }

  /** 담은 질문을 눌러 바로 고친다 — 화면을 넘기지 않고 입력창에 불러온다. */
  function editQuestionSelection(selection: QuestionSelection) {
    const selectedCard = enabledCardSets.find((cardSet) => cardSet.id === selection.cardSetId) ?? null;

    setEditingSelectionId(selection.id);
    setSelectedCardSetId(selection.cardSetId === "custom" ? null : selection.cardSetId);
    setSelectedPrompt(selection.originalPrompt);
    setRemixedQuestion(selection.remixedQuestion);
    if (selectedCard) {
      setSelectedAreaId(getQuestionAreaByCardLabel(selectedCard.label).id);
      setSelectedCategoryLabel(buildCardSetLabel(selectedCard));
    }
    setError("");
  }

  if (activityType === "question_generator") {
    if (step === "question_build") {
      const showPicker = questionMode !== "direct";
      const isTeacherPool = questionMode === "ai_custom";
      const filled = questionSelections.length >= maxSelections;
      const canPickMore = !filled || Boolean(editingSelectionId);

      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-4">
            {/* 머리말 — 어느 단계인지가 아니라 몇 개 담았는지를 보여 준다(화면이 하나뿐이다). */}
            <div className="rounded-3xl bg-white p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{questionModeMeta.icon}</span>
                  <div>
                    <h1 className="text-xl font-bold text-gray-800">질문 만들기</h1>
                    <p className="text-sm text-sky-600 font-semibold">{questionModeMeta.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {Array.from({ length: maxSelections }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-10 rounded-full ${index < questionSelections.length ? "bg-sky-500" : "bg-sky-100"}`}
                    />
                  ))}
                  <span className="ml-1 rounded-2xl bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
                    {questionSelections.length} / {maxSelections}개
                  </span>
                </div>
              </div>
            </div>

            {/* 오늘의 미션 — 접었다 펼 수 있게 두어 첫 화면을 따로 두지 않는다. */}
            <div className="rounded-3xl bg-white p-5 shadow-lg">
              <button
                type="button"
                onClick={() => setGuideOpen((open) => !open)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
                  <p className="mt-1 text-xl font-bold leading-snug text-sky-950">{topic}</p>
                </div>
                <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
                  {guideOpen ? "안내 접기" : "안내 보기"}
                </span>
              </button>
              {guideOpen && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {topicDescription && (
                    <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-100 px-4 py-4">
                      <p className="text-xs font-semibold text-sky-700">선생님 설명</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-sky-950">{topicDescription}</p>
                    </div>
                  )}
                  <div className="rounded-2xl bg-gray-50 px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500">이렇게 해요</p>
                    <p className="mt-2 text-sm leading-7 text-gray-700">
                      {questionGeneratorConfig?.guidance || questionModeMeta.studentHint}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 본문 — 왼쪽에서 고르고 오른쪽에서 바로 쓴다. 화면을 넘기지 않는다. */}
            <div className={`grid gap-4 ${showPicker ? "lg:grid-cols-2" : ""}`}>
              {showPicker && (
                <div className="rounded-3xl bg-white p-5 shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-gray-800">
                      {isTeacherPool ? "선생님이 준비한 질문" : "질문 고르기"}
                    </h2>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                      {filteredPrompts.length}개
                    </span>
                  </div>

                  {!isTeacherPool && (
                    <>
                      <p className="mt-1 text-xs text-gray-500">질문의 종류를 고르면 그 안의 질문 카드만 보여드려요.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {availableAreas.map(({ area, promptCount }) => {
                          const selected = selectedAreaId === area.id;
                          return (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() => {
                                setSelectedAreaId(area.id);
                                setSelectedCategoryLabel(null);
                                setPromptSearch("");
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                                selected ? area.badge : `${area.chip.bg} ${area.chip.text} ${area.chip.border} border`
                              }`}
                            >
                              <span>{area.emoji}</span>
                              <span>{area.label}</span>
                              <span className={`text-xs ${selected ? "text-white/80" : "opacity-60"}`}>{promptCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {(isTeacherPool || selectedArea) && (
                    <>
                      {areaCardSets.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                          {areaCardSets.map((cardSet) => {
                            const label = buildCardSetLabel(cardSet);
                            const selected = activeCategoryLabel === label;
                            return (
                              <button
                                key={cardSet.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryLabel(label);
                                  setPromptSearch("");
                                }}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  selected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <input
                        value={promptSearch}
                        onChange={(event) => setPromptSearch(event.target.value)}
                        placeholder="질문 속 낱말로 찾아보기"
                        className="mt-3 w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none"
                      />

                      <div className="mt-3 space-y-2 lg:max-h-[420px] lg:overflow-y-auto lg:pr-1">
                        {filteredPrompts.map((prompt, index) => {
                          const selected = selectedPrompt === prompt;
                          return (
                            <button
                              key={`${activeCardSet?.id ?? "cards"}-${index}-${prompt}`}
                              type="button"
                              aria-pressed={selected}
                              disabled={!canPickMore}
                              onClick={() => selectQuestionPrompt(prompt, activeCardSet)}
                              className={`w-full rounded-2xl border-2 p-4 text-left transition-all disabled:opacity-40 ${
                                selected
                                  ? "border-sky-500 bg-sky-50"
                                  : "border-gray-200 bg-gray-50 hover:border-sky-300 hover:bg-sky-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="leading-relaxed text-gray-800">{prompt}</p>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                                  selected ? "bg-sky-600 text-white" : "bg-white text-gray-500"
                                }`}>
                                  {selected ? "고름" : "고르기"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        {filteredPrompts.length === 0 && (
                          <p className="rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                            찾는 질문이 없어요. 검색어를 지우거나 다른 종류를 골라 보세요.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {!isTeacherPool && !selectedArea && (
                    <p className="mt-4 rounded-2xl bg-gray-50 p-6 text-center text-sm text-gray-500">
                      위에서 질문의 종류를 골라 주세요.
                    </p>
                  )}
                </div>
              )}

              {/* 오른쪽 — 쓰는 곳. 고른 질문이 여기에 담긴다. */}
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-gray-800">
                      {editingSelectionId ? "담은 질문 고치기" : "내 질문 쓰기"}
                    </h2>
                    {selectedCardSet && (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                        {buildCardSetLabel(selectedCardSet)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    {questionMode === "direct"
                      ? "오늘 주제를 보고 내가 궁금한 것을 질문으로 써 보세요."
                      : "왼쪽 카드는 질문을 만드는 힌트예요. 카드를 보고 내 질문을 물음표로 끝나게 써 보세요."}
                  </p>

                  {selectedPrompt && (
                    <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700">고른 질문 카드</p>
                      <p className="mt-1 text-sm leading-relaxed text-amber-900">{selectedPrompt}</p>
                    </div>
                  )}

                  <div className="mt-3">
                    <StudentSpellingTextarea
                      value={remixedQuestion}
                      onValueChange={setRemixedQuestion}
                      rows={6}
                      placeholder={questionMode === "direct"
                        ? "예) 만약 내가 그때 그곳에 있었다면 무엇을 했을까?"
                        : "예) 주인공은 그때 왜 아무 말도 하지 않았을까?"}
                      className="w-full min-h-[180px] rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg leading-8 text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none resize-y"
                    />
                  </div>

                  {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

                  <div className="mt-3 flex gap-2">
                    {(editingSelectionId || remixedQuestion.trim()) && (
                      <button
                        type="button"
                        onClick={clearQuestionEditor}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50"
                      >
                        지우기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveQuestionSelection}
                      disabled={!remixedQuestion.trim()}
                      className="flex-1 rounded-2xl bg-sky-500 py-3 text-base font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-40"
                    >
                      {editingSelectionId
                        ? "고친 내용 담기"
                        : questionSelections.length + 1 < maxSelections
                          ? "이 질문 담기"
                          : "이 질문 담기 (마지막)"}
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-gray-800">담은 질문</h2>
                    <span className="text-xs font-semibold text-sky-600">
                      {questionSelections.length > 0 ? "누르면 고칠 수 있어요" : `${maxSelections}개까지 담을 수 있어요`}
                    </span>
                  </div>

                  {questionSelections.length === 0 ? (
                    <p className="mt-3 rounded-2xl bg-gray-50 p-5 text-center text-sm text-gray-500">
                      아직 담은 질문이 없어요.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {questionSelections.map((selection, index) => {
                        const editing = editingSelectionId === selection.id;
                        return (
                          <div
                            key={selection.id}
                            className={`rounded-2xl p-3 transition-colors ${editing ? "bg-sky-100 ring-2 ring-sky-300" : "bg-sky-50"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => editQuestionSelection(selection)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="text-xs font-semibold text-sky-700">
                                  {index + 1}. {selection.cardSetLabel}
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-gray-800">{selection.remixedQuestion}</p>
                              </button>
                              <div className="flex shrink-0 flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => editQuestionSelection(selection)}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeQuestionSelection(selection.id)}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submitQuestionSelections}
                    disabled={questionSelections.length === 0 && !remixedQuestion.trim()}
                    className="mt-4 w-full rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
                  >
                    제출하기
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-400">제출한 뒤에도 결과 화면에서 다시 고칠 수 있어요.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
            <div className="text-6xl mb-6 animate-bounce">📝</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">질문을 정리하고 있어요</h1>
            <p className="text-gray-500 text-sm">선생님이 바로 볼 수 있게 제출 중이에요.</p>
          </div>
        </div>
      );
    }
  }

  if (activityType === "question_voting") {
    const votingQuestions = questionVotingConfig?.sourceQuestions ?? [];
    const selectedCount = selectedVotingQuestionIds.length;

    async function handleQuestionVotingSubmit() {
      setError("");

      if (selectedVotingQuestionIds.length === 0) {
        setError("좋은 질문을 1개 이상 골라주세요.");
        return;
      }

      setStep("question_submitting");
      const result = await submitQuestionVoting(sessionId, roomId, {
        selectedQuestionIds: selectedVotingQuestionIds,
      });

      if (result.error) {
        setError(result.error);
        setStep("question_voting");
        return;
      }

      router.push(`/room/${roomId}/result?session=${sessionId}`);
    }

    function toggleVotingQuestion(questionId: string) {
      setSelectedVotingQuestionIds((prev) => {
        if (prev.includes(questionId)) {
          return prev.filter((currentId) => currentId !== questionId);
        }

        if (prev.length >= votingMaxSelections) {
          const confirmMessage = votingMaxSelections === 1
            ? "선택한 질문을 이 질문으로 바꿀까요?"
            : `이미 ${votingMaxSelections}개를 골랐어요. 가장 먼저 고른 질문 대신 이 질문으로 바꿀까요?`;
          if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
            return prev;
          }
          return [...prev.slice(1), questionId];
        }

        return [...prev, questionId];
      });
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
        <div className="max-w-3xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-3">🗳️</div>
            <h1 className="text-2xl font-bold text-gray-800">좋은 질문 고르기</h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              친구들이 만든 질문을 익명으로 읽고, 오늘 기준에 맞는 좋은 질문을 골라봐요.
            </p>
            <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">
              오늘 주제: <strong>{topic}</strong>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">좋은 질문의 기준</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">이 기준을 생각하며 질문을 읽어봐요</h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                {selectedCount} / {votingMaxSelections} 선택
              </span>
            </div>

            {(questionVotingConfig?.evaluationCriteria?.length ?? 0) > 0 ? (
              <div className="grid gap-2">
                {questionVotingConfig?.evaluationCriteria.map((criterion, index) => (
                  <div key={`${criterion}-${index}`} className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    {index + 1}. {criterion}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-violet-50 px-4 py-4 text-sm text-violet-700">
                여러 가지 생각이 이어지는 질문인지, 친구가 더 말해보고 싶어지는 질문인지 떠올리며 골라봐요.
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">익명 질문 목록</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">친구들이 만든 질문</h2>
              </div>
              <p className="text-xs text-gray-400">작성자는 보이지 않아요</p>
            </div>

            {votingQuestions.length === 0 ? (
              <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
                평가할 질문을 불러오지 못했어요. 선생님께 다시 열어달라고 알려주세요.
              </div>
            ) : (
              <div className="grid gap-3">
                {votingQuestions.map((question, index) => {
                  const selected = selectedVotingQuestionIds.includes(question.id);
                  const atMax = !selected && selectedCount >= votingMaxSelections;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => toggleVotingQuestion(question.id)}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                        selected
                          ? "border-violet-400 bg-violet-50"
                          : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 rounded-full px-2 py-1 text-xs font-bold ${
                          selected ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          질문 {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-base font-medium leading-relaxed text-gray-900">
                            {question.text}
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            {selected ? "선택했어요" : atMax ? "누르면 선택을 바꿀 수 있어요" : "좋다고 생각하면 눌러서 선택해요"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="button"
              onClick={handleQuestionVotingSubmit}
              disabled={votingQuestions.length === 0}
              className="w-full py-4 bg-violet-500 text-white rounded-2xl font-bold text-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              좋은 질문 제출하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activityType === "one_line_share") {
    const coreKeywords = oneLineShareConfig?.coreKeywords ?? [];
    const auxiliaryKeywords = oneLineShareConfig?.auxiliaryKeywords ?? [];
    const normalizedContent = oneLineContent.trim();
    const matchingCoreKeywords = getMatchingConfiguredKeywords(normalizedContent, coreKeywords);
    const matchingAuxiliaryKeywords = getMatchingConfiguredKeywords(normalizedContent, auxiliaryKeywords);
    const missingCoreKeywords = coreKeywords.filter((keyword) => !matchingCoreKeywords.includes(keyword));
    const containsKeyword = coreKeywords.length === 0 || missingCoreKeywords.length === 0;

    function insertKeyword(keyword: string) {
      setOneLineContent((prev) => {
        if (prev.includes(keyword)) return prev;
        const trimmed = prev.trim();
        if (!trimmed) return keyword;
        return `${trimmed} ${keyword}`;
      });
    }

    async function handleOneLineShareSubmit() {
      if (!normalizedContent) {
        setError("문장을 적어주세요.");
        return;
      }

      if (!containsKeyword) {
        setError("핵심단어를 모두 넣어 문장을 다시 써주세요.");
        return;
      }

      setError("");
      setStep("one_line_submitting");
      const result = await submitOneLineShare(sessionId, roomId, normalizedContent);

      if (result.error) {
        setError(result.error);
        setStep("one_line_share");
        return;
      }

      router.push(`/room/${roomId}/result?session=${sessionId}`);
    }

    if (step === "one_line_submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
            <div className="text-6xl mb-6 animate-bounce">💬</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">한 줄을 정리하고 있어요</h1>
            <p className="text-gray-500 text-sm">친구들이 볼 수 있는 보드에 올리는 중이에요.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4">
        <div className="max-w-[1200px] mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-3">💬</div>
            <h1 className="text-2xl font-bold text-gray-800">한줄모아</h1>
            <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              오늘 활동: <strong>{topic}</strong>
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mt-4">
              {oneLineShareConfig?.promptDescription ?? "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요."}
            </p>
          </div>

          {(coreKeywords.length > 0 || auxiliaryKeywords.length > 0) && (
            <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              {coreKeywords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[11px] font-bold">필수</span>
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-500">오늘의 핵심단어</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {coreKeywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => insertKeyword(keyword)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                          matchingCoreKeywords.includes(keyword)
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        }`}
                      >
                        #{keyword}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">핵심단어는 모두 빠짐없이 들어가야 해요. 눌러서 문장에 바로 넣을 수 있어요.</p>
                </div>
              )}
              {auxiliaryKeywords.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-[11px] font-bold">선택</span>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">보조단어 (활용 가능)</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {auxiliaryKeywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => insertKeyword(keyword)}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                          matchingAuxiliaryKeywords.includes(keyword)
                            ? "bg-sky-100 text-sky-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        #{keyword}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">보조단어는 꼭 넣지 않아도 돼요. 문장이 더 풍성해질 수 있게 도와줘요.</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">내가 작성한 문장</label>
              <StudentSpellingTextarea
                value={oneLineContent}
                onValueChange={setOneLineContent}
                rows={4}
                placeholder="예) 증발은 물이 눈에 보이지 않게 공기 중으로 올라가는 변화라는 것을 새롭게 알게 되었다."
                className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className={`rounded-2xl px-4 py-3 text-sm ${
              containsKeyword ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {coreKeywords.length === 0
                ? "핵심단어가 없어 자유롭게 한 줄을 써도 괜찮아요."
                : containsKeyword
                  ? `좋아요! 핵심단어 ${matchingCoreKeywords.map((keyword) => `#${keyword}`).join(", ")} 가 모두 들어 있어요.${matchingAuxiliaryKeywords.length > 0 ? ` (보조단어 ${matchingAuxiliaryKeywords.map((keyword) => `#${keyword}`).join(", ")}도 활용함)` : ""}`
                  : `아직 ${missingCoreKeywords.map((keyword) => `#${keyword}`).join(", ")} 핵심단어가 빠졌어요. ${coreKeywords.length}개 핵심단어를 모두 넣어주세요.`}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="button"
              onClick={handleOneLineShareSubmit}
              disabled={!normalizedContent || !containsKeyword}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg hover:bg-rose-600 transition-colors"
            >
              {!normalizedContent
                ? "한 줄을 먼저 적어주세요"
                : !containsKeyword
                  ? "핵심단어를 모두 넣어주세요"
                  : "한 줄 제출하고 친구 문장 보러 가기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activityType === "hanja_writing" && hanjaWritingConfig) {
    const card = hanjaWritingConfig.card;
    const sentenceCount = hanjaWritingConfig.sentenceCount;
    const normalizedContents = Array.from({ length: sentenceCount }, (_, index) => hanjaContents[index] ?? "");
    const trimmedContents = normalizedContents.map((content) => content.trim());
    const allFilled = trimmedContents.every(Boolean);
    const missingWordIndexes = trimmedContents.flatMap((content, index) => (
      content && card.word && !sentenceContainsWord(content, card.word) ? [index] : []
    ));
    const allIncludeWord = missingWordIndexes.length === 0;

    function updateHanjaContent(index: number, value: string) {
      setHanjaContents((prev) => {
        const next = Array.from({ length: sentenceCount }, (_, idx) => prev[idx] ?? "");
        next[index] = value;
        return next;
      });
    }

    async function handleHanjaSubmit() {
      if (!allFilled) {
        setError(`문장 ${sentenceCount}개를 모두 적어주세요.`);
        return;
      }
      if (!allIncludeWord) {
        setError(`모든 문장에 "${card.word}" 단어가 들어가야 해요.`);
        return;
      }
      setError("");
      setStep("hanja_submitting");
      const result = await submitHanjaWriting(sessionId, roomId, trimmedContents);
      if (result.error) {
        setError(result.error);
        setStep("hanja_writing");
        return;
      }
      router.push(`/room/${roomId}/result?session=${sessionId}`);
    }

    if (step === "hanja_submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
            <div className="text-6xl mb-6 animate-bounce">📜</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">문장을 저장하고 있어요</h1>
            <p className="text-gray-500 text-sm">친구들과 함께 보는 보드에 올리는 중이에요.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <div className="max-w-[1200px] mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-2">📜</div>
            <h1 className="text-2xl font-bold text-gray-800">한자 활용 문장 만들기</h1>
            <p className="text-gray-500 text-sm leading-relaxed mt-2">
              {hanjaWritingConfig.promptDescription}
            </p>
            <div className="mt-4 inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
              오늘은 {sentenceCount}문장을 완성해요
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 border-2 border-amber-200">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-500">오늘의 단어</p>
              <h2 className="mt-2 text-5xl font-bold text-gray-900">{card.word}</h2>
              {card.definition && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{card.definition}</p>
              )}
            </div>

            {card.hanja.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold text-amber-600 mb-2">한자 풀이</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {card.hanja.map((h, idx) => (
                    <div key={`${h.char}-${idx}`} className="rounded-2xl bg-amber-50/70 border border-amber-100 p-3 flex items-center gap-3">
                      <span className="text-3xl font-bold text-amber-700">{h.char}</span>
                      <p className="text-sm font-semibold text-gray-800">{h.meaning} {h.reading}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.relatedWords.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold text-amber-600 mb-2">관련 단어</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {card.relatedWords.map((r, idx) => (
                    <div key={`${r.word}-${idx}`} className="rounded-2xl bg-amber-50/70 border border-amber-100 p-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold text-gray-800">{r.word}</span>
                        {r.hanja && <span className="text-xs text-amber-700">{r.hanja}</span>}
                        {r.sharedChar && (
                          <span className="ml-auto text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">공유 {r.sharedChar}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-600 leading-relaxed">{r.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.example && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500">예시 문장</p>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">{card.example}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="space-y-4">
              {normalizedContents.map((content, index) => {
                const trimmedContent = trimmedContents[index];
                const includesWord = card.word ? sentenceContainsWord(trimmedContent, card.word) : true;

                return (
                  <div key={`hanja-sentence-${index}`} className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {index + 1}번째 문장
                    </label>
                    <StudentSpellingTextarea
                      value={content}
                      onValueChange={(nextValue) => updateHanjaContent(index, nextValue)}
                      rows={3}
                      placeholder={`예) ${card.example || `${card.word}을(를) 활용한 자연스러운 문장을 써보세요.`}`}
                      className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 resize-none"
                    />
                    <p className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                      includesWord && trimmedContent ? "bg-emerald-50 text-emerald-700" : "bg-white text-amber-700"
                    }`}>
                      {!trimmedContent
                        ? `"${card.word}" 단어가 들어간 문장을 적어주세요.`
                        : includesWord
                          ? `좋아요! ${index + 1}번째 문장에 "${card.word}" 단어가 들어 있어요.`
                          : `아직 ${index + 1}번째 문장에 "${card.word}" 단어가 빠졌어요.`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className={`rounded-2xl px-4 py-3 text-sm ${
              allFilled && allIncludeWord ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {!allFilled
                ? `총 ${sentenceCount}문장을 모두 채워주세요.`
                : allIncludeWord
                  ? `좋아요! ${sentenceCount}문장이 모두 준비됐어요.`
                  : `${missingWordIndexes.map((index) => `${index + 1}번`).join(", ")} 문장에 "${card.word}" 단어를 꼭 넣어 주세요.`}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="button"
              onClick={handleHanjaSubmit}
              disabled={!allFilled || !allIncludeWord}
              className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {!allFilled
                ? `${sentenceCount}문장을 모두 적어주세요`
                : !allIncludeWord
                  ? `모든 문장에 "${card.word}" 단어를 넣어주세요`
                  : "문장 제출하고 친구 문장 보러 가기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "outline_sections") {
    const sections = outlineTemplate?.sections ?? [];
    const excludedItemIds = new Set(excludedTemplateItemIds);
    const selectedCount = templateAnswers.filter((answer) => !excludedItemIds.has(answer.itemId)).length;
    const answeredCount = templateAnswers.filter((answer) => (
      !excludedItemIds.has(answer.itemId) && answer.answer.trim()
    )).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
        <div className="max-w-[1200px] mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">개요 짜기</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-1">주제: {topic}</h1>
              {topicDescription && (
                <p className="text-sm text-gray-500 mt-1">{topicDescription}</p>
              )}
            </div>
            <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-center">
              <p className="text-sm text-orange-700 font-semibold">
                {outlineEditable
                  ? "선생님이 준비한 항목에서 빼고 싶은 것은 빼고, 내 항목을 더해도 좋아요."
                  : "선생님이 준비한 처음·가운데·끝 항목에 맞춰 내용을 써 보세요."}
              </p>
              <p className="text-xs text-orange-500 mt-1">남긴 항목 {selectedCount}개 · 작성 완료 {answeredCount}개</p>
            </div>
          </div>

          {sections.map(({ key, items }) => {
            const sectionSelectedCount = templateAnswers.filter((a) => a.section === key).length;
            const teacherItemsById = new Map(items.map((item) => [item.id, item]));
            const excludedTeacherItems = items.filter((item) => excludedItemIds.has(item.id));
            /*
             * ⚠️ 예전에는 교사 항목과 학생 항목을 **따로 그렸다**. 그래서 불러온 질문이 늘 갈래 맨
             *    뒤에 붙었다. 이제 `templateAnswers` 한 줄에서 순서를 받아 한 목록으로 그린다
             *    (2026-08-24 요청). 옮기기는 `moveTemplateItem`·`dropTemplateItem` 이 맡는다.
             */
            const sectionAnswers = templateAnswers.filter(
              (a) => a.section === key && !excludedItemIds.has(a.itemId)
            );
            return (
              <div key={key} className="bg-white rounded-3xl shadow-lg p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-orange-500 flex items-center gap-2">
                    <BadgeCircle className="bg-orange-100 text-orange-500">
                      {key === "처음" ? "1" : key === "가운데" ? "2" : "3"}
                    </BadgeCircle>
                    {key}
                  </h2>
                  <span className="text-xs font-semibold text-orange-400">
                    {sectionSelectedCount - excludedTeacherItems.length}개 남김
                  </span>
                </div>
                {outlineEditable && sectionAnswers.length > 1 && (
                  <p className="mb-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    ↕ 손잡이를 끌거나 ▲▼ 단추로 <b>{key}</b> 안에서 순서를 바꿀 수 있어요.
                  </p>
                )}
                <div className="space-y-3">
                  {sectionAnswers.map((answer, orderIndex) => {
                    const teacherItem = teacherItemsById.get(answer.itemId);
                    const isTeacherItem = Boolean(teacherItem);
                    const isSharedQuestion = answer.itemId.startsWith(SHARED_QUESTION_ITEM_PREFIX);
                    const isDragging = draggingItemId === answer.itemId;
                    const cardTone = isTeacherItem
                      ? "border-orange-300 bg-white"
                      : "border-amber-300 bg-amber-50/40";
                    const focusTone = isTeacherItem ? "focus:border-orange-400" : "focus:border-amber-400";

                    const reorderControls = outlineEditable && sectionAnswers.length > 1 ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <span
                          aria-hidden="true"
                          className="cursor-grab select-none px-1 text-gray-300"
                          title={`${key} 안에서 끌어서 옮기기`}
                        >
                          ⠿
                        </span>
                        {/* 끌기는 태블릿·키보드에서 어렵다. 같은 일을 하는 단추를 반드시 함께 둔다. */}
                        <button
                          type="button"
                          disabled={orderIndex === 0}
                          onClick={() => moveTemplateItem(answer.itemId, -1)}
                          aria-label={`${answer.label || "이 항목"} 위로 옮기기`}
                          className="rounded-lg px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={orderIndex === sectionAnswers.length - 1}
                          onClick={() => moveTemplateItem(answer.itemId, 1)}
                          aria-label={`${answer.label || "이 항목"} 아래로 옮기기`}
                          className="rounded-lg px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                          ▼
                        </button>
                      </div>
                    ) : null;

                    return (
                      <div
                        key={answer.itemId}
                        draggable={outlineEditable && sectionAnswers.length > 1}
                        onDragStart={() => setDraggingItemId(answer.itemId)}
                        onDragEnd={() => setDraggingItemId(null)}
                        onDragOver={(event) => { if (draggingItemId) event.preventDefault(); }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingItemId) dropTemplateItem(draggingItemId, answer.itemId);
                          setDraggingItemId(null);
                        }}
                        className={`rounded-2xl border-2 p-3 space-y-2 shadow-sm transition-opacity ${cardTone} ${isDragging ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {isTeacherItem ? (
                            <p className="text-base font-semibold text-gray-800 flex-1 leading-relaxed">{answer.label}</p>
                          ) : isSharedQuestion ? (
                            <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-bold shrink-0">
                              친구들과 만든 질문
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-bold shrink-0">
                              내가 추가
                            </span>
                          )}
                          {reorderControls}
                          {outlineEditable && (
                            <button
                              type="button"
                              onClick={() => (isTeacherItem
                                ? excludeTemplateItem(answer.itemId)
                                : removeTemplateItem(answer.itemId))}
                              aria-label={`${answer.label || "이 항목"} 항목 빼기`}
                              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              × 빼기
                            </button>
                          )}
                        </div>

                        {!isTeacherItem && (isSharedQuestion ? (
                          <p className="rounded-xl border-2 border-amber-100 bg-white px-4 py-3 text-base font-semibold leading-relaxed text-gray-800">
                            {answer.label}
                          </p>
                        ) : (
                          <input
                            type="text"
                            value={answer.label}
                            onChange={(e) => handleTemplateLabelChange(answer.itemId, e.target.value)}
                            placeholder="항목 이름 (예: 친구 이야기)"
                            className="w-full bg-white px-4 py-2 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors"
                          />
                        ))}

                        <StudentSpellingTextarea
                          value={answer.answer}
                          onValueChange={(nextValue) => handleTemplateAnswerChange(answer.itemId, nextValue)}
                          rows={2}
                          placeholder={isTeacherItem
                            ? (teacherItem?.placeholder ?? `${answer.label} 답을 써봐요`)
                            : isSharedQuestion
                              ? "이 질문에 답하며 글에 넣을 생각을 적어봐요"
                              : "내가 쓸 내용을 적어봐요"}
                          className={`w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none ${focusTone} resize-none transition-colors`}
                        />
                      </div>
                    );
                  })}

                  {excludedTeacherItems.length > 0 && (
                    <details className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3">
                      <summary className="cursor-pointer text-xs font-semibold text-gray-500">
                        뺀 항목 {excludedTeacherItems.length}개 · 다시 넣기
                      </summary>
                      <div className="mt-3 space-y-2">
                        {excludedTeacherItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => restoreTemplateItem(item, key)}
                            className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-left text-base text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                          >
                            <span className="mr-2 font-bold text-orange-500">+ 다시 넣기</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}

                  {outlineEditable && (
                    <button
                      type="button"
                      onClick={() => openSharedQuestionPicker(key)}
                      className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 px-4 py-3 text-sm font-semibold text-amber-700 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                    >
                      + 항목 추가하기 · 친구들이 고른 질문 불러오기
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 저장 상태와 임시 저장 — 아지트 학생 글쓰기와 같은 자리(제출 버튼 바로 위)에 둔다. */}
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500">
                {outlineManualSavedAt && !outlineSaveError ? "임시 저장 완료" : "자동 저장"}
              </p>
              <p className={`truncate text-sm font-bold ${outlineSaveError ? "text-red-500" : "text-gray-700"}`}>
                {outlineSaveError || (outlineManualSavedAt
                  ? `저장했어요 ✓ ${outlineManualSavedAt.toLocaleTimeString()}`
                  : outlineSavedAt
                    ? outlineSavedAt.toLocaleTimeString()
                    : "아직 저장 전이에요")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOutlineManualSave}
              disabled={outlineManualSaving || outlineSubmitting}
              className="shrink-0 rounded-2xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm font-bold text-orange-500 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-40 transition-colors"
            >
              {outlineManualSaving ? "저장 중..." : "임시 저장 💾"}
            </button>
          </div>

          <div className="pb-4">
            <button
              onClick={handleOutlineSectionSubmit}
              disabled={outlineSubmitting || answeredCount === 0}
              className="w-full py-4 bg-orange-400 text-white rounded-3xl font-bold text-base hover:bg-orange-500 disabled:opacity-40 transition-colors shadow-lg"
            >
              {outlineSubmitting ? "개요 만드는 중..." : "개요 완성하기 →"}
            </button>
            {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}
          </div>
        </div>

        {sharedQuestionPickerSection && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-question-picker-title"
          >
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="flex items-start justify-between gap-4 border-b border-orange-100 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-xs font-bold text-orange-500">{sharedQuestionPickerSection}에 질문 추가</p>
                  <h2 id="shared-question-picker-title" className="mt-1 text-xl font-bold text-gray-900">
                    친구들과 만든 질문에서 골라보세요
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    선생님이 중복 질문과 맞춤법을 정리한 뒤 ‘좋은 질문 고르기’에 올린 질문만 보여요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSharedQuestionPickerSection(null)}
                  aria-label="질문 선택 창 닫기"
                  className="shrink-0 rounded-full bg-gray-100 px-3 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                {sharedQuestionLoading && (
                  <div className="rounded-2xl bg-orange-50 px-5 py-8 text-center text-sm font-semibold text-orange-700">
                    우리 반 질문을 불러오고 있어요…
                  </div>
                )}

                {!sharedQuestionLoading && sharedQuestionError && (
                  <div className="rounded-2xl bg-rose-50 px-5 py-6 text-center">
                    <p className="text-sm font-semibold text-rose-600">{sharedQuestionError}</p>
                    <button
                      type="button"
                      onClick={() => openSharedQuestionPicker(sharedQuestionPickerSection)}
                      className="mt-4 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
                    >
                      다시 불러오기
                    </button>
                  </div>
                )}

                {!sharedQuestionLoading && !sharedQuestionError && sharedQuestionLoaded && sharedQuestionRooms.length === 0 && (
                  <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center">
                    <p className="text-sm font-bold text-gray-700">아직 가져올 질문이 없어요.</p>
                    <p className="mt-2 text-sm text-gray-500">선생님이 좋은 질문 고르기 활동을 만든 뒤 다시 확인해 주세요.</p>
                  </div>
                )}

                {!sharedQuestionLoading && !sharedQuestionError && sharedQuestionRooms.length > 0 && (
                  <div className="space-y-5">
                    {sharedQuestionRooms.map((questionRoom) => (
                      <section key={questionRoom.roomId} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-800">{questionRoom.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            questionRoom.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-200 text-gray-600"
                          }`}>
                            {questionRoom.isActive ? "진행 중" : "완료"}
                          </span>
                        </div>
                        {questionRoom.topic && questionRoom.topic !== questionRoom.title && (
                          <p className="mb-3 text-xs text-gray-500">주제: {questionRoom.topic}</p>
                        )}
                        <div className="space-y-2">
                          {questionRoom.questions.map((question) => {
                            const candidateItemId = buildSharedQuestionItemId(
                              sharedQuestionPickerSection,
                              questionRoom.roomId,
                              question.id,
                            );
                            const selected = templateAnswers.some((answer) => answer.itemId === candidateItemId);
                            return (
                              <button
                                key={question.id}
                                type="button"
                                disabled={selected}
                                onClick={() => addSharedQuestionTemplateItem(
                                  sharedQuestionPickerSection,
                                  questionRoom.roomId,
                                  question,
                                )}
                                className="flex w-full items-start gap-3 rounded-2xl border-2 border-white bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-orange-300 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50"
                              >
                                <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                                  selected ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                                }`}>
                                  {selected ? "추가됨" : "+ 선택"}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium leading-relaxed text-gray-800">{question.text}</span>
                                  {(question.votes ?? 0) > 0 && (
                                    <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                                      친구들 {question.votes}표
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    addCustomTemplateItem(sharedQuestionPickerSection);
                    setSharedQuestionPickerSection(null);
                  }}
                  className="w-full rounded-2xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                >
                  친구 질문 없이 내 항목 직접 쓰기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function normalizeQuestionVotingConfig(value: unknown): QuestionVotingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      sourceRoomId: null,
      sourceRoomTitle: null,
      sourceQuestions: [],
      evaluationCriteria: [],
      maxSelections: 1,
    };
  }

  const raw = value as Record<string, unknown>;
  const sourceQuestions = Array.isArray(raw.sourceQuestions)
    ? raw.sourceQuestions
        .filter((question): question is Record<string, unknown> => typeof question === "object" && question !== null && !Array.isArray(question))
        .map((question, index) => ({
          id: typeof question.id === "string" && question.id.trim() ? question.id.trim() : `question-${index + 1}`,
          text: typeof question.text === "string" ? question.text.trim() : "",
        }))
        .filter((question) => question.text.length > 0)
    : [];
  const dedupedSourceQuestions = dedupeVotingQuestions(sourceQuestions);

  const evaluationCriteria = Array.isArray(raw.evaluationCriteria)
    ? raw.evaluationCriteria
        .filter((criterion): criterion is string => typeof criterion === "string")
        .map((criterion) => criterion.trim())
        .filter(Boolean)
    : [];

  return {
    sourceRoomId: typeof raw.sourceRoomId === "string" && raw.sourceRoomId.trim() ? raw.sourceRoomId.trim() : null,
    sourceRoomTitle: typeof raw.sourceRoomTitle === "string" && raw.sourceRoomTitle.trim() ? raw.sourceRoomTitle.trim() : null,
    sourceQuestions: dedupedSourceQuestions,
    evaluationCriteria,
    maxSelections: normalizeSelectionCount(raw.maxSelections, Math.max(dedupedSourceQuestions.length, 1)),
  };
}

function normalizeSelectionCount(value: unknown, max: number = 4) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function dedupeVotingQuestions(questions: Array<{ id: string; text: string }>) {
  const seen = new Map<string, number>();

  return questions.map((question) => {
    const count = seen.get(question.id) ?? 0;
    seen.set(question.id, count + 1);

    if (count === 0) {
      return question;
    }

    return {
      ...question,
      id: `${question.id}__${count + 1}`,
    };
  });
}
