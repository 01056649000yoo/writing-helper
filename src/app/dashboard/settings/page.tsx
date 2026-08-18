"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteQuestionCardSetting,
  getQuestionCardSettings,
  saveQuestionCardSetting,
  resetDefaultQuestionCardSettings,
} from "@/app/actions/settings-actions";
import AiGenerationModal from "./ai-generation-modal";
import type { QuestionCardSet } from "@/features/activities/types";

type EditableQuestionCardSet = {
  id: string;
  label: string;
  description: string;
  promptsText: string;
  roleId: string | null;
  isNew?: boolean;
  expanded?: boolean;
};

// 핵심 질문 키워드 분류 정의
const KEYWORD_TAGS = [
  { id: "all", label: "전체", emoji: "🃏" },
  { id: "상상", label: "상상·가정", emoji: "💡" },
  { id: "마음", label: "마음·감정", emoji: "❤️" },
  { id: "감각", label: "감각·장면", emoji: "👁️" },
  { id: "이유", label: "이유·원인", emoji: "❓" },
  { id: "비교", label: "비교·선택", emoji: "⚖️" },
  { id: "변화", label: "변화·미래", emoji: "🌱" },
] as const;

function getCardKeyword(label: string): string {
  if (label.includes("상상") || label.includes("가정")) return "상상";
  if (label.includes("마음") || label.includes("감정") || label.includes("기분")) return "마음";
  if (label.includes("감각") || label.includes("소리") || label.includes("풍경")) return "감각";
  if (label.includes("이유") || label.includes("원인") || label.includes("까닭")) return "이유";
  if (label.includes("비교") || label.includes("판단") || label.includes("선택")) return "비교";
  if (label.includes("변화") || label.includes("미래") || label.includes("다짐")) return "변화";
  return "기타";
}

