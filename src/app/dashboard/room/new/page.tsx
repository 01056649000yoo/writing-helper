"use client";

import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createRoom,
  generateQuestionsPreview,
  getQuestionGeneratorSourceRooms,
  type QuestionGeneratorSourceRoomSummary,
} from "@/app/actions/room-actions";
import { getQuestionCardSettings } from "@/app/actions/settings-actions";
import { activityDefinitions, getActivityDefinition } from "@/features/activities/registry";
import type { ActivityType, QuestionCardSet } from "@/features/activities/types";
import {
  buildDraftStorageKey,
  clearActivityDraft,
  persistActivityDraft,
  readActivityDraft,
} from "@/lib/activity-drafts";
import type { QuestionSets, Question } from "@/types";

const SUBJECT_TYPES = [
  "생활문", "일기", "편지", "독서감상문", "기행문",
  "관찰기록문", "이야기 글", "설명하는 글", "주장하는 글",
  "소개하는 글", "동시", "보고서",
] as const;

type Step = "form" | "generating" | "preview" | "saving";
type Level = "low" | "mid" | "high";

type OutlineBuilderDraft = {
  topic: string;
  topic_description: string;
  subject_type: string;
  grade_level: string;
  outline_depth: string;
  duration_hours: string;
  generate_draft: boolean;
};

type QuestionGeneratorDraft = {
  topic: string;
  topic_description: string;
  duration_hours: string;
  max_selections: string;
  guidance: string;
  require_reason: boolean;
  selectedCardSetIds: string[];
};

type QuestionVotingDraft = {
  duration_hours: string;
  max_selections: string;
  evaluation_criteria: string;
  require_reason: boolean;
  source_room_id: string;
  source_room_title: string;
  source_room_topic: string;
};

type OneLineShareDraft = {
  topic: string;
  topic_description: string;
  keywords: string;
  max_reactions_per_student: string;
  duration_hours: string;
};

const DRAFT_SAVE_INTERVAL_MS = 5000;

const ACTIVITY_META: Record<ActivityType, { emoji: string; tone: string; summary: string }> = {
  outline_builder: {
    emoji: "📝",
    tone: "from-indigo-50 via-white to-blue-50",
    summary: "질문에 답하면서 글의 흐름을 잡고, AI가 개요를 정리해주는 활동",
  },
  question_generator: {
    emoji: "❓",
    tone: "from-emerald-50 via-white to-teal-50",
    summary: "직접 질문을 만들거나 질문 카드를 참고해 오늘 주제에 맞는 질문을 만드는 활동",
  },
  question_voting: {
    emoji: "🗳️",
    tone: "from-amber-50 via-white to-orange-50",
    summary: "질문 후보 중에서 가장 좋은 질문을 고르고 이유를 나누는 활동",
  },
  one_line_share: {
    emoji: "💬",
    tone: "from-rose-50 via-white to-pink-50",
    summary: "핵심단어를 넣은 한 문장을 나누고 친구 문장에 좋아요로 반응하는 활동",
  },
};

