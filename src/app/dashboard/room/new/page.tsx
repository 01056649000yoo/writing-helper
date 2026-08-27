"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createRoom,
  enhanceOutlineTemplateWithAI,
  generateQuestionsWithAI,
  getQuestionGeneratorSourceRooms,
  type QuestionGeneratorSourceRoomSummary,
  getQuestionVotingSourceRooms,
  type QuestionVotingSourceRoomSummary,
} from "@/app/actions/room-actions";
import { getQuestionCardSettings } from "@/app/actions/settings-actions";
import { activityDefinitions, getActivityDefinition } from "@/features/activities/registry";
import type { ActivityType, QuestionCardRole, QuestionCardSet } from "@/features/activities/types";
import {
  getCardKeywordBadge,
  getQuestionAreaByCardLabel,
} from "@/features/activities/question-generator/areas";
import { saveQuestionCardSetting } from "@/app/actions/settings-actions";
import { LabGuide } from "@/features/activities/LabGuide";
import { BadgeCircle } from "@/components/badge-circle";
import {
  getCardMeta,
  getCardTheme,
  getRecommendedGradeChipClass,
  getRecommendedGradeLabel,
} from "@/features/activities/question-generator/card-meta";
import { QUESTION_SELECTION_CHOICES } from "@/features/activities/question-generator/config";
import {
  buildDraftStorageKey,
  clearActivityDraft,
  persistActivityDraft,
} from "@/lib/activity-drafts";
import {
} from "@/lib/hanja-recommended-words";
import { useActivityDraft } from "@/lib/use-activity-draft";
import { getDefaultOutlineTemplate } from "@/lib/outline-templates";
import type { OutlineTemplate, OutlineTemplateItem } from "@/lib/outline-templates";
import type { SubjectType, GradeLevel } from "@/types";

const SUBJECT_TYPES = [
  "생활문", "일기", "편지", "독서감상문", "기행문",
  "관찰기록문", "이야기 글", "설명하는 글", "주장하는 글",
  "소개하는 글", "동시", "보고서",
] as const;

type OutlineBuilderDraft = {
  topic: string;
  topic_description: string;
  subject_type: string;
  grade_level: string;
  /** 학생이 개요 틀을 고칠 수 있는가(기본 허용). */
  student_editable: boolean;
};

type QuestionGeneratorMode = "direct" | "card_remix" | "ai_custom";

type QuestionGeneratorDraft = {
  topic: string;
  topic_description: string;
  mode: QuestionGeneratorMode;
  max_selections: string;
  /** 제출에 필요한 최소 개수. 목표(max_selections)보다 작으면 "덜 채워도 낼 수 있다"가 된다. */
  min_selections: string;
  guidance: string;
  selectedCardSetIds: string[];
  customAiQuestions: Array<{ id: string; text: string; included: boolean }>;
};

type CardOriginFilter = "all" | "default" | "custom";

function matchesCardOrigin(cardSet: QuestionCardSet, originFilter: CardOriginFilter) {
  if (originFilter === "all") return true;
  if (originFilter === "default") return Boolean(cardSet.isDefault);
  return !cardSet.isDefault;
}

type VotingQuestionDraft = {
  id: string;
  text: string;
  included: boolean;
  sourceSessionId?: string;
  sourceSelectionId?: string;
};

type QuestionVotingDraft = {
  max_selections: string;
  evaluation_criteria: string;
  source_room_id: string;
  source_room_title: string;
  source_room_topic: string;
  voting_questions: VotingQuestionDraft[];
};

type OneLineShareDraft = {
  topic: string;
  topic_description: string;
  core_keywords: string;
  auxiliary_keywords: string;
  max_reactions_per_student: string;
};

const ACTIVITY_META: Record<ActivityType, { emoji: string; tone: string; summary: string }> = {
  outline_builder: {
    emoji: "📝",
    tone: "from-indigo-50 via-white to-blue-50",
    summary: "처음·가운데·끝 개요 틀에 내용을 채우며 글의 흐름을 직접 구성해 보는 활동",
  },
  question_generator: {
    emoji: "❓",
    tone: "from-emerald-50 via-white to-teal-50",
    summary: "직접 질문을 만들거나 질문 카드를 참고해 오늘 주제에 맞는 질문을 만드는 활동",
  },
  question_voting: {
    emoji: "🗳️",
    tone: "from-amber-50 via-white to-orange-50",
    summary: "질문 후보 중에서 가장 좋은 질문을 고르는 활동",
  },
  one_line_share: {
    emoji: "💬",
    tone: "from-rose-50 via-white to-pink-50",
    summary: "핵심단어를 이용한 문장 만들기 활동",
  },
  hanja_writing: {
    emoji: "📜",
    tone: "from-amber-50 via-white to-orange-50",
    summary: "단어 속 한자의 뜻을 살피고, 그 단어를 활용해 한 문장을 만들어 친구와 나누는 활동",
  },
};

/**
 * 교사가 새로 만들 수 있는 활동.
 *
 * `hanja_writing`(한자 활용 문장 만들기)은 2026-08-19에 여기서 뺐고, 한자 단어집 화면도
 * 2026-08-21에 제거했다. 저장 카드와 과거 활동 기록은 데이터 호환을 위해 보존한다.
 *
 * **정의와 렌더링은 지우지 않았다.** 이미 만들어 둔 방과 학생 세션이 있어 통째로 들어내면
 * 그 기록이 열리지 않는다. `ACTIVITY_TYPES`·`registry`·결과 화면은 그대로 두고
 * **새로 만드는 길만 닫는다.**
 */
const WRITING_BUNDLE_ACTIVITY_IDS: ActivityType[] = [
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
];

const WRITING_BUNDLE_DEFINITIONS = activityDefinitions.filter(
  (activity) => WRITING_BUNDLE_ACTIVITY_IDS.includes(activity.id),
);


