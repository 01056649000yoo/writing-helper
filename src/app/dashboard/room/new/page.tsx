"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createRoom,
  enhanceOutlineTemplateWithAI,
  getQuestionGeneratorSourceRooms,
  type QuestionGeneratorSourceRoomSummary,
  getQuestionVotingSourceRooms,
  type QuestionVotingSourceRoomSummary,
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
};

type QuestionGeneratorDraft = {
  topic: string;
  topic_description: string;
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
    summary: "핵심단어를 이용한 문장 만들기로 수업을 마무리하는 활동",
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
 * `hanja_writing`(한자 활용 문장 만들기)은 2026-08-19에 여기서 뺐다. 활동으로는 쓰지 않고
 * **한자 단어집만 남긴다** — 카드 자료를 정선해 아지트 학생 화면의 간단한 활동으로 옮길 계획이다.
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
              <p className="text-xs text-gray-400">활동을 고르면 각 활동에 맞는 설정 화면이 열립니다</p>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    topic: "오늘 수업 한 줄 정리",
    topic_description: "핵심단어를 이용해 오늘 수업을 마무리하는 한 문장을 써보세요.",
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



// `한자 활용 문장 만들기` 활동 설정 화면은 2026-08-19에 지웠다.
// 활동을 접었고, 그 화면에만 있던 한자 카드 만들기는 `/dashboard/hanja-wordbook` 으로 옮겼다.
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