function getKeywordColor(keyword: string): { bg: string; text: string; border: string } {
  switch (keyword) {
    case "상상": return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" };
    case "마음": return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
    case "감각": return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "이유": return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "비교": return { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" };
    case "변화": return { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" };
    default: return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
  }
}

export default function SettingsPage() {
  const [cardSets, setCardSets] = useState<EditableQuestionCardSet[]>([]);
  const [cardSettingsLoading, setCardSettingsLoading] = useState(true);
  const [cardSettingsError, setCardSettingsError] = useState("");
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  function refreshSettings() {
    setCardSettingsLoading(true);
    getQuestionCardSettings().then((result) => {
      if (result.error) {
        setCardSettingsError(result.error);
      } else {
        setCardSets(result.cardSets.map(toEditableCardSet));
      }
      setCardSettingsLoading(false);
    });
  }

  async function handleResetDefaultRoles() {
    if (!confirm("기본 질문 카드 세트를 원본 기본값으로 되돌릴까요?\n(직접 수정한 기본 질문 내용이 초기화됩니다. 새로 추가한 카드는 유지됩니다.)")) {
      return;
    }

    setResetting(true);
    setCardSettingsError("");
    const result = await resetDefaultQuestionCardSettings();
    if (result.error) {
      setCardSettingsError(result.error);
    } else {
      refreshSettings();
    }
    setResetting(false);
  }

  useEffect(() => {
    let active = true;
    getQuestionCardSettings().then((result) => {
      if (!active) return;
      if (result.error) {
        setCardSettingsError(result.error);
      } else {
        setCardSets(result.cardSets.map(toEditableCardSet));
      }
      setCardSettingsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const totalPrompts = useMemo(
    () => cardSets.reduce((count, c) => count + c.promptsText.split("\n").map((p) => p.trim()).filter(Boolean).length, 0),
    [cardSets]
  );

  function updateCardSet(id: string, patch: Partial<EditableQuestionCardSet>) {
    setCardSets((prev) => prev.map((cardSet) => cardSet.id === id ? { ...cardSet, ...patch } : cardSet));
  }

  function addCardSet() {
    const nextIndex = cardSets.length + 1;
    setCardSets((prev) => [
      {
        id: `draft-card-${Date.now()}`,
        label: `새 질문 카드 ${nextIndex}`,
        description: "질문의 목적이나 방향을 적어주세요.",
        promptsText: "1. 질문 힌트 문장 1\n2. 질문 힌트 문장 2",
        roleId: null,
        isNew: true,
        expanded: true,
      },
      ...prev,
    ]);
  }

  async function handleSaveCardSet(cardSet: EditableQuestionCardSet, index: number) {
    setSavingCardId(cardSet.id);
    setCardSettingsError("");
    const result = await saveQuestionCardSetting({
      id: cardSet.isNew ? undefined : cardSet.id,
      label: cardSet.label,
      description: cardSet.description,
      prompts: cardSet.promptsText.split("\n").map((prompt) => prompt.trim()).filter(Boolean),
      roleId: cardSet.roleId,
      sortOrder: index,
    });

    if (result.error || !result.cardSet) {
      setCardSettingsError(result.error ?? "질문 카드를 저장하지 못했습니다.");
      setSavingCardId(null);
      return;
    }

    setCardSets((prev) => prev.map((item) => (
      item.id === cardSet.id
        ? { ...toEditableCardSet(result.cardSet!), isNew: false, expanded: false }
        : item
    )));
    setSavingCardId(null);
  }

  async function handleDeleteCardSet(cardSet: EditableQuestionCardSet) {
    if (cardSet.isNew) {
      setCardSets((prev) => prev.filter((item) => item.id !== cardSet.id));
      return;
    }
    if (!confirm(`「${cardSet.label}」 카드를 삭제할까요?`)) return;

    setDeletingCardId(cardSet.id);
    setCardSettingsError("");
    const result = await deleteQuestionCardSetting(cardSet.id);
    if (result.error) {
      setCardSettingsError(result.error);
      setDeletingCardId(null);
      return;
    }

    setCardSets((prev) => prev.filter((item) => item.id !== cardSet.id));
    setDeletingCardId(null);
  }

  // 필터링된 카드 목록
  const filteredCardSets = useMemo(() => {
    return cardSets.filter((card) => {
      const keyword = getCardKeyword(card.label);
      const matchesTag = activeTag === "all" || keyword === activeTag;
      const matchesSearch =
        !searchQuery.trim() ||
        card.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.promptsText.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [cardSets, activeTag, searchQuery]);

  return (
    <main className="lab-page">
      <div className="lab-page__content lab-page__content--medium space-y-6">
        {/* 상단 헤더 */}
        <div className="lab-panel lab-panel--raised p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🃏</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">질문 카드 보관함</h1>
              <p className="text-sm text-gray-500 mt-1">
                질문의 핵심 키워드별로 카드를 정리하고, 학생들에게 제공할 질문 힌트 문장을 자유롭게 추가·수정할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-indigo-700">질문 카드 묶음</p>
              <p className="text-2xl font-bold text-indigo-950 mt-1">{cardSets.length}개</p>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-700">전체 질문 힌트</p>
              <p className="text-2xl font-bold text-emerald-950 mt-1">{totalPrompts}개</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-amber-700">핵심 키워드 분류</p>
              <p className="text-2xl font-bold text-amber-950 mt-1">6대 영역</p>
            </div>
          </div>
        </div>

        {/* 액션 및 필터 바 */}
        <div className="lab-panel lab-panel--raised p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏷️</span>
              <h2 className="text-lg font-bold text-gray-800">질문 키워드별 카드 목록</h2>
              <span className="text-xs font-semibold text-gray-400">({filteredCardSets.length}개)</span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleResetDefaultRoles}
                disabled={resetting}
                className="rounded-xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600 px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all disabled:opacity-50"
              >
                {resetting ? "초기화 중..." : "🔄 기본값 되돌리기"}
              </button>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-2xs whitespace-nowrap transition-all"
              >
                ✨ AI 질문 카드 생성
              </button>
              <button
                type="button"
                onClick={addCardSet}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap transition-colors"
              >
                + 새 카드 추가
              </button>
            </div>
          </div>

          {/* 검색 및 키워드 탭 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-y border-gray-100 py-3">
            {/* 키워드 필터 탭 */}
            <div className="flex flex-wrap gap-1.5">
              {KEYWORD_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setActiveTag(tag.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTag === tag.id
                      ? "bg-gray-800 text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tag.emoji} {tag.label}
                </button>
              ))}
            </div>

            {/* 검색창 */}
            <input
              type="text"
              placeholder="질문 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-48"
            />
          </div>

          {cardSettingsError && (
            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl font-medium">{cardSettingsError}</p>
          )}

          {/* 질문 카드 그리드 */}
          {cardSettingsLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
              질문 카드를 불러오고 있어요...
            </div>
          ) : filteredCardSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
              해당하는 질문 카드가 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCardSets.map((card, index) => {
                const keyword = getCardKeyword(card.label);
                const color = getKeywordColor(keyword);
                const prompts = card.promptsText.split("\n").map((p) => p.trim()).filter(Boolean);

                return (
                  <div
                    key={card.id}
                    className={`rounded-2xl border bg-white shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4 ${
                      card.isNew ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200/90"
                    }`}
                  >
                    {/* 카드 헤더 */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                          {keyword}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCardSet(card.id, { expanded: !card.expanded })}
                            className="text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-0.5 rounded hover:bg-gray-100"
                          >
                            {card.expanded ? "접기 ▲" : "수정하기 ✏️"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCardSet(card)}
                            disabled={deletingCardId === card.id}
                            className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-0.5 rounded hover:bg-rose-50"
                          >
                            삭제
                          </button>
                        </div>
                      </div>

                      {card.expanded ? (
                        <div className="space-y-3 mt-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">카드 제목</label>
                            <input
                              type="text"
                              value={card.label}
                              onChange={(e) => updateCardSet(card.id, { label: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">카드 설명</label>
                            <input
                              type="text"
                              value={card.description}
                              onChange={(e) => updateCardSet(card.id, { description: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-700 mb-1">
                              질문 힌트 목록 (한 줄에 하나씩)
                            </label>
                            <textarea
                              rows={5}
                              value={card.promptsText}
                              onChange={(e) => updateCardSet(card.id, { promptsText: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded-lg p-2.5 text-gray-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-300 font-mono"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => updateCardSet(card.id, { expanded: false })}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                              닫기
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveCardSet(card, index)}
                              disabled={savingCardId === card.id}
                              className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                            >
                              {savingCardId === card.id ? "저장 중..." : "저장 완료"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-bold text-gray-900 text-base">{card.label}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>

                          {/* 포함된 질문 힌트 미리보기 목록 */}
                          <div className="mt-3.5 space-y-1.5 border-t border-gray-100 pt-3">
                            <p className="text-[11px] font-bold text-gray-400 mb-1">
                              포함된 질문 ({prompts.length}개)
                            </p>
                            {prompts.slice(0, 3).map((prompt, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-1.5 text-xs text-gray-700 leading-snug">
                                <span className="text-indigo-400 font-bold">·</span>
                                <span className="truncate">{prompt}</span>
                              </div>
                            ))}
                            {prompts.length > 3 && (
                              <p className="text-[10px] text-gray-400 italic">
                                외 {prompts.length - 3}개 질문 더보기...
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isAiModalOpen && (
        <AiGenerationModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onSuccess={() => {
            setIsAiModalOpen(false);
            refreshSettings();
          }}
        />
      )}
    </main>
  );
}

function toEditableCardSet(cardSet: QuestionCardSet): EditableQuestionCardSet {
  return {
    id: cardSet.id,
    label: cardSet.label,
    description: cardSet.description,
    promptsText: cardSet.prompts.join("\n"),
    roleId: null,
    expanded: false,
  };
}
