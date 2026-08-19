"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
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
  QuestionCardRole,
  QuestionCardSet,
  QuestionGeneratorConfig,
  QuestionGeneratorSubmission,
  QuestionVotingConfig,
} from "@/features/activities/types";
import { isActivityType } from "@/features/activities/types";
import type { OutlineTemplateAnswer, OutlineTemplate } from "@/features/activities/types";
import { getDefaultOutlineTemplate } from "@/lib/outline-templates";
import { StudentSpellingTextarea } from "@/components/student-spelling-textarea";
import {
  getCardMeta,
  getCardTheme,
  getRecommendedGradeChipClass,
  getRecommendedGradeLabel,
} from "@/features/activities/question-generator/card-meta";
import {
  QUESTION_GENERATOR_MODE_META,
  normalizeQuestionGeneratorConfig,
  questionGeneratorSteps,
} from "@/features/activities/question-generator/config";
import {
  getQuestionAreaByCardLabel,
  groupCardSetsByArea,
  type QuestionAreaId,
} from "@/features/activities/question-generator/areas";
import type { QuestionGeneratorMode } from "@/features/activities/types";

type Step =
  | "outline_sections"
  | "question_intro"
  | "question_path"
  | "question_set"
  | "question_prompt"
  | "question_rewrite"
  | "question_submitting"
  | "question_voting"
  | "one_line_share"
  | "one_line_submitting"
  | "hanja_writing"
  | "hanja_submitting";

type QuestionSelection = QuestionGeneratorSubmission["selections"][number];
type QuestionBuildMode = "direct" | "card_remix";
type OutlineSectionKey = "처음" | "가운데" | "끝";

