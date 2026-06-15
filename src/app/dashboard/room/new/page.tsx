"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createRoom,
  generateQuestionsPreview,
  getOrGenerateHanjaCard,
  getTeacherHanjaWordCards,
  getQuestionGeneratorSourceRooms,
  saveTeacherHanjaWordCard,
  type QuestionGeneratorSourceRoomSummary,
  type SavedHanjaWordCard,
} from "@/app/actions/room-actions";
import { getQuestionCardSettings } from "@/app/actions/settings-actions";
import { activityDefinitions, getActivityDefinition } from "@/features/activities/registry";
import type { ActivityType, QuestionCardRole, QuestionCardSet } from "@/features/activities/types";
import {
  getCardMeta,
  getCardTheme,
  getRecommendedGradeChipClass,
  getRecommendedGradeLabel,
} from "@/features/activities/question-generator/card-meta";
import {
  buildDraftStorageKey,
  clearActivityDraft,
  persistActivityDraft,
} from "@/lib/activity-drafts";
import {
  HANJA_RECOMMENDED_WORDS,
  type HanjaRecommendedGrade,
  type HanjaRecommendedWord,
} from "@/lib/hanja-recommended-words";
import { useActivityDraft } from "@/lib/use-activity-draft";
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
  selectedCardSetIds: string[];
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
  duration_hours: string;
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
  duration_hours: string;
};

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
    summary: "질문 후보 중에서 가장 좋은 질문을 고르는 활동",
  },
  one_line_share: {
    emoji: "💬",
    tone: "from-rose-50 via-white to-pink-50",
    summary: "핵심단어를 이용한 문장 만들기로 수업을 마무리하는 활동",
  },
  hanja_writing: {
    emoji: "📜",
    tone: "from-amber-50 via-white to-orange-50",
    summary: "단어 속 한자의 뜻을 살피고, 그 단어를 활용해 한 문장을 만들어 친구와 나누는 활동",
  },
  word_game: {
    emoji: "🎮",
    tone: "from-sky-50 via-white to-indigo-50",
    summary: "3~6학년 학년별 필수 단어를 활용하여 정해진 시간 동안 낱말을 맞추는 실시간 경쟁 게임",
  },
};

const WRITING_BUNDLE_ACTIVITY_IDS: ActivityType[] = [
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
];

const WRITING_BUNDLE_DEFINITIONS = activityDefinitions.filter(
  (activity) => WRITING_BUNDLE_ACTIVITY_IDS.includes(activity.id),
);

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
    tone: "from-rose-50 via-white to-pink-50",
    label: "[도덕] 마음 거울 비추기",
    badge: "감정·가치 글쓰기",
    summary:
      "감정·가치를 떠올리고 다짐·실천 계획까지 풀어내는 도덕과 글쓰기 활동",
    effect: "어휘력 향상과 정서 조절 능력 발달",
    href: "__morals__",
    status: "testing",
  },
];