function QuestionCard({
  q,
  index,
  onChange,
  onRemove,
}: {
  q: Question;
  index: number;
  onChange: (updated: Question) => void;
  onRemove: () => void;
}) {
  const hasChoices = q.type === "card" || q.type === "card+input";

  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
          Q{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-400 text-lg leading-none"
          title="질문 삭제"
        >
          ×
        </button>
      </div>

      <textarea
        value={q.question}
        onChange={(e) => onChange({ ...q, question: e.target.value })}
        rows={2}
        className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        placeholder="질문 내용"
      />

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-xs text-gray-500">형식:</span>
        {(["card", "input", "card+input"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...q, type: t })}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              q.type === t
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
            }`}
          >
            {t === "card" ? "🃏 카드 선택" : t === "input" ? "✏️ 직접 입력" : "🃏✏️ 카드+입력"}
          </button>
        ))}
      </div>

      {hasChoices && (
        <div className="space-y-1">
          <span className="text-xs text-gray-500">선택지 (한 줄에 하나씩):</span>
          <textarea
            value={(q.choices ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                ...q,
                choices: e.target.value.split("\n"),
              })
            }
            rows={Math.max(10, (q.choices?.length ?? 0) + 1)}
            className="w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder={"보기 1\n보기 2\n보기 3"}
          />
        </div>
      )}

      <input
        type="text"
        value={q.hint ?? ""}
        onChange={(e) => onChange({ ...q, hint: e.target.value })}
        className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
        placeholder="힌트 (선택사항)"
      />
    </div>
  );
}

function LevelEditor({
  level,
  questions,
  onChange,
}: {
  level: Level;
  questions: Question[];
  onChange: (qs: Question[]) => void;
}) {
  function updateQ(i: number, updated: Question) {
    const next = [...questions];
    next[i] = updated;
    onChange(next);
  }

  function removeQ(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }

  function addQ() {
    onChange([
      ...questions,
      {
        step: questions.length + 1,
        question: "",
        type: level === "high" ? "input" : "card+input",
        choices: level !== "high" ? ["", ""] : undefined,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <QuestionCard
          key={i}
          q={q}
          index={i}
          onChange={(updated) => updateQ(i, updated)}
          onRemove={() => removeQ(i)}
        />
      ))}
      <button
        type="button"
        onClick={addQ}
        className="w-full py-2 border-2 border-dashed border-indigo-200 rounded-xl text-sm text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + 질문 추가
      </button>
    </div>
  );
}

const COMING_SOON_ACTIVITIES: {
  emoji: string;
  tone: string;
  label: string;
  badge: string;
  summary: string;
  effect: string;
  href?: string;
  status?: "testing";
}[] = [
  {
    emoji: "🔬",
    tone: "from-cyan-50 via-white to-sky-50",
    label: "[과학] 관찰하고 추론하기",
    badge: "실험 관찰 글쓰기",
    summary:
      "본 것(관찰) → 생각한 것(추론) → 궁금한 것(질문) 3단계 틀로 과학적 사고를 글로 옮기는 활동",
    effect: "단순 사실 나열을 넘어 과학적 사고력 훈련",
    href: "__science__",
    status: "testing",
  },
  {
    emoji: "🎭",
    tone: "from-violet-50 via-white to-purple-50",
    label: "[사회] 입장 바꿔 생각하기",
    badge: "역할 대입 글쓰기",
    summary:
      "사회·역사 속 인물이 되어 '내가 만약 ~라면?' 가정 아래 상황·선택·이유를 논리적으로 쓰는 활동",
    effect: "공감 능력과 비판적 사고력을 동시에 성장",
  },
  {
    emoji: "🔢",
    tone: "from-yellow-50 via-white to-amber-50",
    label: "[수학] 풀이 과정 설명하기",
    badge: "문장제 문제 정복",
    summary:
      "답이 아닌 '어떻게 풀었나, 왜 이 식을 세웠나'를 친구에게 설명하듯 글로 쓰는 활동",
    effect: "수학 개념 이해도를 스스로 점검하는 메타인지 훈련",
  },
  {
    emoji: "🪞",
    tone: "from-green-50 via-white to-emerald-50",
    label: "[도덕/국어] 마음 거울 비추기",
    badge: "감정·가치 글쓰기",
    summary:
      "오늘 배려·정직·용기 등 특정 가치와 연결된 순간을 포착해 당시 마음 상태를 구체적으로 묘사하는 활동",
    effect: "어휘력 향상과 정서 조절 능력 발달",
  },
];

function ActivitySelectionScreen({ classId }: { classId: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto py-4">
        <Link href={classId ? `/dashboard/class/${classId}` : "/dashboard"} className="text-indigo-500 text-sm hover:underline">
          ← {classId ? "학급으로" : "대시보드로"}
        </Link>

        <div className="mt-3 bg-white rounded-3xl shadow-xl border border-white/70 overflow-hidden">
          {/* 헤더 */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-indigo-600">Step 1</p>
                <h1 className="mt-0.5 text-xl font-bold text-gray-800">어떤 활동을 시작할까요?</h1>
              </div>
              <p className="text-xs text-gray-400">활동을 고르면 각 활동에 맞는 설정 화면이 열립니다</p>
            </div>
          </div>

          {/* 좌우 2-파트 레이아웃 */}
          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

            {/* ── 파트 1: 글쓰기 활동 꾸러미 ── */}
            <section className="flex-1 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">📦</span>
                  <h2 className="text-sm font-bold text-gray-800 truncate">글쓰기 활동 꾸러미</h2>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600">
                    {activityDefinitions.length}개
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">바로 사용</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {activityDefinitions.map((activity) => {
                  const meta = ACTIVITY_META[activity.id];
                  return (
                    <Link
                      key={activity.id}
                      href={`/dashboard/room/new?class_id=${classId}&activity_type=${activity.id}`}
                      className={`flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-br ${meta.tone} p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{meta.emoji}</span>
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-400 shadow-sm">
                          플러그인
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-gray-800">{activity.label}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500 flex-1 line-clamp-3">{meta.summary}</p>
                      <div className="mt-3 pt-2 border-t border-gray-100/80 flex justify-end">
                        <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full">
                          선택 →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* ── 파트 2: 과목별 글쓰기 활동 ── */}
            <section className="flex-1 p-5 bg-gray-50/60">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">📚</span>
                  <h2 className="text-sm font-bold text-gray-800 truncate">과목별 글쓰기 활동</h2>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600">
                    {COMING_SOON_ACTIVITIES.length}개
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">교과 연계</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {COMING_SOON_ACTIVITIES.map((activity) => {
                  const resolvedHref = activity.href === "__science__"
                    ? (classId ? `/dashboard/science/new?class_id=${classId}` : null)
                    : (activity.href ?? null);
                  const isTesting = activity.status === "testing";
                  return resolvedHref ? (
                    <Link
                      key={activity.label}
                      href={resolvedHref}
                      className={`flex flex-col rounded-2xl border bg-gradient-to-br ${activity.tone} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${isTesting ? "border-amber-200" : "border-cyan-200"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{activity.emoji}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ${isTesting ? "bg-amber-400" : "bg-cyan-500"}`}>
                          {isTesting ? "테스트 중" : "NEW"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-gray-800">{activity.label}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500 flex-1 line-clamp-3">{activity.summary}</p>
                      <div className={`mt-3 pt-2 flex justify-end ${isTesting ? "border-t border-amber-100/80" : "border-t border-cyan-100/80"}`}>
                        <span className={`inline-flex items-center gap-1 text-white text-[11px] font-semibold px-3 py-1 rounded-full ${isTesting ? "bg-amber-400" : "bg-cyan-500"}`}>
                          선택 →
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div
                      key={activity.label}
                      className={`flex flex-col rounded-2xl border border-gray-200/80 bg-gradient-to-br ${activity.tone} p-4 opacity-55 cursor-not-allowed`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{activity.emoji}</span>
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-amber-500 shadow-sm">
                          준비 중
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-gray-800">{activity.label}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500 flex-1 line-clamp-3">{activity.summary}</p>
                      <div className="mt-3 pt-2 border-t border-gray-100/80 flex justify-end">
                        <span className="inline-flex items-center gap-1 bg-gray-300 text-gray-500 text-[11px] font-semibold px-3 py-1 rounded-full">
                          곧 출시 →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto pt-8 pb-16">
        <div className="flex items-center justify-between gap-4">
          <Link href={classId ? `/dashboard/class/${classId}` : "/dashboard"} className="text-indigo-500 text-sm hover:underline">
            ← {classId ? "학급으로" : "대시보드로"}
          </Link>
          <Link href={`/dashboard/room/new?class_id=${classId}`} className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
            활동 다시 고르기
          </Link>
        </div>

        <div className="mt-4 bg-white rounded-[32px] shadow-xl overflow-hidden">
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
    </div>
  );
}

function DraftSection({
  title,
  description,
  onSave,
  lastSavedAt,
}: {
  title: string;
  description: string;
  onSave: () => void;
  lastSavedAt: number | null;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50/70 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">설정 저장</p>
          <h3 className="mt-1 text-lg font-bold text-gray-800">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            현재 설정 저장
          </button>
          <p className="text-xs font-medium text-indigo-600">
            {lastSavedAt
              ? `마지막 저장: ${new Date(lastSavedAt).toLocaleTimeString("ko-KR")}`
              : "아직 저장 전"}
          </p>
        </div>
      </div>
    </div>
  );
}

function OutlineBuilderSetup({ classId }: { classId: string }) {
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [activeLevel, setActiveLevel] = useState<Level>("low");
  const initialDraft = useMemo<OutlineBuilderDraft>(() => ({
    topic: "",
    topic_description: "",
    subject_type: "생활문",
    grade_level: "중학년",
    outline_depth: "simple",
    duration_hours: "4",
    generate_draft: false,
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<OutlineBuilderDraft>(
    buildDraftStorageKey(classId, "outline_builder"),
    initialDraft
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [formFields, setFormFields] = useState<{
    topic: string;
    topic_description: string;
    subject_type: string;
    grade_level: string;
    outline_depth: string;
    duration_hours: string;
    generate_draft: boolean;
  } | null>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSets | null>(null);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setStep("generating");

    const fd = new FormData(e.currentTarget);
    setFormFields({
      topic: draft.topic,
      topic_description: draft.topic_description,
      subject_type: draft.subject_type,
      grade_level: draft.grade_level,
      outline_depth: draft.outline_depth,
      duration_hours: draft.duration_hours,
      generate_draft: draft.generate_draft,
    });

    const result = await generateQuestionsPreview(fd);
    if (result.error) {
      setError(result.error);
      setStep("form");
      return;
    }

    setQuestionSets(result.questionSets!);
    setStep("preview");
  }

  async function handleCreateRoom() {
    if (!formFields || !questionSets) return;

    setError("");
    setStep("saving");
    const storageKey = buildDraftStorageKey(classId, "outline_builder");

    const fd = new FormData();
    fd.set("class_id", classId);
    fd.set("activity_type", "outline_builder");
    fd.set("topic", formFields.topic);
    fd.set("topic_description", formFields.topic_description);
    fd.set("subject_type", formFields.subject_type);
    fd.set("grade_level", formFields.grade_level);
    fd.set("outline_depth", formFields.outline_depth);
    fd.set("duration_hours", formFields.duration_hours);
    fd.set("generate_draft", formFields.generate_draft ? "on" : "");
    const cleanedQuestionSets = {
      low: { questions: questionSets.low.questions.map(q => ({ ...q, choices: q.choices?.map(c => c.trim()).filter(Boolean) })) },
      mid: { questions: questionSets.mid.questions.map(q => ({ ...q, choices: q.choices?.map(c => c.trim()).filter(Boolean) })) },
      high: { questions: questionSets.high.questions.map(q => ({ ...q, choices: q.choices?.map(c => c.trim()).filter(Boolean) })) },
    };
    fd.set("question_sets_json", JSON.stringify(cleanedQuestionSets));

    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setLastSavedAt(Date.now());
      setError(result.error);
      setStep("preview");
      return;
    }
  }

  const updateLevel = useCallback((level: Level, qs: Question[]) => {
    setQuestionSets((prev) => (prev ? { ...prev, [level]: { questions: qs } } : prev));
  }, []);

  function handleSaveDraftNow() {
    persistActivityDraft(buildDraftStorageKey(classId, "outline_builder"), draft);
    setLastSavedAt(Date.now());
  }

  const levelMeta: Record<Level, { label: string; emoji: string; color: string }> = {
    low: { label: "어려운 학생", emoji: "🐢", color: "text-green-600 border-green-400 bg-green-50" },
    mid: { label: "보통 학생", emoji: "🐇", color: "text-blue-600 border-blue-400 bg-blue-50" },
    high: { label: "잘 쓰는 학생", emoji: "🦅", color: "text-purple-600 border-purple-400 bg-purple-50" },
  };

  if (step === "preview" || step === "saving") {
    return (
      <>
        <div className="flex items-center gap-2 mb-6 text-sm">
          <StepBadge done>활동 설정</StepBadge>
          <StepDivider active />
          <StepBadge active>문항 검토</StepBadge>
          <StepDivider />
          <StepBadge>활동 시작</StepBadge>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">📋 AI가 만든 문항 검토하기</h2>
          <p className="mt-2 text-sm text-gray-500">학생 수준별로 문항을 확인하고 수정한 뒤 활동을 시작하세요.</p>
        </div>

        <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2 overflow-x-auto">
          {(["low", "mid", "high"] as Level[]).map((lv) => {
            const meta = levelMeta[lv];
            const count = questionSets?.[lv].questions.length ?? 0;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setActiveLevel(lv)}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-base font-medium border-2 transition-colors whitespace-nowrap ${
                  activeLevel === lv ? meta.color : "text-gray-500 border-transparent hover:bg-gray-50"
                }`}
              >
                {meta.emoji} {meta.label}
                <span className="ml-1 text-xs opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className={`text-xs px-3 py-2 rounded-xl mb-4 ${
          activeLevel === "low" ? "bg-green-50 text-green-700" :
          activeLevel === "mid" ? "bg-blue-50 text-blue-700" :
          "bg-purple-50 text-purple-700"
        }`}>
          {activeLevel === "low" && "🐢 글쓰기가 어려운 학생 — 카드 선택 위주, 매우 구체적인 보기"}
          {activeLevel === "mid" && "🐇 보통 수준의 학생 — 카드 선택 + 직접 입력 병행"}
          {activeLevel === "high" && "🦅 글쓰기를 잘 하는 학생 — 직접 입력 위주, 깊이 있는 사고"}
        </div>

        {questionSets && (
          <LevelEditor
            level={activeLevel}
            questions={questionSets[activeLevel].questions}
            onChange={(qs) => updateLevel(activeLevel, qs)}
          />
        )}

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl mt-4">{error}</p>}

        {step === "saving" && (
          <div className="bg-indigo-50 rounded-xl p-4 text-center mt-4">
            <div className="text-2xl mb-2 animate-spin inline-block">⚙️</div>
            <p className="text-indigo-700 font-medium text-base">활동을 시작하고 있어요...</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={step === "saving"}
            className="flex-1 py-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium text-base hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            ← 설정으로 돌아가기
          </button>
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={step === "saving"}
            className="flex-1 py-4 bg-indigo-500 text-white rounded-xl font-bold text-base hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {step === "saving" ? "시작 중..." : "🚀 활동 시작하기"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-6 text-sm">
        <StepBadge active>활동 설정</StepBadge>
        <StepDivider />
        <StepBadge>문항 검토</StepBadge>
        <StepDivider />
        <StepBadge>활동 시작</StepBadge>
      </div>

      <div className="mb-6">
        <DraftSection
          title="글 개요 짜기 설정 저장"
          description="이 활동 기획 중인 내용을 이 브라우저에 저장해 두고, 다시 돌아와 이어서 수정할 수 있어요."
          onSave={handleSaveDraftNow}
          lastSavedAt={lastSavedAt}
        />
      </div>

      <form onSubmit={handleGenerate} className="space-y-6">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="activity_type" value="outline_builder" />

        <TopicFields
          values={{
            topic: draft.topic,
            topic_description: draft.topic_description,
          }}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          hint="설명을 자세히 적을수록 AI가 더 알맞은 글 개요 질문을 만들어줍니다."
          placeholder="예) 지난 주 금요일 학교 뒷산으로 봄 소풍을 다녀왔어요. 친구들과 도시락을 나눠먹고 계곡에서 물놀이를 했습니다."
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
                  onChange={() => setDraft((prev) => ({ ...prev, subject_type: type }))}
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

        <div>
          <label className="block text-base font-medium text-gray-700 mb-3">개요 구조</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "simple", label: "간단히", desc: "처음·중간·끝", emoji: "📄" },
              { value: "medium", label: "중간", desc: "처음·중간1·중간2·끝", emoji: "📝" },
              { value: "detailed", label: "자세히", desc: "처음·중간1·2·3·끝", emoji: "📋" },
            ] as const).map((opt) => (
              <label
                key={opt.value}
                className="flex flex-col border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="outline_depth"
                    value={opt.value}
                    checked={draft.outline_depth === opt.value}
                    onChange={() => setDraft((prev) => ({ ...prev, outline_depth: opt.value }))}
                    className="text-indigo-500 shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-700">{opt.emoji} {opt.label}</span>
                </div>
                <span className="text-xs text-gray-400 mt-1 pl-5">{opt.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <DurationField
          value={draft.duration_hours}
          onChange={(durationHours) => setDraft((prev) => ({ ...prev, duration_hours: durationHours }))}
        />

        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-4 cursor-pointer has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/70">
          <input
            type="checkbox"
            checked={draft.generate_draft}
            onChange={(e) => setDraft((prev) => ({ ...prev, generate_draft: e.target.checked }))}
            className="text-indigo-500"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">고쳐쓰기용 초안 함께 생성하기</p>
            <p className="text-xs text-gray-400 mt-1">체크하면 키워드 개요 외에 AI 초안도 함께 만들어줍니다. 기본값: 개요만 제공</p>
          </div>
        </label>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        {step === "generating" && (
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2 animate-spin inline-block">⚙️</div>
            <p className="text-indigo-700 font-medium text-base">AI가 문항을 만들고 있어요...</p>
            <p className="text-base text-indigo-500 mt-1">약 10~20초 소요됩니다</p>
          </div>
        )}

        <button
          type="submit"
          disabled={step === "generating"}
          className="w-full py-4 bg-indigo-500 text-white rounded-xl font-bold text-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          {step === "generating" ? "문항 생성 중..." : "✨ AI 문항 생성하기"}
        </button>
      </form>
    </>
  );
}

function QuestionGeneratorSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableCardSets, setAvailableCardSets] = useState<QuestionCardSet[]>([]);
  const [loadingCardSets, setLoadingCardSets] = useState(true);
  const [previewCardSet, setPreviewCardSet] = useState<QuestionCardSet | null>(null);
  const initialDraft = useMemo<QuestionGeneratorDraft>(() => ({
    topic: "",
    topic_description: "",
    duration_hours: "4",
    max_selections: "1",
    guidance: "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.",
    require_reason: true,
    selectedCardSetIds: [],
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<QuestionGeneratorDraft>(
    buildDraftStorageKey(classId, "question_generator"),
    initialDraft
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    getQuestionCardSettings().then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error);
      } else {
        setAvailableCardSets(result.cardSets);
        setDraft((prev) => {
          const fallbackIds = result.cardSets.map((cardSet) => cardSet.id);
          return {
            ...prev,
            selectedCardSetIds: prev.selectedCardSetIds.length > 0 ? prev.selectedCardSetIds : fallbackIds,
          };
        });
      }
      setLoadingCardSets(false);
    });

    return () => {
      active = false;
    };
  }, []);

  function toggleCardSet(cardSetId: string) {
    setDraft((prev) => ({
      ...prev,
      selectedCardSetIds: prev.selectedCardSetIds.includes(cardSetId)
        ? prev.selectedCardSetIds.filter((id) => id !== cardSetId)
        : [...prev.selectedCardSetIds, cardSetId],
    }));
  }

  function handleSaveDraftNow() {
    persistActivityDraft(buildDraftStorageKey(classId, "question_generator"), draft);
    setLastSavedAt(Date.now());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (draft.selectedCardSetIds.length === 0) {
      setError("질문 카드 묶음을 1개 이상 선택해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const storageKey = buildDraftStorageKey(classId, "question_generator");
    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("activity_type", "question_generator");
    draft.selectedCardSetIds.forEach((id) => fd.append("enabled_card_set_ids", id));
    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setLastSavedAt(Date.now());
      setError(result.error);
      setSaving(false);
      return;
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 mb-6 text-sm text-emerald-800">
        학생이 먼저 직접 질문을 만들지, 질문 카드를 참고해 바꿔볼지 스스로 고른 뒤 자기 수준에 맞게 참여하는 활동입니다.
      </div>

      <div className="mb-6">
        <DraftSection
          title="질문 만들기 활동 설정 저장"
          description="활동 주제, 카드 선택, 안내 문구를 저장해 두고 이 화면으로 돌아오면 이어서 수정할 수 있어요."
          onSave={handleSaveDraftNow}
          lastSavedAt={lastSavedAt}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="activity_type" value="question_generator" />

        <TopicFields
          values={{
            topic: draft.topic,
            topic_description: draft.topic_description,
          }}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          hint="어떤 글이나 그림, 이야기와 연결해 질문을 만들지 적어두면 학생들이 주제와 더 잘 연결할 수 있습니다."
          placeholder="예) 오늘 읽은 이야기 속 주인공과 장면을 떠올리며, 직접 질문을 만들거나 질문 카드를 주제에 맞게 바꿔 봅니다."
        />

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-base font-medium text-gray-700">질문 카드 묶음 선택</label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{draft.selectedCardSetIds.length}개 선택됨</span>
              <Link
                href="/dashboard/settings"
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                질문 카드 설정 →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {availableCardSets.map((cardSet) => {
              const selected = draft.selectedCardSetIds.includes(cardSet.id);
              return (
                <div
                  key={cardSet.id}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-gray-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-gray-800">[{cardSet.label}] 카드</p>
                      <p className="text-sm text-gray-500 mt-1">{cardSet.description}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {selected ? "선택됨" : "선택"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400 leading-5">
                    예시: {cardSet.prompts[0]}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewCardSet(cardSet)}
                      className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      질문 미리보기
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCardSet(cardSet.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        selected
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {selected ? "선택 해제" : "이 묶음 선택"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!loadingCardSets && availableCardSets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm text-gray-500">저장된 질문 카드 묶음이 없어요.</p>
              <Link href="/dashboard/settings" className="mt-2 inline-block text-sm font-semibold text-emerald-600 hover:underline">
                설정에서 질문 카드 묶음 만들기 →
              </Link>
            </div>
          )}
        </div>

        {previewCardSet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
            <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl max-h-[85vh] overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">질문 카드 미리보기</p>
                  <h3 className="mt-1 text-2xl font-bold text-gray-800">[{previewCardSet.label}] 카드</h3>
                  <p className="mt-2 text-sm text-gray-500">{previewCardSet.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewCardSet(null)}
                  className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
                <div className="space-y-3">
                  {previewCardSet.prompts.map((prompt, index) => (
                    <div key={`${previewCardSet.id}-${index}`} className="rounded-2xl bg-emerald-50/70 px-4 py-4">
                      <p className="text-xs font-semibold text-emerald-700">질문 카드 {index + 1}</p>
                      <p className="mt-2 text-sm leading-6 text-gray-800">{prompt}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewCardSet(null)}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  확인했어요
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">학생당 고를 카드 수</label>
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((count) => (
                <label
                  key={count}
                  className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-3 py-3 cursor-pointer has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50"
                >
                  <input
                    type="radio"
                    name="max_selections"
                    value={count}
                    checked={draft.max_selections === String(count)}
                    onChange={() => setDraft((prev) => ({ ...prev, max_selections: String(count) }))}
                    className="text-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{count}개</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">활동 운영 시간</label>
            <DurationField
              value={draft.duration_hours}
              onChange={(durationHours) => setDraft((prev) => ({ ...prev, duration_hours: durationHours }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">질문 바꾸기 안내</label>
          <textarea
            name="guidance"
            rows={4}
            value={draft.guidance}
            onChange={(event) => setDraft((prev) => ({ ...prev, guidance: event.target.value }))}
            className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-4 cursor-pointer has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/70">
          <input
            type="checkbox"
            name="require_reason"
            checked={draft.require_reason}
            onChange={(event) => setDraft((prev) => ({ ...prev, require_reason: event.target.checked }))}
            className="text-emerald-500"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">왜 이렇게 바꿨는지 함께 적기</p>
            <p className="text-xs text-gray-400 mt-1">질문을 고친 이유를 짧게 적게 합니다.</p>
          </div>
        </label>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={saving || loadingCardSets || availableCardSets.length === 0}
          className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {loadingCardSets ? "질문 카드 불러오는 중..." : saving ? "시작 중..." : "🚀 질문 카드 활동 시작"}
        </button>
      </form>
    </>
  );
}

function QuestionVotingSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceRooms, setSourceRooms] = useState<QuestionGeneratorSourceRoomSummary[]>([]);
  const [loadingSourceRooms, setLoadingSourceRooms] = useState(true);
  const initialDraft = useMemo<QuestionVotingDraft>(() => ({
    duration_hours: "4",
    max_selections: "1",
    evaluation_criteria: "생각이 더 이어지는 질문\n친구가 더 이야기하고 싶어지는 질문",
    require_reason: true,
    source_room_id: "",
    source_room_title: "",
    source_room_topic: "",
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<QuestionVotingDraft>(
    buildDraftStorageKey(classId, "question_voting"),
    initialDraft
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    getQuestionGeneratorSourceRooms(classId).then((rooms) => {
      if (!active) return;
      setSourceRooms(rooms);
      setDraft((prev) => ({
        ...prev,
        source_room_id: prev.source_room_id || rooms[0]?.roomId || "",
        source_room_title: prev.source_room_title || rooms[0]?.title || "",
        source_room_topic: prev.source_room_topic || rooms[0]?.topic || "",
      }));
      setLoadingSourceRooms(false);
    });

    return () => {
      active = false;
    };
  }, [classId, setDraft]);

  const selectedSourceRoom = sourceRooms.find((room) => room.roomId === draft.source_room_id) ?? null;

  function handleSaveDraftNow() {
    persistActivityDraft(buildDraftStorageKey(classId, "question_voting"), draft);
    setLastSavedAt(Date.now());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.source_room_id) {
      setError("평가에 사용할 질문 만들기 활동을 먼저 골라주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const storageKey = buildDraftStorageKey(classId, "question_voting");
    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("activity_type", "question_voting");
    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);
    const result = await createRoom(fd);
    if (result?.error) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setLastSavedAt(Date.now());
      setError(result.error);
      setSaving(false);
      return;
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 mb-6 text-sm text-amber-800">
        학생들이 질문 후보를 읽고, 가장 좋은 질문을 선택하며 이유까지 나누는 토의형 활동입니다.
      </div>

      <div className="mb-6">
        <DraftSection
          title="좋은 질문 고르기 설정 저장"
          description="질문 후보와 선택 조건을 저장해 두고, 이 활동 화면으로 돌아오면 그대로 이어서 수정할 수 있어요."
          onSave={handleSaveDraftNow}
          lastSavedAt={lastSavedAt}
        />
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

        {selectedSourceRoom && (
          <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-500">익명 질문 미리보기</p>
                <h3 className="mt-1 text-base font-bold text-gray-800">{selectedSourceRoom.title}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                {selectedSourceRoom.questionCount}개
              </span>
            </div>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {selectedSourceRoom.questions.map((question, index) => (
                <div key={question.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
                  <span className="mr-2 text-xs font-bold text-amber-500">질문 {index + 1}</span>
                  {question.text}
                </div>
              ))}
            </div>
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
            <label className="block text-base font-medium text-gray-700 mb-3">학생당 선택 개수</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((count) => (
                <label
                  key={count}
                  className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-3 py-3 cursor-pointer has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50"
                >
                  <input
                    type="radio"
                    name="max_selections"
                    value={count}
                    checked={draft.max_selections === String(count)}
                    onChange={() => setDraft((prev) => ({ ...prev, max_selections: String(count) }))}
                    className="text-amber-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{count}개</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">활동 운영 시간</label>
            <DurationField
              value={draft.duration_hours}
              onChange={(durationHours) => setDraft((prev) => ({ ...prev, duration_hours: durationHours }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-4 cursor-pointer has-[:checked]:border-amber-300 has-[:checked]:bg-amber-50/70">
          <input
            type="checkbox"
            name="require_reason"
            checked={draft.require_reason}
            onChange={(event) => setDraft((prev) => ({ ...prev, require_reason: event.target.checked }))}
            className="text-amber-500"
          />
          <div>
            <p className="text-sm font-semibold text-gray-800">선택 이유 함께 적기</p>
            <p className="text-xs text-gray-400 mt-1">왜 그 질문이 좋은지 짧게 생각을 남기게 합니다.</p>
          </div>
        </label>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={saving || loadingSourceRooms || sourceRooms.length === 0}
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
    topic: "오늘 수업 한 줄 정리",
    topic_description: "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.",
    keywords: "",
    max_reactions_per_student: "3",
    duration_hours: "4",
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<OneLineShareDraft>(
    buildDraftStorageKey(classId, "one_line_share"),
    initialDraft,
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  function handleSaveDraftNow() {
    persistActivityDraft(buildDraftStorageKey(classId, "one_line_share"), draft);
    setLastSavedAt(Date.now());
  }

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
      setLastSavedAt(Date.now());
      setError(result.error);
      setSaving(false);
      return;
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 mb-6 text-sm text-rose-800">
        학생이 핵심단어를 넣어 한 문장으로 생각을 나누고, 친구 문장에는 댓글 대신 좋아요로 간단하게 반응하는 활동입니다.
      </div>

      <div className="mb-6">
        <DraftSection
          title="한줄모아 활동 설정 저장"
          description="안내 제목, 설명, 핵심단어를 저장해 두고 나중에 돌아와 이어서 수정할 수 있어요."
          onSave={handleSaveDraftNow}
          lastSavedAt={lastSavedAt}
        />
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
          hint="학생에게 보일 활동 제목과 설명입니다. 핵심단어와 함께 한 문장으로 무엇을 표현할지 안내해 주세요."
          placeholder="예) 오늘 배운 증발과 물의 순환을 떠올리며, 핵심단어를 넣어 내 생각을 한 문장으로 정리해 봅니다."
        />

        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">핵심단어</label>
          <textarea
            name="keywords"
            rows={3}
            value={draft.keywords}
            onChange={(event) => setDraft((prev) => ({ ...prev, keywords: event.target.value }))}
            placeholder={"한 줄에 하나씩 또는 쉼표로 적어주세요.\n예)\n증발\n물의 순환"}
            className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
          />
          <p className="text-xs text-gray-400 mt-2">학생은 핵심단어를 한 개 이상 포함해 한 줄을 쓰게 됩니다.</p>
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

          <div>
            <label className="block text-base font-medium text-gray-700 mb-3">활동 운영 시간</label>
            <DurationField
              value={draft.duration_hours}
              onChange={(durationHours) => setDraft((prev) => ({ ...prev, duration_hours: durationHours }))}
            />
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

function TopicFields({
  values,
  onChange,
  hint,
  placeholder,
}: {
  values: {
    topic: string;
    topic_description: string;
  };
  onChange: (patch: { topic?: string; topic_description?: string }) => void;
  hint: string;
  placeholder: string;
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
          <span className="ml-2 text-sm font-normal text-gray-400">(선택)</span>
        </label>
        <textarea
          name="topic_description"
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
      </div>
    </div>
  );
}

function DurationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (durationHours: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { value: "4", label: "4시간", desc: "오전/오후" },
          { value: "8", label: "8시간", desc: "하루 수업" },
          { value: "24", label: "1일", desc: "하루 동안" },
          { value: "48", label: "2일", desc: "이틀 동안" },
        ].map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-[112px] flex-col items-center justify-between border border-gray-200 rounded-xl px-3 py-4 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50 text-center"
          >
            <input
              type="radio"
              name="duration_hours"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="text-indigo-500 shrink-0"
            />
            <div className="flex flex-col items-center">
              <span className="text-base font-semibold text-gray-700 leading-none">{opt.label}</span>
              <span className="mt-2 text-xs text-gray-400">{opt.desc}</span>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">⏰ 시간이 지나면 새 학생 접속이 차단됩니다. 교사가 직접 종료도 가능해요.</p>
    </div>
  );
}

function StepBadge({
  children,
  active = false,
  done = false,
}: {
  children: React.ReactNode;
  active?: boolean;
  done?: boolean;
}) {
  const base = "rounded-full px-3 py-1.5 text-sm font-medium";
  if (done) return <span className={`${base} bg-indigo-100 text-indigo-600`}>{children}</span>;
  if (active) return <span className={`${base} bg-indigo-500 text-white`}>{children}</span>;
  return <span className={`${base} bg-gray-100 text-gray-400`}>{children}</span>;
}

function StepDivider({ active = false }: { active?: boolean }) {
  return <div className={`h-px flex-1 ${active ? "bg-indigo-400" : "bg-gray-300"}`} />;
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

function useActivityDraft<T>(storageKey: string, initialState: T) {
  const [draft, setDraft] = useState<T>(initialState);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const autosaveEnabledRef = useRef(true);

  useEffect(() => {
    const { draft: nextDraft } = readActivityDraft(storageKey, initialState);
    autosaveEnabledRef.current = true;
    startTransition(() => {
      setDraft(nextDraft);
      setAutosaveEnabled(true);
    });
  }, [initialState, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!autosaveEnabled) return;

    const saveDraft = () => {
      if (!autosaveEnabledRef.current) return;
      persistActivityDraft(storageKey, draft);
    };

    const intervalId = window.setInterval(saveDraft, DRAFT_SAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      saveDraft();
    };
  }, [autosaveEnabled, draft, storageKey]);

  const suspendAutosave = useCallback(() => {
    autosaveEnabledRef.current = false;
    setAutosaveEnabled(false);
  }, []);

  const resumeAutosave = useCallback(() => {
    autosaveEnabledRef.current = true;
    setAutosaveEnabled(true);
  }, []);

  return [draft, setDraft, { suspendAutosave, resumeAutosave }] as const;
}

function parseActivityType(value: string | null): ActivityType | null {
  if (value === "outline_builder" || value === "question_generator" || value === "question_voting" || value === "one_line_share") {
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