type OutlineSharedQuestion = {
  id: string;
  text: string;
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
  const [templateAnswers, setTemplateAnswers] = useState<OutlineTemplateAnswer[]>([]);
  const [outlineSubmitting, setOutlineSubmitting] = useState(false);
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
  const [questionBuildMode, setQuestionBuildMode] = useState<QuestionBuildMode | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<QuestionAreaId | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState("");
  const [selectedVotingQuestionIds, setSelectedVotingQuestionIds] = useState<string[]>([]);
  const [oneLineContent, setOneLineContent] = useState("");

  const maxSelections = questionGeneratorConfig?.maxSelections ?? 1;
  const questionMode: QuestionGeneratorMode = questionGeneratorConfig?.mode ?? "card_remix";
  const questionModeMeta = QUESTION_GENERATOR_MODE_META[questionMode];
  const questionSteps = questionGeneratorSteps(questionMode);
  /** 방식마다 첫 단계가 다르다 — 직접 쓰기는 곧바로 입력창부터 연다. */
  const firstQuestionStep: Step = questionMode === "direct"
    ? "question_rewrite"
    : questionMode === "ai_custom"
      ? "question_set"
      : "question_path";
  const questionSelectionsFull = questionSelections.length >= maxSelections;

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
        if (existingSubmission?.selections?.length) {
          setQuestionSelections(existingSubmission.selections);
          setStep(editMode ? "question_path" : "question_intro");
        } else {
          setQuestionSelections([]);
          setStep("question_intro");
        }
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
        setOutlineTemplate(template);
        const savedAnswers = (data.existing_outline_answers ?? []) as OutlineTemplateAnswer[];
        if (savedAnswers.length > 0) {
          setTemplateAnswers(savedAnswers);
        }
        setStep("outline_sections");
      }
      setPageLoading(false);
    });

    return () => {
      active = false;
    };
  }, [editMode, roomId, sessionId]);

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
    setTemplateAnswers((prev) =>
      prev.map((a) => a.itemId === itemId ? { ...a, answer: value } : a)
    );
  }

  function handleTemplateLabelChange(itemId: string, value: string) {
    setTemplateAnswers((prev) =>
      prev.map((a) => a.itemId === itemId ? { ...a, label: value } : a)
    );
  }

  function toggleTemplateItem(item: { id: string; label: string }, section: "처음" | "가운데" | "끝") {
    setTemplateAnswers((prev) => {
      const existing = prev.find((a) => a.itemId === item.id);
      if (existing) {
        return prev.filter((a) => a.itemId !== item.id);
      }
      return [...prev, { section, itemId: item.id, label: item.label, answer: "" }];
    });
  }

  function addCustomTemplateItem(section: "처음" | "가운데" | "끝") {
    const itemId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTemplateAnswers((prev) => [...prev, { section, itemId, label: "", answer: "" }]);
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

    const submittable = templateAnswers
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
    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  function selectQuestionPrompt(prompt: string) {
    if (!activeCardSet) return;
    setSelectedCardSetId(activeCardSet.id);
    setSelectedPrompt(prompt);
    setRemixedQuestion(prompt);
  }


  async function handleQuestionSelectionSubmit() {
    const normalizedQuestion = remixedQuestion.trim();
    if (!normalizedQuestion) {
      setError("오늘 주제에 맞게 바꾼 질문을 적어주세요.");
      return;
    }

    if (!editingSelectionId && questionSelections.length >= maxSelections) {
      setError(`질문을 이미 ${maxSelections}개 만들었어요. 아래 목록에서 질문을 눌러 고쳐 보세요.`);
      return;
    }

    const selection: QuestionSelection = {
      id: editingSelectionId ?? `selection-${questionSelections.length + 1}`,
      method: questionBuildMode ?? "card_remix",
      cardSetId: questionBuildMode === "direct" ? "custom" : selectedCardSet?.id ?? "custom",
      cardSetLabel:
        questionBuildMode === "direct"
          ? "직접 질문 만들기"
          : selectedCardSet?.label ?? "질문 카드",
      originalPrompt: questionBuildMode === "direct" ? null : selectedPrompt,
      remixedQuestion: normalizedQuestion,
    };

    const nextSelections = editingSelectionId
      ? questionSelections.map((currentSelection) => (
          currentSelection.id === editingSelectionId ? selection : currentSelection
        ))
      : [...questionSelections, selection];
    setQuestionSelections(nextSelections);
    setError("");

    if (editingSelectionId) {
      setEditingSelectionId(null);
    }

    if (nextSelections.length < maxSelections) {
      startQuestionBuilder();
      return;
    }

    setStep("question_submitting");
    const result = await submitQuestionGenerator(sessionId, roomId, { selections: nextSelections });
    if (result.error) {
      setError(result.error);
      setStep("question_rewrite");
      return;
    }

    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  /** 방식에 맞는 첫 단계로 질문 만들기를 연다. 직접 쓰기는 카드 단계가 없어 입력창부터 열린다. */
  function startQuestionBuilder() {
    setEditingSelectionId(null);
    setQuestionBuildMode(questionMode === "direct" ? "direct" : "card_remix");
    setSelectedAreaId(null);
    setSelectedCategoryLabel(null);
    setSelectedCardSetId(null);
    setSelectedPrompt(null);
    setRemixedQuestion("");
    setPromptSearch("");
    setError("");
    setStep(firstQuestionStep);
  }

  function removeQuestionSelection(selectionId: string) {
    if (editingSelectionId === selectionId) {
      startQuestionBuilder();
    }
    setQuestionSelections((prev) => prev.filter((selection) => selection.id !== selectionId));
  }

  function editQuestionSelection(selection: QuestionSelection) {
    const selectedCard = enabledCardSets.find((cardSet) => cardSet.id === selection.cardSetId) ?? null;

    setEditingSelectionId(selection.id);
    setQuestionBuildMode(selection.method);
    setSelectedCardSetId(selection.cardSetId === "custom" ? null : selection.cardSetId);
    setSelectedPrompt(selection.originalPrompt);
    setRemixedQuestion(selection.remixedQuestion);
    setSelectedAreaId(selectedCard ? getQuestionAreaByCardLabel(selectedCard.label).id : null);
    setSelectedCategoryLabel(selectedCard ? buildCardSetLabel(selectedCard) : null);
    setPromptSearch("");
    setError("");
    setStep("question_rewrite");
  }

  if (activityType === "question_generator") {
    if (step === "question_intro") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="mx-auto w-full max-w-[1200px] py-8">
            <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                <div className="lg:w-[58%]">
                  <div className="flex items-center gap-3">
                    <span className="text-5xl">{questionModeMeta.icon}</span>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800">질문 만들기</h1>
                      <p className="text-sm font-semibold text-sky-600">{questionModeMeta.label}</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 px-5 py-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
                    <p className="mt-2 text-2xl font-bold leading-snug text-sky-950">{topic}</p>
                    <div className="mt-4 rounded-2xl bg-white/80 px-4 py-4">
                      <p className="text-xs font-semibold text-sky-700">활동 가이드</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-sky-950">
                        {topicDescription || questionGeneratorConfig?.guidance || questionModeMeta.studentHint}
                      </p>
                    </div>
                    {topicDescription && questionGeneratorConfig?.guidance && (
                      <p className="mt-3 text-sm leading-relaxed text-sky-800">{questionGeneratorConfig.guidance}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 lg:w-[42%]">
                  <div className="grid grid-cols-2 gap-3 text-left text-sm">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="font-semibold text-gray-700">오늘의 방법</p>
                      <p className="mt-1 text-lg font-bold text-sky-600">{questionModeMeta.label}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="font-semibold text-gray-700">완성할 질문</p>
                      <p className="mt-1 text-2xl font-bold text-sky-600">{maxSelections}개</p>
                    </div>
                    {questionMode === "card_remix" && (
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="font-semibold text-gray-700">질문 카테고리</p>
                        <p className="mt-1 text-2xl font-bold text-sky-600">{availableAreas.length}개</p>
                      </div>
                    )}
                    {questionMode === "ai_custom" && (
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="font-semibold text-gray-700">선생님 질문 예시</p>
                        <p className="mt-1 text-2xl font-bold text-sky-600">{enabledCardSets[0]?.prompts.length ?? 0}개</p>
                      </div>
                    )}
                    <div className="rounded-2xl bg-sky-50 p-4 text-sky-900">
                      <p className="text-xs font-semibold text-sky-700">이렇게 해요</p>
                      <p className="mt-1 text-sm leading-relaxed">{questionModeMeta.studentHint}</p>
                    </div>
                  </div>

                  <button
                    onClick={startQuestionBuilder}
                    className="w-full rounded-2xl bg-sky-500 py-4 text-lg font-bold text-white transition-colors hover:bg-sky-600"
                  >
                    {questionMode === "direct" ? "가이드 읽었어요. 질문 쓰러 가기" : "가이드 읽었어요. 질문 고르기"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_path") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="mx-auto w-full max-w-[1200px] py-8">
            <div className="space-y-4">
            <QuestionWizardHeader
              steps={questionSteps}
              currentStepKey="path"
              completedCount={questionSelections.length}
              maxSelections={maxSelections}
              modeLabel={questionModeMeta.label}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-sky-600 font-semibold">Step 1. 카테고리 고르기</p>
                    <h1 className="text-2xl font-bold text-gray-800 mt-1">어떤 종류의 질문을 만들지 골라보세요.</h1>
                    <p className="text-sm text-gray-500 mt-2">카테고리를 고르면 그 안의 질문만 보여드려요. 고른 질문은 다음 단계에서 오늘 주제에 맞게 바꿔 쓰면 돼요.</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700 whitespace-nowrap">
                    {questionSelections.length} / {maxSelections}개 완료
                  </div>
                </div>
                <div className="mt-5 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
                  <p className="mt-2 text-2xl font-bold leading-snug text-sky-950">{topic}</p>
                  {topicDescription && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-sky-900">{topicDescription}</p>
                  )}
                  {questionGeneratorConfig?.guidance && (
                    <p className="mt-3 text-sm leading-relaxed text-sky-800">{questionGeneratorConfig.guidance}</p>
                  )}
                </div>
              </div>

              <QuestionSelectionList
                selections={questionSelections}
                onEdit={editQuestionSelection}
                onRemove={removeQuestionSelection}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {availableAreas.map(({ area, cardSets, promptCount }) => {
                const selected = selectedAreaId === area.id;
                return (
                  <button
                    key={area.id}
                    disabled={questionSelectionsFull}
                    onClick={() => {
                      setQuestionBuildMode("card_remix");
                      setSelectedAreaId(area.id);
                      setSelectedCategoryLabel(null);
                      setSelectedCardSetId(null);
                      setSelectedPrompt(null);
                      setRemixedQuestion("");
                    }}
                    className={`rounded-3xl p-6 shadow-xl text-left transition-all duration-300 disabled:opacity-50 ${
                      selected
                        ? `bg-gradient-to-br ${area.surface} ring-2 shadow-2xl`
                        : "bg-white hover:-translate-y-0.5 hover:shadow-2xl"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-4xl">{area.emoji}</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        selected ? area.badge : `${area.chip.bg} ${area.chip.text}`
                      }`}>
                        {selected ? "선택됨" : `질문 ${promptCount}개`}
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-gray-800">{area.label}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">{area.hint}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {cardSets.map((cardSet) => (
                        <span key={cardSet.id} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-black/5">
                          {buildCardSetLabel(cardSet)}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
              {availableAreas.length === 0 && (
                <div className="rounded-3xl bg-white p-8 text-center shadow-xl md:col-span-2 xl:col-span-3">
                  <p className="text-sm font-semibold text-gray-700">선생님이 고른 질문 카드가 아직 없어요.</p>
                  <p className="mt-2 text-sm text-gray-500">선생님께 알려 주세요.</p>
                </div>
              )}
            </div>

            {questionSelectionsFull && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                질문을 모두 채웠어요. 수정하려면 위의 질문을 눌러 바로 고칠 수 있어요.
              </div>
            )}

            <button
              onClick={() => {
                if (questionSelectionsFull) return;
                if (selectedAreaId) {
                  setStep("question_set");
                }
              }}
              disabled={!selectedAreaId}
              className="w-full mt-6 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors"
            >
              다음으로 →
            </button>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_set") {
      const isTeacherPool = questionMode === "ai_custom";

      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="mx-auto w-full max-w-[1200px] py-8">
            <div className="space-y-4">
            <QuestionWizardHeader
              steps={questionSteps}
              currentStepKey="set"
              completedCount={questionSelections.length}
              maxSelections={maxSelections}
              modeLabel={questionModeMeta.label}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-sky-600 font-semibold">
                      {isTeacherPool ? "Step 1. 질문 고르기" : "Step 2. 질문 고르기"}
                    </p>
                    <h1 className="text-2xl font-bold text-gray-800 mt-1">
                      {isTeacherPool
                        ? "선생님이 준비한 질문 중에서 하나를 골라보세요."
                        : `${selectedArea?.area.label ?? "질문"} 카테고리의 질문 중 하나를 골라보세요.`}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                      {isTeacherPool
                        ? "마음에 드는 질문 하나를 고르면 다음 단계에서 내 질문으로 바꿔 쓸 수 있어요."
                        : "고른 질문을 다음 단계에서 오늘 선생님이 낸 주제에 맞게 바꿔 쓰면 됩니다."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700 whitespace-nowrap">
                    {questionSelections.length} / {maxSelections}개 완료
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-gray-50 px-5 py-4">
                  {isTeacherPool ? (
                    <>
                      <p className="text-xs font-semibold text-gray-500">오늘의 미션</p>
                      <p className="mt-1 font-bold text-gray-800">{topic}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-gray-500">오늘의 미션</p>
                      <p className="mt-1 font-bold text-gray-800">{topic}</p>
                      <div className="mt-3 flex items-center gap-3 border-t border-gray-200 pt-3">
                        <span className="text-2xl">{selectedArea?.area.emoji ?? "🃏"}</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">고른 카테고리</p>
                          <p className="font-bold text-gray-800">{selectedArea?.area.label ?? "질문 카테고리"}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <QuestionSelectionList
                selections={questionSelections}
                onEdit={editQuestionSelection}
                onRemove={removeQuestionSelection}
              />
            </div>

            {areaCardSets.length > 1 && (
              <div className="rounded-3xl bg-white p-4 shadow-lg">
                <div className="flex flex-wrap gap-2">
                  {areaCardSets.map((cardSet) => {
                    const label = buildCardSetLabel(cardSet);
                    const selected = activeCategoryLabel === label;
                    const meta = getCardMeta(cardSet.label);
                    const theme = getCardTheme(cardSet.label);
                    return (
                      <button
                        key={cardSet.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryLabel(label);
                          setSelectedCardSetId(null);
                          setSelectedPrompt(null);
                          setRemixedQuestion("");
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                          selected
                            ? `${theme.badge}`
                            : `${theme.chip} hover:opacity-80`
                        }`}
                      >
                        <span>{meta.emoji}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-4 shadow-lg">
              <label className="block text-xs font-semibold text-sky-700 mb-2">질문 찾기</label>
              <input
                value={promptSearch}
                onChange={(event) => setPromptSearch(event.target.value)}
                placeholder="바꾸고 싶은 질문의 단어나 표현을 찾아보세요."
                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400"
              />
            </div>

            {activeCardSet ? (
              <div className={`rounded-3xl bg-white p-6 shadow-xl ${getCardTheme(activeCardSet.label).accentBorder}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${getCardTheme(activeCardSet.label).chip}`}>
                        <span>{getCardMeta(activeCardSet.label).emoji}</span>
                        <span>{activeCardSet.label}</span>
                      </span>
                      {!isTeacherPool && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRecommendedGradeChipClass(getCardMeta(activeCardSet.label).recommendedGrades)}`}>
                          {getRecommendedGradeLabel(getCardMeta(activeCardSet.label).recommendedGrades)}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-gray-800">예시 질문을 보고 하나 골라보세요.</h2>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">{activeCardSet.description}</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 shrink-0">
                    {activeCardSet.prompts.length}장
                  </span>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {filteredPrompts.map((prompt, index) => {
                    const selected = selectedPrompt === prompt;
                    return (
                      <button
                        key={`${activeCardSet.id}-${index}-${prompt}`}
                        type="button"
                        aria-pressed={selected}
                        onPointerUp={(event) => {
                          if (event.pointerType === "mouse" && event.button !== 0) return;
                          selectQuestionPrompt(prompt);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectQuestionPrompt(prompt);
                          }
                        }}
                        className={`relative overflow-hidden rounded-3xl border-2 p-5 text-left touch-manipulation transition-all ${
                          selected
                            ? "border-sky-500 bg-sky-50 shadow-md shadow-sky-100"
                            : "border-gray-200 bg-gray-50 active:border-sky-300 active:bg-sky-50 hover:border-sky-200 hover:bg-sky-50"
                        }`}
                      >
                        {selected && <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-500" />}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-sky-600 mb-2">질문 카드 {index + 1}</p>
                            <p className="text-gray-800 font-medium leading-relaxed">{prompt}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                            selected ? "bg-sky-600 text-white" : "bg-white text-gray-500"
                          }`}>
                            {selected ? "✓ 선택됨" : "선택"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredPrompts.length === 0 && (
                    <div className="rounded-3xl bg-gray-50 p-8 text-center lg:col-span-2">
                      <p className="text-sm font-semibold text-gray-700">찾는 질문이 아직 안 보여요.</p>
                      <p className="mt-2 text-sm text-gray-500">검색어를 조금 다르게 바꾸거나 지우고 다시 찾아보세요.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
                <p className="text-sm font-semibold text-gray-700">
                  {isTeacherPool ? "선생님이 준비한 질문이 아직 없어요." : "이 카테고리에는 질문이 아직 없어요."}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {isTeacherPool ? "선생님께 알려 주세요." : "이전으로 돌아가 다른 카테고리를 골라 보세요."}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {questionMode === "card_remix" && (
                <button
                  onClick={() => setStep("question_path")}
                  className="flex-1 rounded-2xl border border-sky-200 bg-white py-4 text-center font-bold text-sky-700 transition-colors hover:bg-sky-50"
                >
                  이전
                </button>
              )}
              <button
                onClick={() => {
                  if (!selectedPrompt) return;
                  setError("");
                  setStep("question_rewrite");
                }}
                disabled={!selectedPrompt}
                className="flex-1 rounded-2xl bg-sky-500 py-4 text-center font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500"
              >
                다음
              </button>
            </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_rewrite") {
      const isDirect = questionMode === "direct";

      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="mx-auto w-full max-w-[1200px] py-8 space-y-4">
            <QuestionWizardHeader
              steps={questionSteps}
              currentStepKey="rewrite"
              completedCount={questionSelections.length}
              maxSelections={maxSelections}
              modeLabel={questionModeMeta.label}
            />

            {/* 태블릿 가로 화면에서는 왼쪽에 미션·힌트를 두고 오른쪽 입력창을 넓게 쓴다. */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-5 shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
                  <p className="mt-2 text-xl font-bold leading-snug text-sky-950">{topic}</p>
                  {topicDescription && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">{topicDescription}</p>
                  )}
                  <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3">
                    <p className="text-xs font-semibold text-sky-700">
                      {isDirect ? questionModeMeta.label : selectedCardSet?.label ?? activeCategoryLabel ?? "질문 카드"}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-sky-900">
                      {questionGeneratorConfig?.guidance || questionModeMeta.studentHint}
                    </p>
                  </div>
                </div>

                {selectedPrompt && (
                  <div className="rounded-3xl bg-white p-5 shadow-xl">
                    <p className="text-xs font-semibold text-gray-500">고른 힌트 질문</p>
                    <p className="mt-2 leading-relaxed text-gray-800">{selectedPrompt}</p>
                  </div>
                )}

                <QuestionSelectionList
                  selections={questionSelections}
                  onEdit={editQuestionSelection}
                  onRemove={removeQuestionSelection}
                />
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-sky-600">
                      Step {questionSteps.length}. {questionSteps[questionSteps.length - 1]?.label}
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-gray-800">
                      {editingSelectionId
                        ? "내가 만든 질문을 다시 다듬어 보세요."
                        : isDirect
                          ? "오늘 주제를 보고 내가 궁금한 것을 질문으로 써 보세요!"
                          : "고른 힌트를 바탕으로 미션에 맞는 나만의 질문을 완성해 보세요!"}
                    </h1>
                  </div>
                  <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 whitespace-nowrap">
                    {questionSelections.length} / {maxSelections}개 완료
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {editingSelectionId
                    ? "수정한 뒤 저장하면 선생님에게 보이는 질문도 새 내용으로 바뀝니다."
                    : isDirect
                      ? "정답이 있는 질문보다, 친구들과 이야기 나눌 수 있는 질문이 좋아요."
                      : "힌트는 출발점이에요. 내 생각이 드러나도록 문장을 자유롭게 바꿔도 좋아요."}
                </p>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">내가 완성한 질문</label>
                  <StudentSpellingTextarea
                    value={remixedQuestion}
                    onValueChange={setRemixedQuestion}
                    rows={8}
                    placeholder={isDirect ? "예) 만약 내가 그때 그곳에 있었다면 무엇을 했을까?" : "오늘의 미션에 맞는 질문으로 바꿔 써보세요."}
                    className="w-full min-h-[220px] rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg leading-8 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400 resize-y lg:min-h-[300px]"
                  />
                </div>

                {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}

                <div className="mt-5 flex gap-3">
                  {(questionMode !== "direct" || editingSelectionId) && (
                    <button
                      onClick={() => setStep(editingSelectionId ? firstQuestionStep : "question_set")}
                      className="flex-1 rounded-2xl border border-sky-200 bg-white py-4 text-center font-bold text-sky-700 transition-colors hover:bg-sky-50"
                    >
                      {editingSelectionId ? "목록으로" : "이전"}
                    </button>
                  )}
                  <button
                    onClick={handleQuestionSelectionSubmit}
                    className="flex-1 rounded-2xl bg-sky-500 py-4 text-lg font-bold text-white transition-colors hover:bg-sky-600"
                  >
                    {editingSelectionId
                      ? "수정 저장하기"
                      : questionSelections.length + 1 < maxSelections
                        ? "이 질문 저장하고 다음 질문 만들기"
                        : "제출하기"}
                  </button>
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
    const selectedCount = templateAnswers.length;
    const answeredCount = templateAnswers.filter((a) => a.answer.trim()).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
        <div className="max-w-[1200px] mx-auto">
          <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">개요 짜기</p>
              <h1 className="text-lg font-bold text-gray-800 mt-1">주제: {topic}</h1>
              {topicDescription && (
                <p className="text-sm text-gray-500 mt-1">{topicDescription}</p>
              )}
            </div>
            <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-center">
              <p className="text-xs text-orange-700 font-semibold">처음·가운데·끝 항목 중 쓰고 싶은 것만 골라서 써 보세요.</p>
              <p className="text-xs text-orange-500 mt-1">고른 항목 {selectedCount}개 · 작성 완료 {answeredCount}개</p>
            </div>
          </div>

          {sections.map(({ key, items }) => {
            const sectionSelectedCount = templateAnswers.filter((a) => a.section === key).length;
            const teacherItemIds = new Set(items.map((i) => i.id));
            const customAnswers = templateAnswers.filter(
              (a) => a.section === key && !teacherItemIds.has(a.itemId)
            );
            return (
              <div key={key} className="bg-white rounded-3xl shadow-lg p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-orange-500 flex items-center gap-2">
                    <span className="inline-block w-6 h-6 rounded-full bg-orange-100 text-orange-500 text-xs font-bold flex items-center justify-center">
                      {key === "처음" ? "1" : key === "가운데" ? "2" : "3"}
                    </span>
                    {key}
                  </h2>
                  <span className="text-xs font-semibold text-orange-400">{sectionSelectedCount}개 고름</span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => {
                    const selected = templateAnswers.some((a) => a.itemId === item.id);
                    const currentAnswer = templateAnswers.find((a) => a.itemId === item.id)?.answer ?? "";

                    if (!selected) {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleTemplateItem(item, key)}
                          className="w-full text-left rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 px-4 py-3 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="rounded-full bg-orange-100 text-orange-600 px-2.5 py-1 text-xs font-bold shrink-0">+ 쓸래요</span>
                            <p className="text-sm text-gray-700 flex-1 leading-relaxed">{item.label}</p>
                          </div>
                        </button>
                      );
                    }

                    return (
                      <div key={item.id} className="rounded-2xl border-2 border-orange-300 bg-white p-3 space-y-2 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800 flex-1 leading-relaxed">{item.label}</p>
                          <button
                            type="button"
                            onClick={() => toggleTemplateItem(item, key)}
                            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            × 빼기
                          </button>
                        </div>
                        <StudentSpellingTextarea
                          value={currentAnswer}
                          onValueChange={(nextValue) => handleTemplateAnswerChange(item.id, nextValue)}
                          rows={2}
                          placeholder={item.placeholder ?? `${item.label} 답을 써봐요`}
                          className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 resize-none transition-colors"
                        />
                      </div>
                    );
                  })}

                  {customAnswers.map((custom) => (
                    <div key={custom.itemId} className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-bold shrink-0">
                          {custom.itemId.startsWith(SHARED_QUESTION_ITEM_PREFIX) ? "친구들과 만든 질문" : "내가 추가"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTemplateItem(custom.itemId)}
                          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          × 빼기
                        </button>
                      </div>
                      {custom.itemId.startsWith(SHARED_QUESTION_ITEM_PREFIX) ? (
                        <p className="rounded-xl border-2 border-amber-100 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-gray-800">
                          {custom.label}
                        </p>
                      ) : (
                        <input
                          type="text"
                          value={custom.label}
                          onChange={(e) => handleTemplateLabelChange(custom.itemId, e.target.value)}
                          placeholder="항목 이름 (예: 친구 이야기)"
                          className="w-full bg-white px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors"
                        />
                      )}
                      <StudentSpellingTextarea
                        value={custom.answer}
                        onValueChange={(nextValue) => handleTemplateAnswerChange(custom.itemId, nextValue)}
                        rows={2}
                        placeholder={custom.itemId.startsWith(SHARED_QUESTION_ITEM_PREFIX)
                          ? "이 질문에 답하며 글에 넣을 생각을 적어봐요"
                          : "내가 쓸 내용을 적어봐요"}
                        className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 resize-none transition-colors"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => openSharedQuestionPicker(key)}
                    className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/30 px-4 py-3 text-sm font-semibold text-amber-700 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    + 직접 추가하기
                  </button>
                </div>
              </div>
            );
          })}

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
                                <span className="text-sm font-medium leading-relaxed text-gray-800">{question.text}</span>
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

function QuestionWizardHeader({
  steps,
  currentStepKey,
  completedCount,
  maxSelections,
  modeLabel,
}: {
  steps: ReadonlyArray<{ key: string; label: string }>;
  currentStepKey: string;
  completedCount: number;
  maxSelections: number;
  modeLabel: string;
}) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === currentStepKey));
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="bg-white rounded-3xl shadow-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-500">질문 만들기 · {modeLabel}</p>
          <p className="mt-1 text-sm text-gray-500">지금은 {steps[currentIndex]?.label} 단계예요.</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
          {completedCount} / {maxSelections}개 완료
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-sky-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {steps.length > 1 && (
        <div className={`mt-4 grid gap-2 ${steps.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {steps.map((wizardStep, index) => {
            const active = index === currentIndex;
            const complete = index < currentIndex;

            return (
              <div
                key={wizardStep.key}
                className={`rounded-2xl px-3 py-3 text-center transition-colors ${
                  active
                    ? "bg-sky-500 text-white"
                    : complete
                      ? "bg-sky-100 text-sky-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <p className="text-xs font-semibold">Step {index + 1}</p>
                <p className="mt-1 text-sm font-bold">{wizardStep.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 지금까지 만든 질문 — 어느 단계에서든 눌러서 고칠 수 있다. */
function QuestionSelectionList({
  selections,
  onEdit,
  onRemove,
}: {
  selections: QuestionSelection[];
  onEdit: (selection: QuestionSelection) => void;
  onRemove: (selectionId: string) => void;
}) {
  if (selections.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl shadow-lg p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-700">지금까지 만든 질문</p>
        <p className="text-xs font-semibold text-sky-600">질문을 누르면 고칠 수 있어요</p>
      </div>
      <div className="space-y-2">
        {selections.map((selection) => (
          <div key={selection.id} className="rounded-2xl bg-sky-50 p-2">
            <button
              type="button"
              onClick={() => onEdit(selection)}
              className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-sky-700">{selection.cardSetLabel}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-700">수정</span>
              </div>
              <p className="mt-1 text-sm text-gray-800">{selection.remixedQuestion}</p>
            </button>
            <button
              type="button"
              onClick={() => onRemove(selection.id)}
              className="mt-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
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