/** 활동을 고르는 자리에서 바로 여는 도움말. 내용은 대시보드 안내 탭과 같은 것을 본다. */
function LabGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50"
      >
        ❓ 활동 도움말
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-gray-100 bg-white px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">📖 글쓰기 연구소 도움말</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-xl font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="도움말 닫기"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <LabGuide compact />
            </div>
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-gray-800 px-5 py-2 text-xs font-bold text-white hover:bg-gray-900"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ActivitySelectionScreen({ classId }: { classId: string }) {
  return (
    <main className="lab-page">
      <div className="lab-page__content">
        <Link href={classId ? `/dashboard/class/${classId}` : "/dashboard"} className="lab-breadcrumb">
          ← {classId ? "학급으로" : "대시보드로"}
        </Link>

        <div className="lab-panel lab-panel--raised overflow-hidden">
          {/* 헤더 */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-indigo-600">Step 1</p>
                <h1 className="mt-0.5 text-xl font-bold text-gray-800">어떤 활동을 시작할까요?</h1>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">활동을 고르면 각 활동에 맞는 설정 화면이 열립니다</p>
                <LabGuideButton />
              </div>
            </div>
          </div>

          <div>
            <section className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">📦</span>
                  <h2 className="text-sm font-bold text-gray-800 truncate">글쓰기 활동 꾸러미</h2>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600">
                    {WRITING_BUNDLE_DEFINITIONS.length}개
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">바로 사용</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {WRITING_BUNDLE_DEFINITIONS.map((activity) => {
                  const meta = ACTIVITY_META[activity.id];
                  return (
                    <Link
                      key={activity.id}
                      href={`/dashboard/room/new?class_id=${classId}&activity_type=${activity.id}`}
                      className={`flex flex-col rounded-2xl border border-gray-200/90 bg-gradient-to-br ${meta.tone} p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-indigo-300 group`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{meta.emoji}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">{activity.label}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-600 flex-1">{meta.summary}</p>
                      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400">활동 개설</span>
                        <span className="inline-flex items-center gap-1 bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-2xs transition-all">
                          선택하기 →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function PageShell({
  classId,
  activityType,
  children,
}: {
  classId: string;
  activityType: ActivityType;
  children: React.ReactNode;
}) {
  const activity = getActivityDefinition(activityType);
  const meta = ACTIVITY_META[activityType];

  return (
    <main className="lab-page">
      <div className="lab-page__content lab-page__content--medium">
        <div className="flex items-center justify-between gap-4">
          <Link href={classId ? `/dashboard/class/${classId}` : "/dashboard"} className="lab-breadcrumb mb-0">
            ← {classId ? "학급으로" : "대시보드로"}
          </Link>
          <Link href={`/dashboard/room/new?class_id=${classId}`} className="lab-button lab-button--quiet">
            활동 다시 고르기
          </Link>
        </div>

        <div className="lab-panel lab-panel--raised mt-4 overflow-hidden">
          <div className={`px-8 py-8 bg-gradient-to-r ${meta.tone} border-b border-gray-100`}>
            <div className="flex items-start gap-4">
              <span className="text-5xl">{meta.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-indigo-600">선택한 활동</p>
                <h1 className="mt-1 text-3xl font-bold text-gray-800">{activity.label}</h1>
                <p className="mt-2 text-base text-gray-600">{meta.summary}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

function OutlineBuilderSetup({ classId }: { classId: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiEnhancing, setAiEnhancing] = useState<string | null>(null);
  const [customTemplate, setCustomTemplate] = useState<OutlineTemplate | null>(null);
  // `좋은 질문 고르기`에서 학생들이 뽑은 질문을 개요 항목으로 가져온다.
  // 질문 만들기 → 좋은 질문 고르기가 쓰는 원본 방 고르기와 같은 짜임이다.
  const [votingRooms, setVotingRooms] = useState<QuestionVotingSourceRoomSummary[]>([]);
  const [votingRoomId, setVotingRoomId] = useState("");
  const [pickedQuestions, setPickedQuestions] = useState<Record<string, "처음" | "가운데" | "끝">>({});
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getQuestionVotingSourceRooms(classId).then((rooms) => {
      if (!active) return;
      setVotingRooms(rooms);
      setVotingRoomId((prev) => prev || rooms[0]?.roomId || "");
    });
    return () => { active = false; };
  }, [classId]);

  const initialDraft = useMemo<OutlineBuilderDraft>(() => ({
    topic: "",
    topic_description: "",
    subject_type: "생활문",
    grade_level: "중학년",
    student_editable: true,
      }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<OutlineBuilderDraft>(
    buildDraftStorageKey(classId, "outline_builder"),
    initialDraft
  );

  const subjectType = draft.subject_type as SubjectType;
  const effectiveTemplate = customTemplate ?? getDefaultOutlineTemplate(subjectType);

  async function handleAiEnhance(sectionKey: "처음" | "가운데" | "끝") {
    if (aiEnhancing) return;
    setAiEnhancing(sectionKey);
    setError("");
    const result = await enhanceOutlineTemplateWithAI(
      subjectType,
      draft.grade_level as GradeLevel,
      draft.topic,
      draft.topic_description,
      effectiveTemplate,
      sectionKey,
    );
    setAiEnhancing(null);
    if (result.items) {
      setCustomTemplate((prev) => {
        const base = prev ?? getDefaultOutlineTemplate(subjectType);
        return {
          sections: base.sections.map((s) =>
            s.key === sectionKey
              ? { ...s, items: [...s.items, ...result.items!] }
              : s
          ),
        };
      });
    } else if (result.error) {
      setError(result.error);
    }
  }

  function updateItemField(sectionKey: string, itemId: string, field: keyof OutlineTemplateItem, value: string) {
    setCustomTemplate((prev) => {
      const base = prev ?? getDefaultOutlineTemplate(subjectType);
      return {
        sections: base.sections.map((s) =>
          s.key === sectionKey
            ? { ...s, items: s.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) }
            : s
        ),
      };
    });
  }

  function removeItem(sectionKey: string, itemId: string) {
    setCustomTemplate((prev) => {
      const base = prev ?? getDefaultOutlineTemplate(subjectType);
      return {
        sections: base.sections.map((s) =>
          s.key === sectionKey ? { ...s, items: s.items.filter((item) => item.id !== itemId) } : s
        ),
      };
    });
  }

  function addItem(sectionKey: string) {
    const newId = `custom-${Date.now()}`;
    setCustomTemplate((prev) => {
      const base = prev ?? getDefaultOutlineTemplate(subjectType);
      return {
        sections: base.sections.map((s) =>
          s.key === sectionKey
            ? { ...s, items: [...s.items, { id: newId, label: "", placeholder: "" }] }
            : s
        ),
      };
    });
  }

  const selectedVotingRoom = votingRooms.find((room) => room.roomId === votingRoomId) ?? null;
  const pickedCount = Object.keys(pickedQuestions).length;

  /** 고른 질문을 개요 항목으로 넣는다. 질문 자체가 학생이 답할 물음이므로 `label` 이 된다. */
  function addPickedQuestions() {
    if (!selectedVotingRoom || pickedCount === 0) return;
    const byQuestionId = new Map(selectedVotingRoom.questions.map((question) => [question.id, question] as const));

    setCustomTemplate((prev) => {
      const base = prev ?? getDefaultOutlineTemplate(subjectType);
      return {
        sections: base.sections.map((section) => {
          const added = Object.entries(pickedQuestions)
            .filter(([, sectionKey]) => sectionKey === section.key)
            .map(([questionId], index) => {
              const question = byQuestionId.get(questionId);
              return {
                id: `voted-${questionId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}-${index}`,
                label: question?.text ?? "",
                placeholder: "친구들이 고른 질문이에요. 내 생각을 자유롭게 적어 보세요.",
              };
            })
            .filter((item) => item.label.trim().length > 0);
          return added.length > 0 ? { ...section, items: [...section.items, ...added] } : section;
        }),
      };
    });
    setPickedQuestions({});
    setQuestionPanelOpen(false);
  }

  async function handleCreateRoom() {
    if (saving) return;
    setError("");
    setSaving(true);
    const storageKey = buildDraftStorageKey(classId, "outline_builder");

    const fd = new FormData();
    fd.set("class_id", classId);
    fd.set("activity_type", "outline_builder");
    fd.set("topic", draft.topic);
    fd.set("topic_description", draft.topic_description);
    fd.set("subject_type", draft.subject_type);
    fd.set("grade_level", draft.grade_level);
    fd.set("student_editable", draft.student_editable === false ? "false" : "true");
    if (customTemplate) {
      fd.set("outline_template_json", JSON.stringify(customTemplate));
    }

    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <TopicFields
        values={{ topic: draft.topic, topic_description: draft.topic_description }}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        hint="주제를 자세히 적을수록 AI 예시가 더 정확해집니다."
        placeholder="예) 지난 주 금요일 학교 뒷산으로 봄 소풍을 다녀왔어요."
        savedAt={draftControls.savedAt}
      />

      <div>
        <label className="block text-base font-medium text-gray-700 mb-3">글의 종류</label>
        <div className="grid grid-cols-3 gap-2">
          {SUBJECT_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="subject_type"
                value={type}
                checked={draft.subject_type === type}
                onChange={() => {
                  setDraft((prev) => ({ ...prev, subject_type: type }));
                  setCustomTemplate(null);
                }}
                className="text-indigo-500 shrink-0"
              />
              <span className="text-base text-gray-700">{subjectLabel(type)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-base font-medium text-gray-700 mb-3">대상 학년</label>
        <div className="grid grid-cols-3 gap-2">
          {(["저학년", "중학년", "고학년"] as const).map((grade) => (
            <label
              key={grade}
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="grade_level"
                value={grade}
                checked={draft.grade_level === grade}
                onChange={() => setDraft((prev) => ({ ...prev, grade_level: grade }))}
                className="text-indigo-500 shrink-0"
              />
              <span className="text-base text-gray-700">{gradeLabel(grade)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 개요를 주는 방식 두 가지. 학생 화면의 자유도가 여기서 갈린다(2026-08-20 사용자 요청). */}
      <div>
        <label className="block text-base font-medium text-gray-700 mb-3">학생이 개요를 다루는 방식</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex flex-col gap-1.5 rounded-2xl border-2 p-4 cursor-pointer transition-all ${
            draft.student_editable !== false ? "border-indigo-500 bg-indigo-50/70" : "border-gray-200 bg-white hover:border-gray-300"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">✏️ 학생이 고쳐 쓰기</span>
              <input
                type="radio"
                name="student_editable"
                checked={draft.student_editable !== false}
                onChange={() => setDraft((prev) => ({ ...prev, student_editable: true }))}
                className="text-indigo-500"
              />
            </div>
            <p className="text-xs leading-relaxed text-gray-600">
              선생님 틀을 <strong>기본값</strong>으로 주고, 학생이 항목을 빼거나 더하고
              <strong> 친구들이 고른 좋은 질문</strong>도 불러와 자기 개요로 만듭니다.
            </p>
          </label>

          <label className={`flex flex-col gap-1.5 rounded-2xl border-2 p-4 cursor-pointer transition-all ${
            draft.student_editable === false ? "border-indigo-500 bg-indigo-50/70" : "border-gray-200 bg-white hover:border-gray-300"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">📋 선생님 틀 그대로</span>
              <input
                type="radio"
                name="student_editable"
                checked={draft.student_editable === false}
                onChange={() => setDraft((prev) => ({ ...prev, student_editable: false }))}
                className="text-indigo-500"
              />
            </div>
            <p className="text-xs leading-relaxed text-gray-600">
              항목을 빼거나 더할 수 없습니다. 모두 같은 틀로 채우게 해 <strong>글의 짜임을 익히는</strong> 수업에 씁니다.
            </p>
          </label>
        </div>
      </div>

      <div className="border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">개요 항목</h3>
          {customTemplate && (
            <button
              type="button"
              onClick={() => setCustomTemplate(null)}
              className="text-xs text-gray-400 hover:text-red-400 underline"
            >
              기본값으로 초기화
            </button>
          )}
        </div>

        {/* 좋은 질문 고르기에서 학생들이 뽑은 질문을 개요 항목으로 가져온다.
            활동이 하나도 없으면 이 칸 자체를 그리지 않는다 — 빈 안내는 화면만 늘린다. */}
        {votingRooms.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-amber-700">💬 친구들이 고른 좋은 질문 가져오기</p>
                <p className="mt-0.5 text-xs text-amber-700/80">
                  `좋은 질문 고르기`에서 표를 받은 질문을 개요 항목으로 넣을 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuestionPanelOpen((open) => !open)}
                className="lab-button lab-button--quiet text-xs"
              >
                {questionPanelOpen ? "닫기" : "질문 고르기"}
              </button>
            </div>

            {questionPanelOpen && (
              <div className="mt-3 space-y-3">
                <select
                  value={votingRoomId}
                  onChange={(event) => { setVotingRoomId(event.target.value); setPickedQuestions({}); }}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  {votingRooms.map((room) => (
                    <option key={room.roomId} value={room.roomId}>
                      {room.title} · {room.voterCount}명 참여
                    </option>
                  ))}
                </select>

                <div className="space-y-1.5">
                  {selectedVotingRoom?.questions.map((question) => {
                    const picked = pickedQuestions[question.id];
                    return (
                      <div key={question.id} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(picked)}
                          onChange={(event) => setPickedQuestions((prev) => {
                            const next = { ...prev };
                            if (event.target.checked) next[question.id] = "가운데";
                            else delete next[question.id];
                            return next;
                          })}
                          className="mt-1"
                        />
                        <span className="min-w-[2.6rem] rounded-full bg-amber-100 px-2 py-0.5 text-center text-xs font-bold text-amber-700">
                          {question.votes}표
                        </span>
                        <span className="flex-1 text-sm text-gray-800">{question.text}</span>
                        {picked && (
                          <select
                            value={picked}
                            onChange={(event) => setPickedQuestions((prev) => ({
                              ...prev,
                              [question.id]: event.target.value as "처음" | "가운데" | "끝",
                            }))}
                            className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-gray-900"
                          >
                            <option value="처음">처음</option>
                            <option value="가운데">가운데</option>
                            <option value="끝">끝</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addPickedQuestions}
                  disabled={pickedCount === 0}
                  className="lab-button w-full text-sm disabled:opacity-50"
                >
                  {pickedCount > 0 ? `${pickedCount}개를 개요 틀에 넣기` : "질문을 골라 주세요"}
                </button>
              </div>
            )}
          </div>
        )}

        {effectiveTemplate.sections.map(({ key, items }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-indigo-600">{key}</h4>
              <button
                type="button"
                onClick={() => handleAiEnhance(key)}
                disabled={!!aiEnhancing}
                className="text-xs text-indigo-400 hover:text-indigo-600 disabled:opacity-40 border border-indigo-200 rounded-lg px-2 py-1 transition-colors"
              >
                {aiEnhancing === key ? "AI 보완 중..." : "✨ AI 항목 추가"}
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateItemField(key, item.id, "label", e.target.value)}
                      placeholder="개요 항목 이름 (예: 언제, 어디서)"
                      className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(key, item.id)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.placeholder}
                    onChange={(e) => updateItemField(key, item.id, "placeholder", e.target.value)}
                    placeholder="학생 입력칸에 보일 예시 (예: 예) 지난 토요일 오후, 공원에서...)"
                    className="w-full px-3 py-2 text-xs text-gray-500 border border-gray-100 bg-gray-50 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white focus:text-gray-900"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addItem(key)}
              className="w-full py-1.5 border border-dashed border-indigo-200 rounded-xl text-xs text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              + 항목 추가
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

      {saving && (
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2 animate-spin inline-block">⚙️</div>
          <p className="text-indigo-700 font-medium text-base">활동을 시작하고 있어요...</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleCreateRoom}
        disabled={saving}
        className="w-full py-4 bg-indigo-500 text-white rounded-xl font-bold text-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
      >
        {saving ? "시작 중..." : "🚀 활동 시작하기"}
      </button>
    </div>
  );
}


// 카테고리 기준의 원본은 features/activities/question-generator/areas.ts 하나다(학생 화면과 같은 기준).
function getCardBadge(label: string): string {
  return getCardKeywordBadge(label);
}

function getCardBadgeStyle(label: string): string {
  const { chip } = getQuestionAreaByCardLabel(label);
  return `${chip.bg} ${chip.text} ${chip.border}`;
}

function QuestionGeneratorSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiGenError, setAiGenError] = useState("");
  const [aiCount, setAiCount] = useState<number>(5);
  const [modalTargetCardSet, setModalTargetCardSet] = useState<QuestionCardSet | null>(null);
  const [creatingCardSet, setCreatingCardSet] = useState(false);
  const [availableCardSets, setAvailableCardSets] = useState<QuestionCardSet[]>([]);
  const [loadingCardSets, setLoadingCardSets] = useState(true);
  const initializedRef = useRef(false);

  const initialDraft = useMemo<QuestionGeneratorDraft>(() => ({
    topic: "",
    topic_description: "",
    mode: "direct",
    max_selections: "3",
    min_selections: "3",
    guidance: "",
    selectedCardSetIds: [],
    customAiQuestions: [],
  }), []);

  const [draft, setDraft, draftControls] = useActivityDraft<QuestionGeneratorDraft>(
    buildDraftStorageKey(classId, "question_generator"),
    initialDraft
  );

  useEffect(() => {
    let active = true;
    getQuestionCardSettings().then((cardResult) => {
      if (!active) return;
      if (cardResult.error) setError(cardResult.error);
      else {
        setAvailableCardSets(cardResult.cardSets);
        // 최초 로드 시에만 기본 3개 카드 세트 자동 선택 (한 번만 실행)
        if (!initializedRef.current) {
          initializedRef.current = true;
          setDraft((prev) => {
            if (prev.selectedCardSetIds.length === 0 && prev.mode === "card_remix") {
              const defaultIds = cardResult.cardSets.slice(0, 3).map((cs) => cs.id);
              return { ...prev, selectedCardSetIds: defaultIds };
            }
            return prev;
          });
        }
      }
      setLoadingCardSets(false);
    });
    return () => { active = false; };
  }, [classId, setDraft]);

  // AI 질문 예시 생성 핸들러
  async function handleGenerateAiQuestions() {
    if (!draft.topic.trim()) {
      setAiGenError("활동 주제를 먼저 입력해주세요.");
      return;
    }
    setAiGenError("");
    setGeneratingAi(true);
    const res = await generateQuestionsWithAI(draft.topic, draft.topic_description, aiCount);
    setGeneratingAi(false);

    if (res.error) {
      setAiGenError(res.error);
      return;
    }

    if (res.questions && res.questions.length > 0) {
      const newItems = res.questions.map((q, i) => ({
        id: `ai-q-${Date.now()}-${i}`,
        text: q,
        included: true,
      }));
      setDraft((prev) => ({
        ...prev,
        customAiQuestions: [...prev.customAiQuestions, ...newItems],
      }));
    }
  }

  // AI 질문 직접 추가
  function handleAddCustomQuestion() {
    const newId = `custom-q-${Date.now()}`;
    setDraft((prev) => ({
      ...prev,
      customAiQuestions: [
        ...prev.customAiQuestions,
        { id: newId, text: "무엇을 살펴보고 어떤 질문을 만들지 안내하는 문장을 쓰세요. 예) ~을(를) 떠올려 보고, 그것을 묻는 질문을 만들어 보세요.", included: true },
      ],
    }));
  }

  // 폼 제출 — 시작 조건은 방식마다 다르다(서버 판정과 같은 규칙: question-generator/config.ts).
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.topic.trim()) {
      setError("활동 주제를 입력해주세요.");
      return;
    }

    const activeAiQuestions = draft.customAiQuestions.filter((q) => q.included && q.text.trim());

    if (draft.mode === "card_remix" && draft.selectedCardSetIds.length === 0) {
      setError("제공할 질문 카드 묶음을 1개 이상 선택해주세요.");
      return;
    }

    if (draft.mode === "ai_custom" && activeAiQuestions.length === 0) {
      setError("학생에게 보여 줄 질문 카드를 1개 이상 만들거나 선택해주세요.");
      return;
    }

    setError("");
    setSaving(true);

    const fd = new FormData();
    fd.set("activity_type", "question_generator");
    fd.set("title", draft.topic.trim());
    fd.set("topic", draft.topic.trim());
    fd.set("topic_description", draft.topic_description.trim());
    if (classId) fd.set("class_id", classId);

    // 카드 내용은 서버가 교사 설정에서 다시 채운다 — 화면은 무엇을 골랐는지만 보낸다.
    fd.set(
      "activity_config",
      JSON.stringify({
        mode: draft.mode,
        enabledCardSetIds: draft.mode === "card_remix" ? draft.selectedCardSetIds : [],
        minSelections: Number(draft.min_selections) || 1,
        maxSelections: Number(draft.max_selections) || 1,
        guidance: draft.guidance.trim(),
        customAiQuestions: draft.mode === "ai_custom"
          ? activeAiQuestions.map((q) => ({ id: q.id, text: q.text.trim(), included: true }))
          : [],
      })
    );

    const result = await createRoom(fd);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      try {
        localStorage.removeItem(buildDraftStorageKey(classId, "question_generator"));
      } catch {}
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. 기본 정보 */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <span className="text-xl">📌</span>
            <h2 className="text-base font-bold text-gray-800">활동 기본 정보</h2>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              활동 주제 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="예) 우리 동네의 소중한 장소들, 미래의 인공지능과 우리 삶"
              value={draft.topic}
              onChange={(e) => setDraft((p) => ({ ...p, topic: e.target.value }))}
              className="w-full px-4 py-3 text-base text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              주제 부연 설명 <span className="text-xs text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              rows={2}
              placeholder="학생들이 활동을 시작할 때 참고할 추가 설명이나 배경을 적어주세요."
              value={draft.topic_description}
              onChange={(e) => setDraft((p) => ({ ...p, topic_description: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
            />
          </div>
        </div>

        {/* 2. 질문 작성 방식 선택 (3대 모드) */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <div>
                <h2 className="text-base font-bold text-gray-800">질문 작성 방식 선택</h2>
                <p className="text-xs text-gray-500 mt-0.5">학생들에게 어떤 방식으로 질문을 만들게 할지 선택하세요.</p>
              </div>
            </div>
          </div>

          {/* 3대 선택 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 모드 1: 직접 만들기 */}
            <label
              className={`rounded-2xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                draft.mode === "direct"
                  ? "border-sky-500 bg-sky-50/70 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">✍️</span>
                  <input
                    type="radio"
                    name="generator_mode"
                    value="direct"
                    checked={draft.mode === "direct"}
                    onChange={() => setDraft((p) => ({ ...p, mode: "direct" }))}
                    className="text-sky-500"
                  />
                </div>
                <h3 className="mt-2.5 text-base font-bold text-gray-800">1. 직접 만들기</h3>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  카드 힌트 없이 학생이 스스로 생각해서 질문을 작성합니다.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-sky-700 bg-white px-2.5 py-1 rounded-lg border border-sky-100 text-center">
                자율 질문 창작
              </span>
            </label>

            {/* 모드 2: 질문 카드 활용 */}
            <label
              className={`rounded-2xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                draft.mode === "card_remix"
                  ? "border-violet-500 bg-violet-50/70 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🃏</span>
                  <input
                    type="radio"
                    name="generator_mode"
                    value="card_remix"
                    checked={draft.mode === "card_remix"}
                    onChange={() => setDraft((p) => ({
                      ...p,
                      mode: "card_remix",
                      // 카드 방식으로 바꾸면 고른 묶음이 없을 때 기본 3개를 미리 담아 준다.
                      selectedCardSetIds: p.selectedCardSetIds.length > 0
                        ? p.selectedCardSetIds
                        : availableCardSets.slice(0, 3).map((cardSet) => cardSet.id),
                    }))}
                    className="text-violet-500"
                  />
                </div>
                <h3 className="mt-2.5 text-base font-bold text-gray-800">2. 질문 카드 활용</h3>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  생각을 넓혀주는 질문 카드 묶음을 제공해 골라서 수정합니다.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-violet-700 bg-white px-2.5 py-1 rounded-lg border border-violet-100 text-center">
                비계(Scaffolding) 카드 제공
              </span>
            </label>

            {/* 모드 3: AI 질문 예시 제공 */}
            <label
              className={`rounded-2xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                draft.mode === "ai_custom"
                  ? "border-emerald-500 bg-emerald-50/70 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">✨</span>
                  <input
                    type="radio"
                    name="generator_mode"
                    value="ai_custom"
                    checked={draft.mode === "ai_custom"}
                    onChange={() => setDraft((p) => ({ ...p, mode: "ai_custom" }))}
                    className="text-emerald-500"
                  />
                </div>
                <h3 className="mt-2.5 text-base font-bold text-gray-800">3. AI 질문 카드 만들기</h3>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  오늘 주제에 맞는 <strong>질문 카드</strong>(완성된 질문이 아니라 관점을 여는 문장)를 AI가 만들어 줍니다.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 text-center">
주제 맞춤 질문 카드
              </span>
            </label>
          </div>

          {/* ── 선택된 모드별 전용 서브 패널 ── */}

          {/* 모드 1: 직접 만들기 상세 설정 */}
          {draft.mode === "direct" && (
            <div className="rounded-2xl bg-sky-50/60 border border-sky-100 p-4 space-y-2.5">
              <label className="block text-xs font-bold text-sky-800">
                ✍️ 학생에게 전달할 질문 작성 가이드 <span className="text-[11px] font-normal text-sky-600">(선택)</span>
              </label>
              <textarea
                rows={3}
                value={draft.guidance}
                onChange={(e) => setDraft((p) => ({ ...p, guidance: e.target.value }))}
                placeholder="학생들이 질문을 만들 때 참고할 안내나 유의사항을 입력하세요."
                className="w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-sky-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <p className="text-[11px] text-sky-600">
                학생들은 카드 힌트 없이 입력창에서 바로 자신만의 질문을 작성하게 됩니다.
              </p>
            </div>
          )}

          {/* 모드 2: 질문 카드 활용 상세 설정 */}
          {draft.mode === "card_remix" && (
            <div className="rounded-2xl bg-violet-50/60 border border-violet-100 p-4 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-bold text-violet-800">🃏 제공할 질문 카드 묶음 선택</p>
                  <p className="text-[11px] text-violet-600 mt-0.5">
                    총 {availableCardSets.length}개 묶음 중 {draft.selectedCardSetIds.length}개 선택됨
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {/* 마음에 드는 카드가 없으면 여기서 바로 만든다 — 설정 화면으로 나가지 않는다. */}
                  <button
                    type="button"
                    onClick={() => setCreatingCardSet(true)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                  >
                    ＋ 질문 카드 만들기
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, selectedCardSetIds: availableCardSets.map((c) => c.id) }))}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, selectedCardSetIds: [] }))}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              {/* 카드 묶음 칩 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {availableCardSets.map((cs) => {
                  const checked = draft.selectedCardSetIds.includes(cs.id);
                  return (
                    <div
                      key={cs.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                        checked
                          ? "bg-white border-violet-400 shadow-2xs"
                          : "bg-white/60 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setDraft((p) => ({
                              ...p,
                              selectedCardSetIds: isChecked
                                ? [...p.selectedCardSetIds, cs.id]
                                : p.selectedCardSetIds.filter((id) => id !== cs.id),
                            }));
                          }}
                          className="text-violet-600 rounded shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getCardBadgeStyle(cs.label)}`}>
                              {getCardBadge(cs.label)}
                            </span>
                            <p className={`truncate font-bold text-xs ${checked ? "text-violet-950" : "text-gray-800"}`}>
                              {cs.label}
                            </p>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{cs.description || `${cs.prompts.length}개 질문 힌트`}</p>
                        </div>
                      </label>

                      {/* 세부 내용 모달 열기 버튼 */}
                      <button
                        type="button"
                        onClick={() => setModalTargetCardSet(cs)}
                        className="shrink-0 text-[11px] font-medium text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors"
                        title="질문 세부 내용 보기"
                      >
                        👁️ 보기
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 모드 3: AI 질문 예시 제공 상세 설정 */}
          {draft.mode === "ai_custom" && (
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <p className="text-xs font-bold text-emerald-800">✨ AI 질문 카드 고르기</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    고른 카드가 학생 화면에 그대로 보입니다. 학생은 카드를 힌트 삼아 <strong>자기 질문</strong>을 씁니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* AI 생성 개수 선택기 */}
                  <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-xl px-2 py-1 text-xs">
                    <span className="text-gray-500 font-medium">개수:</span>
                    {[3, 5, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAiCount(num)}
                        className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                          aiCount === num
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAiQuestions}
                    disabled={generatingAi}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {generatingAi ? "🧠 생성 중..." : `✨ AI 질문 카드 ${aiCount}개 만들기`}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomQuestion}
                    className="rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    + 직접 추가
                  </button>
                </div>
              </div>

              {aiGenError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg">{aiGenError}</p>
              )}

              {/* AI 질문 목록 */}
              {draft.customAiQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-6 text-center">
                  <p className="text-sm font-semibold text-emerald-800">아직 추천된 질문이 없습니다.</p>
                  <p className="mt-1 text-xs text-gray-500">
                    위의 <strong>[✨ AI 질문 카드 {aiCount}개 만들기]</strong> 버튼을 누르면 오늘 주제에 맞는 질문 카드가 만들어집니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {draft.customAiQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                        q.included
                          ? "bg-white border-emerald-300 shadow-2xs"
                          : "bg-gray-50 border-gray-200 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={q.included}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDraft((p) => ({
                            ...p,
                            customAiQuestions: p.customAiQuestions.map((item) =>
                              item.id === q.id ? { ...item, included: checked } : item
                            ),
                          }));
                        }}
                        className="mt-1 text-emerald-600 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-emerald-700">질문 카드 {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDraft((p) => ({
                                ...p,
                                customAiQuestions: p.customAiQuestions.filter((item) => item.id !== q.id),
                              }));
                            }}
                            className="text-[10px] text-gray-400 hover:text-red-500"
                          >
                            삭제
                          </button>
                        </div>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((p) => ({
                              ...p,
                              customAiQuestions: p.customAiQuestions.map((item) =>
                                item.id === q.id ? { ...item, text: val } : item
                              ),
                            }));
                          }}
                          className="w-full text-xs text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. 공통 설정 (질문 개수)
            목표와 최소를 따로 정한다. 한 값으로 두면 "3개가 목표지만 시간이 모자라면 2개라도 인정"을
            표현할 수 없다 — 그것이 실제 수업에서 필요한 경우다. */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <label className="block text-sm font-bold text-gray-800">목표 질문 수</label>
              <p className="text-xs text-gray-500 mt-0.5">학생 화면에 이만큼 칸이 생깁니다.</p>
            </div>

            <div className="flex gap-2">
              {QUESTION_SELECTION_CHOICES.map((count) => (
                <label
                  key={count}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-bold cursor-pointer transition-all ${
                    draft.max_selections === String(count)
                      ? "border-sky-500 bg-sky-50 text-sky-700 shadow-2xs"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="max_selections"
                    value={count}
                    checked={draft.max_selections === String(count)}
                    onChange={() => setDraft((p) => {
                      // 목표를 줄이면 최소가 목표를 넘을 수 있다. 함께 끌어내린다.
                      const nextMax = count;
                      const nextMin = Math.min(Number(p.min_selections) || 1, nextMax);
                      return { ...p, max_selections: String(nextMax), min_selections: String(nextMin) };
                    })}
                    className="sr-only"
                  />
                  {count}개
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-5">
            <div>
              <label className="block text-sm font-bold text-gray-800">제출에 필요한 최소 개수</label>
              <p className="text-xs text-gray-500 mt-0.5">
                시간이 모자라 목표를 다 못 채워도 이만큼이면 낼 수 있습니다.
              </p>
            </div>

            <div className="flex gap-2">
              {QUESTION_SELECTION_CHOICES.map((count) => {
                const goal = Number(draft.max_selections) || 1;
                const disabled = count > goal;
                return (
                  <label
                    key={count}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                      disabled
                        ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                        : draft.min_selections === String(count)
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-2xs cursor-pointer"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="min_selections"
                      value={count}
                      disabled={disabled}
                      checked={draft.min_selections === String(count)}
                      onChange={() => setDraft((p) => ({ ...p, min_selections: String(count) }))}
                      className="sr-only"
                    />
                    {count}개
                  </label>
                );
              })}
            </div>
          </div>

          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {Number(draft.min_selections) >= Number(draft.max_selections)
              ? `학생은 ${draft.max_selections}개를 모두 만들어야 제출할 수 있어요.`
              : `학생은 ${draft.max_selections}개를 목표로 만들고, ${draft.min_selections}개만 채워도 제출할 수 있어요.`}
          </p>
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl font-medium">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-bold text-lg shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? "활동 생성 중..." : "🚀 질문 만들기 활동 시작"}
        </button>
      </form>

      {/* 새 질문 카드 만들기 — 만들면 곧바로 목록에 담기고 선택된다. */}
      {creatingCardSet && (
        <NewCardSetModal
          topic={draft.topic}
          topicDescription={draft.topic_description}
          nextSortOrder={availableCardSets.length}
          onClose={() => setCreatingCardSet(false)}
          onCreated={(cardSet) => {
            setAvailableCardSets((prev) => [...prev, cardSet]);
            setDraft((p) => ({ ...p, selectedCardSetIds: [...p.selectedCardSetIds, cardSet.id] }));
            setCreatingCardSet(false);
          }}
        />
      )}

      {/* 질문 카드 세부내용 모달 팝업 */}
      {modalTargetCardSet && (
        <CardSetDetailModal
          cardSet={modalTargetCardSet}
          onClose={() => setModalTargetCardSet(null)}
        />
      )}
    </>
  );
}

/**
 * 활동을 만들다가 마음에 드는 질문 카드가 없을 때, 그 자리에서 새 카드 묶음을 만든다.
 * 저장하면 교사 설정(질문 카드 보관함)에도 남아 다음 활동에서 다시 쓸 수 있다.
 */
function NewCardSetModal({
  topic,
  topicDescription,
  nextSortOrder,
  onClose,
  onCreated,
}: {
  topic: string;
  topicDescription: string;
  nextSortOrder: number;
  onClose: () => void;
  onCreated: (cardSet: QuestionCardSet) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const prompts = promptText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const area = getQuestionAreaByCardLabel(label || "기타");

  async function handleGenerate() {
    if (!topic.trim()) {
      setError("먼저 위쪽에 활동 주제를 입력해 주세요. 주제에 맞춰 카드를 만듭니다.");
      return;
    }
    setError("");
    setGenerating(true);
    const result = await generateQuestionsWithAI(topic, topicDescription, 5);
    setGenerating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const generated = (result.questions ?? []).join("\n");
    setPromptText((current) => (current.trim() ? `${current.trim()}\n${generated}` : generated));
  }

  async function handleSave() {
    if (!label.trim()) {
      setError("카드 묶음 이름을 입력해 주세요.");
      return;
    }
    if (prompts.length === 0) {
      setError("질문 카드 문장을 한 줄에 하나씩 1개 이상 입력해 주세요.");
      return;
    }
    setError("");
    setSaving(true);
    const result = await saveQuestionCardSetting({
      label: label.trim(),
      description: description.trim(),
      prompts,
      sortOrder: nextSortOrder,
    });
    setSaving(false);
    if (result.error || !result.cardSet) {
      setError(result.error ?? "카드를 저장하지 못했습니다.");
      return;
    }
    onCreated(result.cardSet);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <div>
              <h3 className="text-base font-bold text-gray-900">새 질문 카드 만들기</h3>
              <p className="text-xs text-gray-500">완성된 질문이 아니라, 학생이 질문을 만들 관점을 주는 문장을 씁니다.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-xl font-bold text-gray-400 hover:bg-white/60 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">카드 묶음 이름 *</label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="예) 상상, 마음, 감각"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${area.chip.bg} ${area.chip.text} ${area.chip.border}`}>
                <span>{area.emoji}</span>
                <span>{area.label} 카테고리로 묶여요</span>
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">설명 <span className="font-normal text-gray-400">(선택)</span></label>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="학생 화면에 함께 보이는 한 줄 설명"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-700">질문 카드 문장 * <span className="font-normal text-gray-400">(한 줄에 하나 · {prompts.length}장)</span></label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {generating ? "🧠 만드는 중..." : "✨ AI로 5장 만들기"}
              </button>
            </div>
            <textarea
              rows={7}
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              placeholder={"예) 이야기가 끝난 다음 날 주인공에게 무슨 일이 생길지 상상해 보고, 그것을 묻는 질문을 만들어 보세요.\n예) 가장 또렷이 떠오르는 장면을 고르고, 그곳에서 어떤 소리가 들렸을지 묻는 질문을 만들어 보세요."}
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <p className="mt-1.5 text-[11px] text-gray-500">
              학생은 이 문장을 힌트로 읽고 <strong>자기 질문</strong>을 씁니다. 물음표로 끝나는 완성된 질문은 그대로 베끼게 되니 피해 주세요.
            </p>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3.5">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100">
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "만들고 이 활동에 넣기"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardSetDetailModal({
  cardSet,
  onClose,
}: {
  cardSet: QuestionCardSet;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">{cardSet.label}</h3>
              <p className="text-xs text-gray-500">{cardSet.description || "질문 카드 묶음"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold p-1 rounded-lg hover:bg-white/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          <p className="text-xs font-bold text-gray-600 mb-2">
            포함된 질문 힌트 목록 ({cardSet.prompts.length}개)
          </p>
          {cardSet.prompts.map((prompt, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 flex items-start gap-3"
            >
              <BadgeCircle size="sm" className="bg-violet-100 text-violet-700">
                {idx + 1}
              </BadgeCircle>
              <p className="text-xs text-gray-800 leading-relaxed font-medium flex-1">
                {prompt}
              </p>
            </div>
          ))}
        </div>

        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-all"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
}


function mergeVotingQuestions(
  prev: VotingQuestionDraft[],
  source: Array<{ id: string; text: string; sourceSessionId?: string; sourceSelectionId?: string }>,
): VotingQuestionDraft[] {
  const prevById = new Map(prev.map((question) => [question.id, question] as const));
  return source.map((question) => {
    const existing = prevById.get(question.id);
    if (existing) {
      return {
        ...existing,
        sourceSessionId: existing.sourceSessionId ?? question.sourceSessionId,
        sourceSelectionId: existing.sourceSelectionId ?? question.sourceSelectionId,
      };
    }
    return {
      id: question.id,
      text: question.text,
      included: false,
      sourceSessionId: question.sourceSessionId,
      sourceSelectionId: question.sourceSelectionId,
    };
  });
}

function QuestionVotingSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceRooms, setSourceRooms] = useState<QuestionGeneratorSourceRoomSummary[]>([]);
  const [loadingSourceRooms, setLoadingSourceRooms] = useState(true);
  const initialDraft = useMemo<QuestionVotingDraft>(() => ({
        max_selections: "1",
    evaluation_criteria: "생각이 더 이어지는 질문\n친구가 더 이야기하고 싶어지는 질문",
    source_room_id: "",
    source_room_title: "",
    source_room_topic: "",
    voting_questions: [],
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<QuestionVotingDraft>(
    buildDraftStorageKey(classId, "question_voting"),
    initialDraft
  );

  useEffect(() => {
    let active = true;

    getQuestionGeneratorSourceRooms(classId).then((rooms) => {
      if (!active) return;
      setSourceRooms(rooms);
      setDraft((prev) => {
        const nextRoomId = prev.source_room_id || rooms[0]?.roomId || "";
        const nextRoom = rooms.find((room) => room.roomId === nextRoomId) ?? null;
        return {
          ...prev,
          source_room_id: nextRoomId,
          source_room_title: prev.source_room_title || nextRoom?.title || "",
          source_room_topic: prev.source_room_topic || nextRoom?.topic || "",
          voting_questions: mergeVotingQuestions(prev.voting_questions, nextRoom?.questions ?? []),
        };
      });
      setLoadingSourceRooms(false);
    });

    return () => {
      active = false;
    };
  }, [classId, setDraft]);

  const selectedSourceRoom = sourceRooms.find((room) => room.roomId === draft.source_room_id) ?? null;
  const votingQuestions = draft.voting_questions;
  const includedQuestionCount = votingQuestions.reduce((total, question) => total + (question.included && question.text.trim().length > 0 ? 1 : 0), 0);
  const sourceRoomQuestionCount = selectedSourceRoom?.questions.length ?? votingQuestions.length;
  const maxAllowedSelections = Math.max(includedQuestionCount, 1);
  const desiredMaxSelections = Number(draft.max_selections);
  const effectiveMaxSelections = Number.isFinite(desiredMaxSelections) && desiredMaxSelections > 0
    ? Math.min(desiredMaxSelections, maxAllowedSelections)
    : 1;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.source_room_id) {
      setError("평가에 사용할 질문 만들기 활동을 먼저 골라주세요.");
      return;
    }
    const selectedQuestions = draft.voting_questions
      .filter((question) => question.included && question.text.trim().length > 0)
      .map((question) => ({ id: question.id, text: question.text.trim() }));
    if (selectedQuestions.length === 0) {
      setError("고르기에 올릴 질문을 1개 이상 선택해주세요.");
      return;
    }
    const votingQuestionsPayload = draft.voting_questions.map((question) => ({
      id: question.id,
      text: question.text.trim(),
      included: question.included,
      sourceSessionId: question.sourceSessionId,
      sourceSelectionId: question.sourceSelectionId,
    }));
    setSaving(true);
    setError("");
    const storageKey = buildDraftStorageKey(classId, "question_voting");
    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("activity_type", "question_voting");
    fd.set("max_selections", String(Math.min(effectiveMaxSelections, selectedQuestions.length)));
    fd.set("selected_questions", JSON.stringify(selectedQuestions));
    fd.set("voting_questions", JSON.stringify(votingQuestionsPayload));
    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setError(result.error);
      setSaving(false);
      return;
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 mb-6 text-sm text-amber-800">
        학생들이 질문 후보를 읽고, 가장 좋은 질문을 선택하는 토의형 활동입니다.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="activity_type" value="question_voting" />

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="block text-base font-medium text-gray-700">질문 가져오기</label>
            <span className="text-xs text-gray-400">질문 만들기 활동 결과를 그대로 평가에 사용해요</span>
          </div>
          {loadingSourceRooms ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-700">
              질문 만들기 활동 목록을 불러오고 있어요...
            </div>
          ) : sourceRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 px-4 py-5 text-sm text-amber-700">
              아직 같은 학급에서 제출이 끝난 질문 만들기 활동이 없어요. 먼저 질문 만들기 활동을 진행해 주세요.
            </div>
          ) : (
            <div className="grid gap-3">
              {sourceRooms.map((room) => {
                const selected = room.roomId === draft.source_room_id;
                return (
                  <button
                    key={room.roomId}
                    type="button"
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      source_room_id: room.roomId,
                      source_room_title: room.title,
                      source_room_topic: room.topic,
                      voting_questions: prev.source_room_id === room.roomId
                        ? prev.voting_questions
                        : mergeVotingQuestions([], room.questions),
                    }))}
                    className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                      selected
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-500">질문 만들기 결과</p>
                        <h3 className="mt-1 text-base font-bold text-gray-800">{room.title}</h3>
                        <p className="mt-1 text-sm text-gray-500">주제: {room.topic}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                        질문 {room.questionCount}개
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      {new Date(room.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedSourceRoom && votingQuestions.length > 0 && (
          <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
            <div className="sticky top-0 -mx-5 -mt-5 mb-4 rounded-t-3xl bg-amber-50/95 px-5 py-4 backdrop-blur z-10 border-b border-amber-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-500">고르기에 올릴 질문</p>
                  <h3 className="mt-1 text-base font-bold text-gray-800">{selectedSourceRoom.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">기본은 모두 제외 상태예요. 학생들과 함께 읽고 필요한 질문만 체크해서 활동에 올려주세요. (편집한 질문은 학생 활동 결과에도 반영됩니다)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-700">
                    {includedQuestionCount} / {sourceRoomQuestionCount}개 선택
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => {
                      const allIncluded = prev.voting_questions.every((question) => question.included);
                      return {
                        ...prev,
                        voting_questions: prev.voting_questions.map((question) => ({ ...question, included: !allIncluded })),
                      };
                    })}
                    className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-amber-700 border border-amber-200 hover:bg-amber-100"
                  >
                    {votingQuestions.every((question) => question.included) ? "모두 해제" : "모두 선택"}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {votingQuestions.map((question, index) => (
                <div
                  key={question.id}
                  className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition-colors ${
                    question.included
                      ? "border-amber-400 bg-amber-50/70 shadow-sm"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <label className="flex items-center cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={question.included}
                      onChange={(event) => {
                        const nextIncluded = event.target.checked;
                        setDraft((prev) => ({
                          ...prev,
                          voting_questions: prev.voting_questions.map((entry) =>
                            entry.id === question.id ? { ...entry, included: nextIncluded } : entry
                          ),
                        }));
                      }}
                      className="h-6 w-6 accent-amber-500 cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold ${question.included ? "text-amber-700" : "text-gray-500"}`}>
                        질문 {index + 1}
                      </span>
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                        question.included
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {question.included ? "선택됨" : "제외됨"}
                      </span>
                    </div>
                    <textarea
                      value={question.text}
                      rows={Math.max(2, Math.ceil(question.text.length / 40))}
                      onChange={(event) => {
                        const nextText = event.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          voting_questions: prev.voting_questions.map((entry) =>
                            entry.id === question.id ? { ...entry, text: nextText } : entry
                          ),
                        }));
                      }}
                      className={`mt-2 w-full resize-y bg-transparent leading-relaxed text-gray-900 placeholder:text-gray-300 focus:outline-none border-0 rounded-xl px-2 py-1 ${
                        question.included
                          ? "text-lg font-semibold focus:bg-white/80"
                          : "text-base focus:bg-amber-50/60"
                      }`}
                      placeholder="질문을 적어주세요."
                    />
                  </div>
                </div>
              ))}
            </div>
            {includedQuestionCount === 0 && (
              <p className="mt-3 text-sm text-red-500">최소 1개 이상의 질문을 선택해주세요.</p>
            )}
          </div>
        )}

        <input type="hidden" name="source_room_id" value={draft.source_room_id} />

        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">좋은 질문의 기준</label>
          <textarea
            name="evaluation_criteria"
            rows={4}
            value={draft.evaluation_criteria}
            onChange={(event) => setDraft((prev) => ({ ...prev, evaluation_criteria: event.target.value }))}
            className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            placeholder={"좋은 질문 기준을 한 줄에 하나씩 적어주세요.\n예)\n생각이 더 이어지는 질문\n친구가 더 말해보고 싶어지는 질문"}
          />
          <p className="text-xs text-gray-400 mt-2">학생은 이 기준을 보면서 익명 질문을 읽고 좋은 질문을 고르게 됩니다.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">학생당 선택 개수 (1~10개)</label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => {
                const disabled = count > maxAllowedSelections;
                return (
                  <label
                    key={count}
                    className={`flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-2 py-3 ${
                      disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "cursor-pointer has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="max_selections"
                      value={count}
                      checked={String(effectiveMaxSelections) === String(count)}
                      disabled={disabled}
                      onChange={() => setDraft((prev) => ({ ...prev, max_selections: String(count) }))}
                      className="text-amber-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{count}개</span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={saving || loadingSourceRooms || sourceRooms.length === 0 || includedQuestionCount === 0}
          className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {loadingSourceRooms ? "질문 목록 불러오는 중..." : saving ? "시작 중..." : "🚀 좋은 질문 고르기 활동 시작"}
        </button>
      </form>
    </>
  );
}

function OneLineShareSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const initialDraft = useMemo<OneLineShareDraft>(() => ({
    topic: "핵심단어 문장 만들기",
    topic_description: "제시된 핵심단어를 포함하여 자유롭게 멋진 문장을 작성해 보세요.",
    core_keywords: "",
    auxiliary_keywords: "",
    max_reactions_per_student: "3",
      }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<OneLineShareDraft>(
    buildDraftStorageKey(classId, "one_line_share"),
    initialDraft,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const storageKey = buildDraftStorageKey(classId, "one_line_share");
    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("activity_type", "one_line_share");
    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setError(result.error);
      setSaving(false);
      return;
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 mb-6 text-sm text-rose-800 leading-relaxed">
        선생님이 제시한 핵심단어를 포함하여 문장을 작성하고, 친구들의 문장에 좋아요(하트)를 보내며 생각을 나누는 활동입니다. 꼭 한 줄이 아니어도 여러 문장으로 자유롭게 작성할 수 있습니다.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="activity_type" value="one_line_share" />

        <TopicFields
          values={{
            topic: draft.topic,
            topic_description: draft.topic_description,
          }}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          hint="학생에게 보일 활동 제목과 설명입니다. 제시된 핵심단어를 포함하여 자유롭게 문장을 쓰도록 안내해 주세요."
          placeholder="예) 제시된 핵심단어를 모두 넣어 알맞은 문장을 자유롭게 써 보세요."
          savedAt={draftControls.savedAt}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[11px] font-bold">필수</span>
                핵심단어
              </span>
            </label>
            <textarea
              name="core_keywords"
              required
              rows={4}
              value={draft.core_keywords}
              onChange={(event) => setDraft((prev) => ({ ...prev, core_keywords: event.target.value }))}
              placeholder={"한 줄에 하나씩 또는 쉼표로 적어주세요.\n예)\n증발\n물의 순환"}
              className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border-2 border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
            />
            <p className="text-xs text-rose-500 mt-2">학생은 핵심단어를 모두 포함해서 한 줄을 써야 제출할 수 있습니다.</p>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-[11px] font-bold">선택</span>
                보조단어
              </span>
            </label>
            <textarea
              name="auxiliary_keywords"
              rows={4}
              value={draft.auxiliary_keywords}
              onChange={(event) => setDraft((prev) => ({ ...prev, auxiliary_keywords: event.target.value }))}
              placeholder={"활용 가능한 단어를 한 줄에 하나씩.\n예)\n바다\n구름\n비"}
              className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-2">참고용으로 보여줄 단어. 꼭 포함하지 않아도 괜찮아요.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">학생당 좋아요 개수</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <label
                  key={count}
                  className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-3 py-3 cursor-pointer has-[:checked]:border-rose-400 has-[:checked]:bg-rose-50"
                >
                  <input
                    type="radio"
                    name="max_reactions_per_student"
                    value={count}
                    checked={draft.max_reactions_per_student === String(count)}
                    onChange={() => setDraft((prev) => ({ ...prev, max_reactions_per_student: String(count) }))}
                    className="text-rose-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{count}개</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold text-lg hover:bg-rose-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "시작 중..." : "🚀 한줄모아 활동 시작"}
        </button>
      </form>
    </>
  );
}



// `한자 활용 문장 만들기` 활동 설정 화면은 2026-08-19에 지웠고 한자 단어집 화면도
// 2026-08-21에 제거했다. 과거 활동 결과와 저장 카드 데이터의 서버 호환은 유지한다.
// 학년별 추천 단어 목록까지 갖춘 원래 화면이 필요하면 git 이력에서 꺼낸다.

function TopicFields({
  values,
  onChange,
  hint,
  placeholder,
  savedAt,
  descriptionRequired = false,
}: {
  values: {
    topic: string;
    topic_description: string;
  };
  onChange: (patch: { topic?: string; topic_description?: string }) => void;
  hint: string;
  placeholder: string;
  savedAt: number | null;
  descriptionRequired?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-base font-medium text-gray-700 mb-2">활동 주제</label>
        <input
          name="topic"
          required
          value={values.topic}
          onChange={(event) => onChange({ topic: event.target.value })}
          placeholder="예) 소풍, 이야기 속 선택, 오늘 배운 점"
          className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <div>
	        <label className="block text-base font-medium text-gray-700 mb-1">
	          주제 부연 설명
	          {!descriptionRequired && <span className="ml-2 text-sm font-normal text-gray-400">(선택)</span>}
	        </label>
	        <textarea
	          name="topic_description"
	          required={descriptionRequired}
	          rows={3}
          value={values.topic_description}
          onChange={(event) => onChange({ topic_description: event.target.value })}
          placeholder={placeholder}
          className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
	        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
	          <span className="text-amber-500 text-base shrink-0 mt-0.5">💡</span>
	          <p className="text-sm text-amber-700 leading-relaxed">{hint}</p>
	        </div>
        <p className="mt-2 text-xs font-medium text-emerald-600">
          {savedAt
            ? `자동 저장됨 · ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "입력하면 자동 저장됩니다."}
        </p>
      </div>
    </div>
  );
}

function NewRoomForm() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("class_id") ?? "";
  const activityType = useMemo(() => parseActivityType(searchParams.get("activity_type")), [searchParams]);

  if (!activityType) {
    return <ActivitySelectionScreen classId={classId} />;
  }

  return (
    <PageShell classId={classId} activityType={activityType}>
      {activityType === "outline_builder" && <OutlineBuilderSetup classId={classId} />}
      {activityType === "question_generator" && <QuestionGeneratorSetup classId={classId} />}
      {activityType === "question_voting" && <QuestionVotingSetup classId={classId} />}
      {activityType === "one_line_share" && <OneLineShareSetup classId={classId} />}
      {/* 한자 활용 문장 만들기는 새로 만들지 않는다(2026-08-19). 주소로 직접 들어와도 열리지 않게
          설정 화면 연결을 끊는다. 이미 만든 방과 학생 기록은 그대로 열린다. */}
    </PageShell>
  );
}

export default function NewRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <NewRoomForm />
    </Suspense>
  );
}

function parseActivityType(value: string | null): ActivityType | null {
  if (
    value === "outline_builder" ||
    value === "question_generator" ||
    value === "question_voting" ||
    value === "one_line_share" ||
    value === "hanja_writing"
  ) {
    return value;
  }
  return null;
}

function subjectLabel(type: string) {
  const map: Record<string, string> = {
    "생활문": "📖 생활문",
    "일기": "📓 일기",
    "편지": "✉️ 편지",
    "독서감상문": "📚 독서감상문",
    "기행문": "🗺️ 기행문",
    "관찰기록문": "🔬 관찰기록문",
    "이야기 글": "🌈 이야기 글",
    "설명하는 글": "🔍 설명하는 글",
    "주장하는 글": "💬 주장하는 글",
    "소개하는 글": "🙋 소개하는 글",
    "동시": "🎵 동시",
    "보고서": "📋 보고서",
  };
  return map[type] ?? type;
}

function gradeLabel(grade: string) {
  const map: Record<string, string> = {
    "저학년": "🌱 저학년",
    "중학년": "🌿 중학년",
    "고학년": "🌳 고학년",
  };
  return map[grade] ?? grade;
}