const LITERACY_ACTIVITIES: {
  emoji: string;
  tone: string;
  label: string;
  summary: string;
  href?: string;
  badge?: string;
}[] = [
  {
    emoji: "📜",
    tone: "from-amber-50 via-white to-orange-50",
    label: "한자 활용 문장 만들기",
    summary: "낱말 속 한자의 뜻을 살피고, 한자를 활용해 더 정확하고 풍부한 문장을 써보는 활동",
    href: "__hanja_writing__",
    badge: "테스트 중",
  },
  {
    emoji: "🎮",
    tone: "from-sky-50 via-white to-indigo-50",
    label: "필수 단어 맞추기 게임",
    summary: "3~6학년 필수 단어를 활용하여 정해진 시간 동안 낱말을 맞추는 실시간 경쟁 게임",
    href: "__word_game__",
    badge: "준비 중",
  },
  {
    emoji: "🪄",
    tone: "from-slate-50 via-white to-gray-50",
    label: "문해력 활동 ③",
    summary: "곧 새로운 글쓰기 문해력 활동이 추가될 예정이에요.",
  },
  {
    emoji: "🪄",
    tone: "from-slate-50 via-white to-gray-50",
    label: "문해력 활동 ④",
    summary: "곧 새로운 글쓰기 문해력 활동이 추가될 예정이에요.",
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
                    {WRITING_BUNDLE_DEFINITIONS.length}개
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">바로 사용</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {WRITING_BUNDLE_DEFINITIONS.map((activity) => {
                  const meta = ACTIVITY_META[activity.id];
                  return (
                    <Link
                      key={activity.id}
                      href={`/dashboard/room/new?class_id=${classId}&activity_type=${activity.id}`}
                      className={`flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-br ${meta.tone} p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{meta.emoji}</span>
                        {activity.id === "outline_builder" && (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                            테스트 중
                          </span>
                        )}
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

            {/* ── 파트 2: 글쓰기 문해력 활동 ── */}
            <section className="flex-1 p-5 bg-gray-50/60">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">✍️</span>
                  <h2 className="text-sm font-bold text-gray-800 truncate">글쓰기 문해력 활동</h2>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-600">
                    {LITERACY_ACTIVITIES.length}개
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">문해력 강화</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {LITERACY_ACTIVITIES.map((activity) => {
                  const resolvedHref = activity.href === "__hanja_writing__"
                    ? (classId ? `/dashboard/room/new?class_id=${classId}&activity_type=hanja_writing` : null)
                    : null;
                  return resolvedHref ? (
                    <Link
                      key={activity.label}
                      href={resolvedHref}
                      className={`flex flex-col rounded-2xl border-2 border-amber-200 bg-gradient-to-br ${activity.tone} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{activity.emoji}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ${activity.badge === "테스트 중" ? "bg-amber-500" : "bg-amber-400"}`}>
                          {activity.badge || "NEW"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-gray-800">{activity.label}</h3>
                      <p className="mt-1 text-[11px] leading-4 text-gray-500 flex-1 line-clamp-3">{activity.summary}</p>
                      <div className="mt-3 pt-2 border-t border-amber-100/80 flex justify-end">
                        <span className="inline-flex items-center gap-1 bg-amber-400 text-white text-[11px] font-semibold px-3 py-1 rounded-full">
                          선택 →
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div
                      key={activity.label}
                      className={`flex flex-col rounded-2xl border border-gray-200/80 bg-gradient-to-br ${activity.tone} p-4 opacity-70 cursor-not-allowed`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl">{activity.emoji}</span>
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-orange-500 shadow-sm">
                          {activity.badge || "준비 중"}
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

          {/* ── 파트 3: 과목별 글쓰기 활동 ── */}
          <div className="border-t border-gray-100">
            <section className="p-5">
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

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {COMING_SOON_ACTIVITIES.map((activity) => {
                  const resolvedHref = activity.href === "__science__"
                    ? (classId ? `/dashboard/science/new?class_id=${classId}` : null)
                    : activity.href === "__morals__"
                      ? (classId ? `/dashboard/morals/new?class_id=${classId}` : null)
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
      setError(result.error);
      setStep("preview");
      return;
    }
  }

  const updateLevel = useCallback((level: Level, qs: Question[]) => {
    setQuestionSets((prev) => (prev ? { ...prev, [level]: { questions: qs } } : prev));
  }, []);

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
  const [availableRoles, setAvailableRoles] = useState<QuestionCardRole[]>([]);
  const [loadingCardSets, setLoadingCardSets] = useState(true);
  const [previewCardSet, setPreviewCardSet] = useState<QuestionCardSet | null>(null);
  const [cardSearch, setCardSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<CardOriginFilter>("all");
  const [activeRoleFilterId, setActiveRoleFilterId] = useState<string>("all");
  const initialDraft = useMemo<QuestionGeneratorDraft>(() => ({
    topic: "",
    topic_description: "",
    duration_hours: "4",
    max_selections: "1",
    guidance: "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.",
    selectedCardSetIds: [],
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<QuestionGeneratorDraft>(
    buildDraftStorageKey(classId, "question_generator"),
    initialDraft
  );
  const deferredCardSearch = useDeferredValue(cardSearch);

  useEffect(() => {
    let active = true;

    getQuestionCardSettings().then((cardResult) => {
      if (!active) return;
      if (cardResult.error) setError(cardResult.error);
      else {
        setAvailableCardSets(cardResult.cardSets);
        setAvailableRoles(cardResult.roles);
        setDraft((prev) => {
          const allCardSetIds = new Set(cardResult.cardSets.map((cs) => cs.id));
          const wasAutoSelectedDefault =
            prev.selectedCardSetIds.length === cardResult.cardSets.length &&
            prev.selectedCardSetIds.every((id) => allCardSetIds.has(id)) &&
            !prev.topic.trim() &&
            !prev.topic_description.trim();
          return {
            ...prev,
            selectedCardSetIds: wasAutoSelectedDefault ? [] : prev.selectedCardSetIds,
          };
        });
      }
      setLoadingCardSets(false);
    });

    return () => {
      active = false;
    };
  }, [setDraft]);

  function toggleCardSet(cardSetId: string) {
    setDraft((prev) => ({
      ...prev,
      selectedCardSetIds: prev.selectedCardSetIds.includes(cardSetId)
        ? prev.selectedCardSetIds.filter((id) => id !== cardSetId)
        : [...prev.selectedCardSetIds, cardSetId],
    }));
  }

  function toggleRoleAllCards(groupCardSetIds: string[], shouldDeselect: boolean) {
    setDraft((prev) => {
      if (shouldDeselect) {
        const removeSet = new Set(groupCardSetIds);
        return {
          ...prev,
          selectedCardSetIds: prev.selectedCardSetIds.filter((id) => !removeSet.has(id)),
        };
      }
      const merged = new Set(prev.selectedCardSetIds);
      groupCardSetIds.forEach((id) => merged.add(id));
      return { ...prev, selectedCardSetIds: Array.from(merged) };
    });
  }

  const roleGroups = useMemo(() => {
    const groups: Array<{ role: QuestionCardRole; cardSets: QuestionCardSet[] }> = [];
    for (const role of availableRoles) {
      const cards = availableCardSets.filter((cs) => cs.roleId === role.id);
      if (cards.length > 0) groups.push({ role, cardSets: cards });
    }
    const knownIds = new Set(availableRoles.map((r) => r.id));
    const orphans = availableCardSets.filter((cs) => !cs.roleId || !knownIds.has(cs.roleId));
    if (orphans.length > 0) {
      groups.push({
        role: {
          id: "__orphan__",
          label: "기타",
          subtitle: "역할 미지정",
          description: "",
          icon: "🃏",
          cardSetIds: [],
        },
        cardSets: orphans,
      });
    }
    return groups;
  }, [availableRoles, availableCardSets]);

  const originFilteredRoleGroups = useMemo(() => (
    roleGroups
      .map(({ role, cardSets }) => ({
        role,
        cardSets: cardSets.filter((cardSet) => matchesCardOrigin(cardSet, originFilter)),
      }))
      .filter(({ cardSets }) => cardSets.length > 0)
  ), [originFilter, roleGroups]);

  const roleOptions = useMemo(() => (
    originFilteredRoleGroups.map(({ role, cardSets }) => ({
      id: role.id,
      label: role.label,
      icon: role.icon || "🃏",
      count: cardSets.length,
      selectedCount: cardSets.filter((cardSet) => draft.selectedCardSetIds.includes(cardSet.id)).length,
    }))
  ), [draft.selectedCardSetIds, originFilteredRoleGroups]);

  const filteredCardSets = useMemo(() => {
    if (originFilter !== "all" && activeRoleFilterId === "all") {
      return [];
    }

    const normalizedSearch = deferredCardSearch.trim().toLowerCase();

    return availableCardSets.filter((cardSet) => {
      if (!matchesCardOrigin(cardSet, originFilter)) return false;

      const matchesRole = activeRoleFilterId === "all" ? true : cardSet.roleId === activeRoleFilterId;
      if (!matchesRole) return false;

      if (!normalizedSearch) return true;

      const roleLabel = availableRoles.find((role) => role.id === cardSet.roleId)?.label ?? "";
      const haystack = [
        cardSet.label,
        cardSet.description,
        roleLabel,
        ...cardSet.prompts.slice(0, 3),
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [activeRoleFilterId, availableCardSets, availableRoles, deferredCardSearch, originFilter]);

  const defaultCardCount = useMemo(
    () => availableCardSets.filter((cardSet) => cardSet.isDefault).length,
    [availableCardSets],
  );
  const customCardCount = useMemo(
    () => availableCardSets.filter((cardSet) => !cardSet.isDefault).length,
    [availableCardSets],
  );

  const roleById = useMemo(
    () => new Map(availableRoles.map((role) => [role.id, role] as const)),
    [availableRoles],
  );
  const waitingForRoleSelection = originFilter !== "all" && activeRoleFilterId === "all";

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
          savedAt={draftControls.savedAt}
          descriptionRequired
        />

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-base font-medium text-gray-700">질문 카드 선택</label>
            <Link
              href="/dashboard/settings"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              질문 카드 설정 →
            </Link>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-emerald-900">
                총 카드 {availableCardSets.length}개 중 <span className="font-bold">{draft.selectedCardSetIds.length}개 선택</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "all", label: `전체 ${availableCardSets.length}` },
                  { value: "default", label: `기본 제공 ${defaultCardCount}` },
                  { value: "custom", label: `내 카드 ${customCardCount}` },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setOriginFilter(option.value);
                      setActiveRoleFilterId("all");
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      originFilter === option.value
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 hover:bg-emerald-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="search"
                value={cardSearch}
                onChange={(event) => setCardSearch(event.target.value)}
                placeholder="카드 이름, 설명, 역할, 예시 질문으로 검색"
                className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={() => {
                  setCardSearch("");
                  setOriginFilter("all");
                  setActiveRoleFilterId("all");
                }}
                className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                필터 초기화
              </button>
            </div>

            {roleOptions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveRoleFilterId("all")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                    activeRoleFilterId === "all"
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  전체 역할
                </button>
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRoleFilterId(role.id)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                      activeRoleFilterId === role.id
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-700 hover:bg-emerald-100"
                    }`}
                  >
                    {role.icon} {role.label} {role.selectedCount > 0 ? `· ${role.selectedCount}/${role.count}` : `· ${role.count}`}
                  </button>
                ))}
              </div>
            )}

            {originFilteredRoleGroups.length > 0 && (
              <div className="mt-4 border-t border-emerald-100 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-emerald-800">역할별 빠른 선택</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {originFilteredRoleGroups.map(({ role, cardSets: groupCards }) => {
                    const groupIds = groupCards.map((cardSet) => cardSet.id);
                    const selectedCount = groupIds.filter((id) => draft.selectedCardSetIds.includes(id)).length;
                    const allSelected = selectedCount === groupIds.length && groupIds.length > 0;

                    return (
                      <div
                        key={role.id}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
                          selectedCount > 0 ? "border-emerald-200 bg-white" : "border-white bg-white/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveRoleFilterId(role.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-bold text-gray-800">
                            {role.icon || "🃏"} {role.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {selectedCount}/{groupIds.length}개 선택
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRoleAllCards(groupIds, allSelected)}
                          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                            allSelected
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {allSelected ? "전체 해제" : "전체 선택"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {activeRoleFilterId !== "all" && (
            <div className="mt-3 flex justify-end">
              {(() => {
                const currentRole = originFilteredRoleGroups.find(({ role }) => role.id === activeRoleFilterId);
                if (!currentRole) return null;
                const groupIds = currentRole.cardSets.map((cardSet) => cardSet.id);
                const selectedCount = groupIds.filter((id) => draft.selectedCardSetIds.includes(id)).length;
                const allSelected = selectedCount === groupIds.length && groupIds.length > 0;

                return (
                  <button
                    type="button"
                    onClick={() => toggleRoleAllCards(groupIds, allSelected)}
                    className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    {allSelected ? "이 역할 카드 모두 해제" : "이 역할 카드 모두 선택"}
                  </button>
                );
              })()}
            </div>
          )}

          {!waitingForRoleSelection && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredCardSets.map((cardSet) => {
                const selected = draft.selectedCardSetIds.includes(cardSet.id);
                const role = cardSet.roleId ? roleById.get(cardSet.roleId) ?? null : null;
                const meta = getCardMeta(cardSet.label);
                const theme = getCardTheme(cardSet.label);

                return (
	                  <div
	                    key={cardSet.id}
	                    className={`relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${theme.accentBorder} ${
	                      selected
	                        ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100"
	                        : `border-gray-200 bg-white hover:bg-emerald-50/30`
	                    }`}
	                  >
	                    {selected && <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />}
	                    <div className="flex items-start justify-between gap-3">
	                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${theme.chip}`}>
                            <span>{meta.emoji}</span>
                            <span>{cardSet.label}</span>
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRecommendedGradeChipClass(meta.recommendedGrades)}`}>
                            {getRecommendedGradeLabel(meta.recommendedGrades)}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            cardSet.isDefault
                              ? "bg-slate-100 text-slate-600"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {cardSet.isDefault ? "기본 제공" : "내 카드"}
                          </span>
                          {role && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {role.icon || "🃏"} {role.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{cardSet.description}</p>
                      </div>
	                      <span
	                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
	                          selected ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-100 text-gray-500"
	                        }`}
	                      >
	                        {selected ? "✓ 선택됨" : "미선택"}
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
	                        aria-pressed={selected}
	                        className={`min-w-28 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
	                          selected
	                            ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
	                            : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
	                        }`}
	                      >
	                        {selected ? "✓ 선택 완료" : "선택하기"}
	                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loadingCardSets && availableCardSets.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm text-gray-500">저장된 질문 카드 묶음이 없어요.</p>
              <Link href="/dashboard/settings" className="mt-2 inline-block text-sm font-semibold text-emerald-600 hover:underline">
                설정에서 질문 카드 묶음 만들기 →
              </Link>
            </div>
          )}

          {!loadingCardSets && availableCardSets.length > 0 && !waitingForRoleSelection && filteredCardSets.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-gray-700">조건에 맞는 카드가 없어요.</p>
              <p className="mt-1 text-xs text-gray-500">검색어나 필터를 조금 넓혀보세요.</p>
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
    duration_hours: "4",
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
    topic: "오늘 수업 한 줄 정리",
    topic_description: "핵심단어를 이용해 오늘 수업을 마무리하는 한 문장을 써보세요.",
    core_keywords: "",
    auxiliary_keywords: "",
    max_reactions_per_student: "3",
    duration_hours: "4",
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
      <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 mb-6 text-sm text-rose-800">
        학생이 핵심단어를 이용해 문장을 만들며 수업을 마무리하고, 친구 문장에는 좋아요로 반응하는 활동입니다.
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
          hint="학생에게 보일 활동 제목과 설명입니다. 핵심단어를 이용해 수업을 마무리하는 문장을 쓰도록 안내해 주세요."
          placeholder="예) 오늘 배운 증발과 물의 순환을 떠올리며, 핵심단어를 이용해 수업을 마무리하는 한 문장을 써 봅니다."
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

type HanjaWritingDraft = {
  word: string;
  grade: string;
  duration_hours: string;
};

type HanjaCardPreview = {
  word: string;
  grade: number;
  hanja: Array<{ char: string; reading: string; meaning: string }>;
  relatedWords: Array<{ word: string; hanja: string; meaning: string; sharedChar: string }>;
  definition: string;
  example: string;
  category: string;
};

function HanjaWritingSetup({ classId }: { classId: string }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [savedCards, setSavedCards] = useState<SavedHanjaWordCard[]>([]);
  const [preview, setPreview] = useState<HanjaCardPreview | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(8);
  const initialDraft = useMemo<HanjaWritingDraft>(() => ({
    word: "",
    grade: "4",
    duration_hours: "4",
  }), []);
  const [draft, setDraft, draftControls] = useActivityDraft<HanjaWritingDraft>(
    buildDraftStorageKey(classId, "hanja_writing"),
    initialDraft,
  );
  const recommendedGrade: HanjaRecommendedGrade =
    draft.grade === "3" || draft.grade === "4" || draft.grade === "5" || draft.grade === "6"
      ? draft.grade
      : "4";
  const recommendedWords = useMemo(() => HANJA_RECOMMENDED_WORDS[recommendedGrade], [recommendedGrade]);
  const savedWordKeys = useMemo(
    () => new Set(savedCards.map((card) => `${card.grade}:${card.word}`)),
    [savedCards],
  );
  const availableRecommendedWords = useMemo(
    () => recommendedWords.filter((item) => !savedWordKeys.has(`${recommendedGrade}:${item.word}`)),
    [recommendedGrade, recommendedWords, savedWordKeys],
  );
  const categories = useMemo(
    () => Array.from(new Set(availableRecommendedWords.map((item) => item.category))),
    [availableRecommendedWords],
  );
  const filteredRecommendedWords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return availableRecommendedWords.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      return [item.word, item.category, item.note].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [availableRecommendedWords, categoryFilter, query]);
  const visibleRecommendedWords = filteredRecommendedWords.slice(0, visibleCount);
  const selectedRecommendedWord = useMemo(
    () => recommendedWords.find((item) => item.word === draft.word) ?? null,
    [draft.word, recommendedWords],
  );
  const currentSavedCard = useMemo(
    () => savedCards.find((card) => card.word === draft.word.trim() && String(card.grade) === draft.grade) ?? null,
    [draft.grade, draft.word, savedCards],
  );

  useEffect(() => {
    let active = true;
    getTeacherHanjaWordCards().then((result) => {
      if (!active) return;
      if (!result.error && result.cards) {
        setSavedCards(result.cards);
      }
      setLibraryLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCategoryFilter("all");
    setQuery("");
    setVisibleCount(8);
    setPreview(null);
    setError("");
  }, [recommendedGrade]);

  useEffect(() => {
    setVisibleCount(8);
  }, [categoryFilter, query]);

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  async function handleGenerate() {
    const word = draft.word.trim();
    if (!word) {
      setError("단어를 입력해 주세요.");
      return;
    }
    setError("");
    setGenerating(true);
    setPreview(null);
    const result = await getOrGenerateHanjaCard(word, Number(draft.grade) || 4);
    setGenerating(false);
    if (result.error || !result.card) {
      setError(result.error ?? "한자 카드를 생성하지 못했습니다.");
      return;
    }
    setPreview({
      word: result.card.word,
      grade: result.card.grade,
      hanja: result.card.hanja,
      relatedWords: result.card.relatedWords,
      definition: result.card.definition,
      example: result.card.example,
      category: result.card.category,
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview) {
      setError("먼저 단어를 입력하고 한자 카드를 만들어 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const storageKey = buildDraftStorageKey(classId, "hanja_writing");
    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("activity_type", "hanja_writing");
    fd.set("hanja_card", JSON.stringify(preview));
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

  function applySavedCard(card: SavedHanjaWordCard) {
    setDraft((prev) => ({ ...prev, word: card.word, grade: String(card.grade) }));
    setPreview({
      word: card.word,
      grade: card.grade,
      hanja: card.hanja,
      relatedWords: card.relatedWords,
      definition: card.definition,
      example: card.example,
      category: card.category,
    });
    setError("");
  }

  function handleSelectRecommendedWord(item: HanjaRecommendedWord) {
    const savedCard = savedCards.find((card) => card.word === item.word && String(card.grade) === draft.grade);
    if (savedCard) {
      applySavedCard(savedCard);
      return;
    }

    setDraft((prev) => ({ ...prev, word: item.word }));
    setPreview(null);
    setError("");
  }

  async function handleSaveCard() {
    if (!preview) return;
    setSavingCard(true);
    setError("");
    const result = await saveTeacherHanjaWordCard(preview);
    setSavingCard(false);
    if (result.error || !result.card) {
      setError(result.error ?? "한자 카드를 저장하지 못했습니다.");
      return;
    }
    setSavedCards((prev) => {
      const next = prev.filter((card) => !(card.word === result.card!.word && card.grade === result.card!.grade));
      return [result.card!, ...next];
    });
  }

  return (
    <>
      <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 mb-6 text-sm text-amber-800">
        단어 속 한자의 뜻과 관련 단어를 살피고, 학생이 그 단어로 한 문장을 만들어 친구들과 나누는 활동입니다.
      </div>

      <div className="mb-6 rounded-2xl border border-amber-100 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-800">추천 한자어 고르기</h3>
            <p className="mt-1 text-sm text-gray-500">
              단어집에 아직 없는 추천 단어만 보여줍니다. 마음에 드는 단어를 고르고, 없으면 아래에서 직접 입력해 AI로 생성할 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              초등 {draft.grade}학년
            </span>
            <Link
              href="/dashboard/hanja-wordbook"
              className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50"
            >
              단어집 열기
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">학년</label>
            <select
              value={draft.grade}
              onChange={(event) => setDraft((prev) => ({ ...prev, grade: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="3">초등 3학년</option>
              <option value="4">초등 4학년</option>
              <option value="5">초등 5학년</option>
              <option value="6">초등 6학년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">검색</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="단어 또는 범주 검색"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === "all" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                categoryFilter === category ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
          <p>현재 보이는 추천 단어 {filteredRecommendedWords.length}개</p>
          {savedCards.length > 0 && <p>단어집에 저장된 단어는 추천 목록에서 자동으로 숨깁니다.</p>}
        </div>

        {selectedRecommendedWord && !currentSavedCard && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold text-gray-900">{selectedRecommendedWord.word}</p>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                {selectedRecommendedWord.category}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
                난이도 {selectedRecommendedWord.level}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{selectedRecommendedWord.note}</p>
            <p className="mt-1 text-xs text-gray-500">{selectedRecommendedWord.example}</p>
          </div>
        )}

        {filteredRecommendedWords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-10 text-center text-sm text-gray-500">
            조건에 맞는 추천 단어가 없습니다. 이미 단어집에 저장했거나, 검색 조건에 맞는 단어가 없어요.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleRecommendedWords.map((item) => {
              const selected = draft.word.trim() === item.word;
              return (
                <button
                  key={`${draft.grade}-${item.word}`}
                  type="button"
                  onClick={() => handleSelectRecommendedWord(item)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-gray-900">{item.word}</p>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                      AI 생성
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
                      난이도 {item.level}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500 line-clamp-2">{item.note}</p>
                </button>
              );
            })}
          </div>
        )}

        {filteredRecommendedWords.length > visibleCount && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 8)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              추천 단어 더 보기
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">단어집 최근 카드</h3>
            <p className="mt-1 text-sm text-gray-500">저장된 카드는 여기서 바로 불러오거나 단어집에서 전체를 볼 수 있어요.</p>
          </div>
          <Link
            href="/dashboard/hanja-wordbook"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            전체 보기
          </Link>
        </div>
        {libraryLoading ? (
          <p className="mt-4 text-sm text-gray-400">저장된 카드를 불러오는 중이에요...</p>
        ) : savedCards.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">아직 저장된 카드가 없습니다. 아래에서 생성한 카드를 저장해 두면 다음 수업에서 다시 쓸 수 있어요.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {savedCards.slice(0, 4).map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => applySavedCard(card)}
                className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">{card.word}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">초등 {card.grade}학년</span>
                  {card.category && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">{card.category}</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-400">{new Date(card.updatedAt).toLocaleDateString("ko-KR")} 저장</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="activity_type" value="hanja_writing" />

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-800">직접 입력해 AI 생성</h3>
              <p className="mt-1 text-sm text-gray-500">추천 목록에 없는 단어를 써야 할 때만 사용하세요. 순우리말이나 한자 표기가 불분명한 단어는 생성하지 않습니다.</p>
            </div>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              직접 입력
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-base font-medium text-gray-700 mb-2">대상 단어</label>
              <input
                type="text"
                value={draft.word}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, word: event.target.value }));
                  setPreview(null);
                  setError("");
                }}
                placeholder="예) 전통, 의견, 공약"
                className="w-full px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 border-2 border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <p className="text-xs text-gray-500 mt-2">입력한 단어가 한자어로 확인될 때만 카드를 만듭니다.</p>
            </div>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">학년</label>
              <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-base font-medium text-gray-700">
                초등 {draft.grade}학년
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !draft.word.trim()}
            className="mt-4 w-full py-3 bg-violet-500 text-white rounded-xl font-semibold text-base hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {generating ? "AI가 한자 카드를 만들고 있어요..." : preview ? "🔁 다시 만들기" : "✨ 한자 카드 미리보기 만들기"}
          </button>
        </div>

        {preview && (
          <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/40 p-6 space-y-5">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-500">한자 카드 미리보기</p>
              <h3 className="mt-2 text-4xl font-bold text-gray-900">{preview.word}</h3>
              {preview.category && (
                <p className="mt-2 text-xs text-gray-500">분류: {preview.category}</p>
              )}
              {preview.definition && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{preview.definition}</p>
              )}
            </div>

            {preview.hanja.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 mb-2">한자 풀이</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {preview.hanja.map((h, idx) => (
                    <div key={`${h.char}-${idx}`} className="rounded-2xl bg-white border border-amber-100 p-3 flex items-center gap-3">
                      <span className="text-3xl font-bold text-amber-700">{h.char}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{h.meaning} {h.reading}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.relatedWords.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 mb-2">관련 단어</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {preview.relatedWords.map((r, idx) => (
                    <div key={`${r.word}-${idx}`} className="rounded-2xl bg-white border border-amber-100 p-3">
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

            {preview.example && (
              <div className="rounded-2xl bg-white border border-amber-100 p-3">
                <p className="text-xs font-bold text-amber-600">예시 문장</p>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">{preview.example}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveCard}
                disabled={savingCard || currentSavedCard !== null}
                className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                {currentSavedCard ? "단어집에 저장됨" : savingCard ? "저장 중..." : "단어집에 카드 저장"}
              </button>
              <p className="self-center text-xs text-gray-500">활동을 바로 시작해도 이 카드는 단어집에 자동 저장됩니다.</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-base font-medium text-gray-700 mb-3">활동 운영 시간</label>
          <DurationField
            value={draft.duration_hours}
            onChange={(durationHours) => setDraft((prev) => ({ ...prev, duration_hours: durationHours }))}
          />
        </div>

        {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={saving || !preview}
          className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "시작 중..." : "🚀 한자 활용 문장 만들기 활동 시작"}
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

function DurationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (durationHours: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { value: "4", label: "4시간", desc: "오전/오후" },
          { value: "8", label: "8시간", desc: "하루 수업" },
          { value: "24", label: "1일", desc: "하루 동안" },
          { value: "48", label: "2일", desc: "이틀 동안" },
          { value: "168", label: "1주일", desc: "한 주 동안" },
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
      {activityType === "hanja_writing" && <HanjaWritingSetup classId={classId} />}
      {activityType === "word_game" && (
        <div className="rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/50 p-10 text-center">
          <p className="text-lg font-bold text-indigo-900">🎮 필수 단어 맞추기 게임</p>
          <p className="mt-2 text-sm text-indigo-700">실시간 단어 맞추기 경쟁 게임 설정 화면이 곧 준비될 예정입니다.</p>
        </div>
      )}
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
    value === "hanja_writing" ||
    value === "word_game"
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
