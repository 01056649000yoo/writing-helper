"use client";

import { useState } from "react";
import type { QuestionGeneratorSubmission } from "@/features/activities/types";

type QuestionSelection = QuestionGeneratorSubmission["selections"][number];

export function QuestionCardVisibilityButton({
  showQuestionCards,
  onToggle,
  className = "",
}: {
  showQuestionCards: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={showQuestionCards}
      onClick={onToggle}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
        showQuestionCards
          ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      } ${className}`}
    >
      {showQuestionCards ? "질문만 보기" : "🃏 카드와 함께보기"}
    </button>
  );
}

/** 서버에서 조회한 교사 개별 결과 중 질문 부분만 클라이언트에서 펼치고 접는다. */
export function TeacherQuestionGeneratorResultList({
  selections,
}: {
  selections: QuestionSelection[];
}) {
  const [showQuestionCards, setShowQuestionCards] = useState(false);
  const hasQuestionSourceCards = selections.some((selection) => Boolean(selection.originalPrompt));

  return (
    <div className="space-y-4">
      {hasQuestionSourceCards && (
        <div className="flex justify-end">
          <QuestionCardVisibilityButton
            showQuestionCards={showQuestionCards}
            onToggle={() => setShowQuestionCards((current) => !current)}
          />
        </div>
      )}

      <div className="grid gap-4">
        {selections.map((selection, index) => (
          <div key={selection.id} className="bg-sky-50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-sky-600 uppercase tracking-wide">
                  질문 {index + 1}
                </p>
                <h2 className="text-lg font-bold text-gray-800 mt-1">{selection.cardSetLabel}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {selection.method === "direct" ? "직접 질문 만들기" : "질문 카드로 바꾸기"}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                질문 완성
              </span>
            </div>

            {showQuestionCards && selection.originalPrompt && (
              <div className="rounded-2xl bg-white/80 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                <p className="text-sm text-gray-800 leading-relaxed">{selection.originalPrompt}</p>
              </div>
            )}

            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs font-semibold text-sky-700 mb-2">학생이 만든 질문</p>
              <p className="text-base font-medium text-sky-950 leading-relaxed">{selection.remixedQuestion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
