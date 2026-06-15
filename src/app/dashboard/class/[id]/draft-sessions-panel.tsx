"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActivityType } from "@/features/activities/types";
import {
  clearActivityDraft,
  listActivityDraftsForClass,
  type ActivityDraftSummary,
  type DraftActivitySlug,
} from "@/lib/activity-drafts";

const WRITING_LABEL: Record<ActivityType, string> = {
  outline_builder: "글 개요 짜기",
  question_generator: "질문 만들기",
  question_voting: "좋은 질문 고르기",
  one_line_share: "한줄모아",
  hanja_writing: "한자 활용 문장 만들기",
  word_game: "필수 단어 맞추기 게임",
};

const WRITING_EMOJI: Record<ActivityType, string> = {
  outline_builder: "📝",
  question_generator: "❓",
  question_voting: "🗳️",
  one_line_share: "💬",
  hanja_writing: "📜",
  word_game: "🎮",
};

const SUBJECT_LABEL: Record<"science" | "morals", string> = {
  science: "과학 탐구 글쓰기",
  morals: "도덕 가치 글쓰기",
};
const SUBJECT_EMOJI: Record<"science" | "morals", string> = {
  science: "🔬",
  morals: "🪞",
};

function labelFor(slug: DraftActivitySlug): string {
  if (slug === "science" || slug === "morals") return SUBJECT_LABEL[slug];
  return WRITING_LABEL[slug];
}
function emojiFor(slug: DraftActivitySlug): string {
  if (slug === "science" || slug === "morals") return SUBJECT_EMOJI[slug];
  return WRITING_EMOJI[slug];
}

function getDraftTitle(draft: ActivityDraftSummary) {
  if (draft.activitySlug === "question_voting") {
    const base = draft.sourceRoomTopic || draft.sourceRoomTitle || draft.topic;
    return base ? `${base} 질문 고르기` : labelFor(draft.activitySlug);
  }
  return draft.topic || labelFor(draft.activitySlug);
}

function hrefFor(draft: ActivityDraftSummary): string {
  if (draft.kind === "science") return `/dashboard/science/new?class_id=${draft.classId}`;
  if (draft.kind === "morals") return `/dashboard/morals/new?class_id=${draft.classId}`;
  return `/dashboard/room/new?class_id=${draft.classId}&activity_type=${draft.activitySlug}`;
}

export function DraftSessionsPanel({ classId }: { classId: string }) {
  const [drafts, setDrafts] = useState<ActivityDraftSummary[]>([]);
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(listActivityDraftsForClass(classId));
  }, [classId]);

  function handleDeleteDraft(storageKey: string) {
    clearActivityDraft(storageKey);
    setDrafts((prev) => prev.filter((draft) => draft.storageKey !== storageKey));
    setConfirmingDeleteKey(null);
  }

  if (drafts.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">🟡 이어서 수정할 활동 초안 ({drafts.length})</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {drafts.map((draft) => (
          <div key={draft.storageKey} className="relative bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
            <Link href={hrefFor(draft)} className="block">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{emojiFor(draft.activitySlug)}</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">초안</span>
              </div>
              <h3 className="font-bold text-gray-800 text-base">
                {getDraftTitle(draft)}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                활동: {labelFor(draft.activitySlug)}
              </p>
              {draft.topicDescription && (
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">{draft.topicDescription}</p>
              )}
              <p className="text-sm text-gray-400 mt-3">
                {draft.savedAt
                  ? `마지막 저장: ${new Date(draft.savedAt).toLocaleString("ko-KR")}`
                  : "저장 시각 정보 없음"}
              </p>
            </Link>
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              {confirmingDeleteKey === draft.storageKey ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmingDeleteKey(null);
                    }}
                    className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteDraft(draft.storageKey);
                    }}
                    className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 shadow-sm transition-colors"
                  >
                    삭제
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmingDeleteKey(draft.storageKey);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="삭제"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
