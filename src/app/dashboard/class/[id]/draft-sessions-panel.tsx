"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ActivityType } from "@/features/activities/types";
import {
  clearActivityDraft,
  listActivityDraftsForClass,
  type ActivityDraftSummary,
} from "@/lib/activity-drafts";

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  outline_builder: "글 개요 짜기",
  question_generator: "질문 카드로 질문 바꾸기",
  question_voting: "좋은 질문 고르기",
};

const ACTIVITY_EMOJI: Record<ActivityType, string> = {
  outline_builder: "📝",
  question_generator: "❓",
  question_voting: "🗳️",
};

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
            <Link href={`/dashboard/room/new?class_id=${classId}&activity_type=${draft.activityType}`} className="block">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{ACTIVITY_EMOJI[draft.activityType]}</span>
                <span className="text-sm bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">초안</span>
              </div>
              <h3 className="font-bold text-gray-800 text-base">
                {draft.topic || ACTIVITY_LABEL[draft.activityType]}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                활동: {ACTIVITY_LABEL[draft.activityType]}
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
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {confirmingDeleteKey === draft.storageKey ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteKey(null)}
                    className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-200"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(draft.storageKey)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-100"
                  >
                    삭제 확인
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteKey(draft.storageKey)}
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-100"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
