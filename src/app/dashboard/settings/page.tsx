"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteQuestionCardSetting,
  deleteQuestionSet,
  getQuestionCardSettings,
  getTeacherQuestionSets,
  saveQuestionCardSetting,
} from "@/app/actions/settings-actions";
import type { QuestionCardSet, QuestionSet } from "@/features/activities/types";

type EditableQuestionCardSet = {
  id: string;
  label: string;
  description: string;
  promptsText: string;
  isNew?: boolean;
  expanded?: boolean;
};

export default function SettingsPage() {
  const router = useRouter();

  // 기본 카드 묶음 (지금까지의 기능)
  const [cardSets, setCardSets] = useState<EditableQuestionCardSet[]>([]);
  const [cardSetsLoading, setCardSetsLoading] = useState(true);
  const [cardSetsError, setCardSetsError] = useState("");
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // 질문 세트 (교사 큐레이션)
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [questionSetsLoading, setQuestionSetsLoading] = useState(true);
  const [questionSetsError, setQuestionSetsError] = useState("");
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getQuestionCardSettings().then((result) => {
      if (!active) return;
      if (result.error) setCardSetsError(result.error);
      else setCardSets(result.cardSets.map(toEditableCardSet));
      setCardSetsLoading(false);
    });

    getTeacherQuestionSets().then((result) => {
      if (!active) return;
      if (result.error) setQuestionSetsError(result.error);
      else setQuestionSets(result.sets);
      setQuestionSetsLoading(false);
    });

    return () => { active = false; };
  }, []);

  const totalPrompts = useMemo(
    () => cardSets.reduce((count, c) => count + c.promptsText.split("\n").map((p) => p.trim()).filter(Boolean).length, 0),
    [cardSets]
  );

  function updateCardSet(id: string, patch: Partial<EditableQuestionCardSet>) {
    setCardSets((prev) => prev.map((cs) => cs.id === id ? { ...cs, ...patch } : cs));
  }

  function toggleExpand(id: string) {
    setCardSets((prev) => prev.map((cs) => cs.id === id ? { ...cs, expanded: !cs.expanded } : cs));
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
        expanded: true,
      },
    ]);
  }

  async function handleSaveCardSet(cs: EditableQuestionCardSet, index: number) {
    setSavingCardId(cs.id);
    setCardSetsError("");
    const result = await saveQuestionCardSetting({
      id: cs.isNew ? undefined : cs.id,
      label: cs.label,
      description: cs.description,
      prompts: cs.promptsText.split("\n").map((p) => p.trim()).filter(Boolean),
      sortOrder: index,
    });

    if (result.error || !result.cardSet) {
      setCardSetsError(result.error ?? "질문 카드 묶음을 저장하지 못했습니다.");
      setSavingCardId(null);
      return;
    }

    const saved = result.cardSet;
    setCardSets((prev) => prev.map((item) =>
      item.id === cs.id
        ? { ...toEditableCardSet(saved), isNew: false, expanded: false }
        : item
    ));
    setSavingCardId(null);
  }

  async function handleDeleteCardSet(cs: EditableQuestionCardSet) {
    if (cs.isNew) {
      setCardSets((prev) => prev.filter((item) => item.id !== cs.id));
      return;
    }
    if (!confirm("이 카드 묶음을 삭제할까요?")) return;
    setDeletingCardId(cs.id);
    setCardSetsError("");
    const result = await deleteQuestionCardSetting(cs.id);
    if (result.error) {
      setCardSetsError(result.error);
      setDeletingCardId(null);
      return;
    }
    setCardSets((prev) => prev.filter((item) => item.id !== cs.id));
    setDeletingCardId(null);
  }

  async function handleDeleteSet(set: QuestionSet) {
    if (!confirm(`「${set.name}」 세트를 삭제할까요?`)) return;
    setDeletingSetId(set.id);
    setQuestionSetsError("");
    const result = await deleteQuestionSet(set.id);
    if (result.error) {
      setQuestionSetsError(result.error);
      setDeletingSetId(null);
      return;
    }
    setQuestionSets((prev) => prev.filter((s) => s.id !== set.id));
    setDeletingSetId(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto pt-8 pb-16 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-indigo-500 text-base hover:underline">← 대시보드로</Link>
        </div>

        {/* ─── 헤더 + 통계 ─── */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-gray-800">질문 카드 설정</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            기본 카드 묶음을 편집하거나, 여러 묶음에서 골라 나만의 <strong>질문 세트</strong>를 만들 수 있어요.
            질문 만들기 활동에서 묶음 대신 세트를 쓸 수도 있어요.
          </p>

          <div className="grid gap-3 mt-6 grid-cols-3">
            <Stat label="카드 묶음" value={`${cardSets.length}개`} tone="emerald" />
            <Stat label="전체 질문" value={`${totalPrompts}개`} tone="sky" />
            <Stat label="내 질문 세트" value={`${questionSets.length}개`} tone="amber" />
          </div>
        </div>

        {/* ─── 내 질문 세트 ─── */}
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">📚 내 질문 세트</h2>
              <p className="text-sm text-gray-500 mt-1">
                기본 카드 묶음의 질문들에서 골라 만든 큐레이션 세트입니다.
              </p>
            </div>
            <Link
              href="/dashboard/settings/sets/new"
              className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 whitespace-nowrap"
            >
              + 새 세트 만들기
            </Link>
          </div>

          {questionSetsError && (
            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{questionSetsError}</p>
          )}

          {questionSetsLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-gray-400">
              질문 세트를 불러오고 있어요...
            </div>
          ) : questionSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-6 py-10 text-center">
              <p className="text-sm text-amber-700">
                아직 만든 세트가 없어요. 위의 「+ 새 세트 만들기」를 눌러 첫 세트를 만들어 보세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {questionSets.map((set) => (
                <div key={set.id} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-800">{set.name}</h3>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap font-semibold">
                      {set.items.length}개
                    </span>
                  </div>
                  {set.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{set.description}</p>
                  )}
                  <div className="flex-1" />
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/settings/sets/${set.id}`)}
                      className="flex-1 rounded-xl bg-white border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSet(set)}
                      disabled={deletingSetId === set.id}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingSetId === set.id ? "삭제..." : "삭제"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── 기본 카드 묶음 ─── */}
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">🎴 기본 카드 묶음</h2>
              <p className="text-sm text-gray-500 mt-1">
                질문 만들기 활동에서 통째로 선택해 쓸 수 있는 묶음들. 클릭해서 펼치면 편집할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={addCardSet}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 whitespace-nowrap"
            >
              + 카드 묶음 추가
            </button>
          </div>

          {cardSetsError && (
            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{cardSetsError}</p>
          )}

          {cardSetsLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-gray-400">
              질문 카드 설정을 불러오고 있어요...
            </div>
          ) : (
            <div className="space-y-3">
              {cardSets.map((cs, index) => {
                const promptCount = cs.promptsText.split("\n").map((p) => p.trim()).filter(Boolean).length;
                return (
                  <div key={cs.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden">
                    {/* Collapsed header */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(cs.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">
                            {cs.label || "(이름 없음)"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{cs.description || "설명 없음"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs bg-white border border-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                          {promptCount}개
                        </span>
                        <span className={`text-gray-400 transition-transform ${cs.expanded ? "rotate-180" : ""}`}>▾</span>
                      </div>
                    </button>

                    {/* Expanded editor */}
                    {cs.expanded && (
                      <div className="border-t border-gray-200 bg-white px-5 py-5 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">묶음 이름</label>
                          <input
                            value={cs.label}
                            onChange={(e) => updateCardSet(cs.id, { label: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="예) 상상 카드"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                          <input
                            value={cs.description}
                            onChange={(e) => updateCardSet(cs.id, { description: e.target.value })}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            placeholder="예) 보이지 않는 이야기의 빈칸을 채워보는 질문 만들기"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">질문 카드</label>
                          <textarea
                            value={cs.promptsText}
                            onChange={(e) => updateCardSet(cs.id, { promptsText: e.target.value })}
                            rows={8}
                            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 leading-6 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
                            placeholder={"질문을 한 줄에 하나씩 적어주세요.\n예)\n이 일이 끝난 뒤에 주인공은 어디로 갔을까?"}
                          />
                          <p className="text-xs text-gray-400 mt-2">한 줄에 하나씩 저장됩니다.</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveCardSet(cs, index)}
                            disabled={savingCardId === cs.id}
                            className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                          >
                            {savingCardId === cs.id ? "저장 중..." : "저장"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCardSet(cs)}
                            disabled={deletingCardId === cs.id}
                            className="rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingCardId === cs.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </div>
                    )}
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

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" | "amber" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  const valueClass = {
    emerald: "text-emerald-900",
    sky: "text-sky-900",
    amber: "text-amber-900",
  }[tone];
  return (
    <div className={`rounded-2xl ${toneClass} px-4 py-4`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
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
