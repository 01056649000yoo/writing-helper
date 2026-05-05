"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteQuestionCardSetting,
  getQuestionCardSettings,
  saveQuestionCardSetting,
} from "@/app/actions/settings-actions";
import type { QuestionCardSet } from "@/features/activities/types";

type EditableQuestionCardSet = {
  id: string;
  label: string;
  description: string;
  promptsText: string;
  isNew?: boolean;
};

export default function SettingsPage() {
  const [cardSets, setCardSets] = useState<EditableQuestionCardSet[]>([]);
  const [cardSetsLoading, setCardSetsLoading] = useState(true);
  const [cardSetsError, setCardSetsError] = useState("");
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getQuestionCardSettings().then((result) => {
      if (!active) return;
      if (result.error) {
        setCardSetsError(result.error);
      } else {
        setCardSets(result.cardSets.map(toEditableCardSet));
      }
      setCardSetsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const totalPrompts = useMemo(
    () => cardSets.reduce((count, cardSet) => count + cardSet.promptsText.split("\n").map((prompt) => prompt.trim()).filter(Boolean).length, 0),
    [cardSets]
  );

  function updateCardSet(id: string, patch: Partial<EditableQuestionCardSet>) {
    setCardSets((prev) => prev.map((cardSet) => cardSet.id === id ? { ...cardSet, ...patch } : cardSet));
  }

  function addCardSet() {
    const nextIndex = cardSets.length + 1;
    setCardSets((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        label: `새 카드 묶음 ${nextIndex}`,
        description: "",
        promptsText: "",
        isNew: true,
      },
    ]);
  }

  async function handleSaveCardSet(cardSet: EditableQuestionCardSet, index: number) {
    setSavingCardId(cardSet.id);
    setCardSetsError("");
    const result = await saveQuestionCardSetting({
      id: cardSet.isNew ? undefined : cardSet.id,
      label: cardSet.label,
      description: cardSet.description,
      prompts: cardSet.promptsText.split("\n").map((prompt) => prompt.trim()).filter(Boolean),
      sortOrder: index,
    });

    if (result.error || !result.cardSet) {
      setCardSetsError(result.error ?? "질문 카드 묶음을 저장하지 못했습니다.");
      setSavingCardId(null);
      return;
    }

    const savedCardSet = result.cardSet;
    setCardSets((prev) => prev.map((item) =>
      item.id === cardSet.id
        ? {
            ...toEditableCardSet(savedCardSet),
            isNew: false,
          }
        : item
    ));
    setSavingCardId(null);
  }

  async function handleDeleteCardSet(cardSet: EditableQuestionCardSet) {
    if (cardSet.isNew) {
      setCardSets((prev) => prev.filter((item) => item.id !== cardSet.id));
      return;
    }

    setDeletingCardId(cardSet.id);
    setCardSetsError("");
    const result = await deleteQuestionCardSetting(cardSet.id);
    if (result.error) {
      setCardSetsError(result.error);
      setDeletingCardId(null);
      return;
    }

    setCardSets((prev) => prev.filter((item) => item.id !== cardSet.id));
    setDeletingCardId(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto pt-8 pb-16">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-indigo-500 text-base hover:underline">← 대시보드로</Link>
          <button
            type="button"
            onClick={addCardSet}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            + 카드 묶음 추가
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-5xl mb-3">🃏</div>
              <h1 className="text-2xl font-bold text-gray-800">질문 카드 설정</h1>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                질문 카드 묶음의 이름, 설명, 질문 내용을 교사별로 따로 저장하고
                질문 만들기 활동에서 바로 불러와 사용할 수 있어요.
              </p>
            </div>
          </div>

          <div className="grid gap-3 mt-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold text-emerald-700">카드 묶음 수</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{cardSets.length}개</p>
            </div>
            <div className="rounded-2xl bg-sky-50 px-4 py-4">
              <p className="text-xs font-semibold text-sky-700">전체 질문 카드</p>
              <p className="text-2xl font-bold text-sky-900 mt-1">{totalPrompts}개</p>
            </div>
          </div>

          {cardSetsError && (
            <p className="mt-4 text-red-500 text-sm bg-red-50 p-4 rounded-xl">{cardSetsError}</p>
          )}

          {cardSetsLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-gray-400">
              질문 카드 설정을 불러오고 있어요...
            </div>
          ) : (
            <div className="space-y-4 mt-6">
              {cardSets.map((cardSet, index) => {
                const promptCount = cardSet.promptsText.split("\n").map((prompt) => prompt.trim()).filter(Boolean).length;
                return (
                  <div key={cardSet.id} className="rounded-3xl border border-gray-200 p-5 bg-gray-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-600">카드 묶음 {index + 1}</p>
                        <p className="text-sm text-gray-400 mt-1">{promptCount}개의 질문 카드</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCardSet(cardSet)}
                        disabled={deletingCardId === cardSet.id}
                        className="rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingCardId === cardSet.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>

                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">묶음 이름</label>
                        <input
                          value={cardSet.label}
                          onChange={(event) => updateCardSet(cardSet.id, { label: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          placeholder="예) 상상 카드"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                        <input
                          value={cardSet.description}
                          onChange={(event) => updateCardSet(cardSet.id, { description: event.target.value })}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                          placeholder="예) 보이지 않는 이야기의 빈칸을 채워보는 질문 만들기"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">질문 카드</label>
                        <textarea
                          value={cardSet.promptsText}
                          onChange={(event) => updateCardSet(cardSet.id, { promptsText: event.target.value })}
                          rows={8}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
                          placeholder={"질문을 한 줄에 하나씩 적어주세요.\n예)\n이 일이 끝난 뒤에 주인공은 어디로 갔을까?\n갑자기 비가 내린다면 이 상황은 어떻게 달라질까?"}
                        />
                        <p className="text-xs text-gray-400 mt-2">한 줄에 하나씩 저장됩니다.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveCardSet(cardSet, index)}
                      disabled={savingCardId === cardSet.id}
                      className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {savingCardId === cardSet.id ? "저장 중..." : "이 카드 묶음 저장"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toEditableCardSet(cardSet: QuestionCardSet): EditableQuestionCardSet {
  return {
    id: cardSet.id,
    label: cardSet.label,
    description: cardSet.description,
    promptsText: cardSet.prompts.join("\n"),
  };
}
