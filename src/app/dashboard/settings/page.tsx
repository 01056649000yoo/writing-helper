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
import {
  OTHER_QUESTION_AREA,
  QUESTION_AREAS,
  getCardKeywordBadge,
  getQuestionAreaId,
} from "@/features/activities/question-generator/areas";

type EditableQuestionCardSet = {
  id: string;
  label: string;
  description: string;
  prompts: string[];
  roleId: string | null;
  isNew?: boolean;
  isEditing?: boolean;
  isExpanded?: boolean;
};

// 카테고리 기준의 원본은 features/activities/question-generator/areas.ts 하나다(학생 화면과 같은 기준).
const KEYWORD_TAGS = [
  { id: "all", label: "전체", emoji: "🃏" },
  ...QUESTION_AREAS.map((area) => ({ id: area.id as string, label: area.label, emoji: area.emoji })),
] as const;

function getCardCategory(label: string): string {
  return getQuestionAreaId(label);
}

function getCardBadge(label: string): string {
  return getCardKeywordBadge(label);
}

function getKeywordColor(category: string): { bg: string; text: string; border: string; emoji: string } {
  const area = QUESTION_AREAS.find((entry) => entry.id === category) ?? OTHER_QUESTION_AREA;
  return { ...area.chip, emoji: area.emoji };
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
    () => cardSets.reduce((count, c) => count + c.prompts.filter(Boolean).length, 0),
    [cardSets]
  );

  function updateCardSet(id: string, patch: Partial<EditableQuestionCardSet>) {
    setCardSets((prev) => prev.map((cardSet) => cardSet.id === id ? { ...cardSet, ...patch } : cardSet));
  }

  function addCardSet() {
    const nextIndex = cardSets.length + 1;
    const newCard: EditableQuestionCardSet = {
      id: `draft-card-${Date.now()}`,
      label: `새 질문 카드 ${nextIndex}`,
      description: "질문의 목적이나 방향을 적어주세요.",
      prompts: ["질문 힌트 문장 1", "질문 힌트 문장 2"],
      roleId: null,
      isNew: true,
      isEditing: true,
      isExpanded: true,
    };
    setCardSets((prev) => [newCard, ...prev]);
  }

  async function handleSaveCardSet(cardSet: EditableQuestionCardSet, index: number) {
    const validPrompts = cardSet.prompts.map((p) => p.trim()).filter(Boolean);
    if (!cardSet.label.trim()) {
      setCardSettingsError("카드 제목을 입력해주세요.");
      return;
    }
    if (validPrompts.length === 0) {
      setCardSettingsError("최소 1개 이상의 질문 힌트를 입력해주세요.");
      return;
    }

    setSavingCardId(cardSet.id);
    setCardSettingsError("");
    const result = await saveQuestionCardSetting({
      id: cardSet.isNew ? undefined : cardSet.id,
      label: cardSet.label.trim(),
      description: cardSet.description.trim(),
      prompts: validPrompts,
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
        ? { ...toEditableCardSet(result.cardSet!), isNew: false, isEditing: false, isExpanded: true }
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
      const category = getCardCategory(card.label);
      const matchesTag = activeTag === "all" || category === activeTag;
      const matchesSearch =
        !searchQuery.trim() ||
        card.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.prompts.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
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
              <p className="text-2xl font-bold text-amber-950 mt-1">6대 영역 (100% 매핑)</p>
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
              placeholder="질문 또는 키워드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full sm:w-56"
            />
          </div>

          {cardSettingsError && (
            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl font-medium">{cardSettingsError}</p>
          )}

          {/* 질문 카드 리스트 (아코디언 형태) */}
          {cardSettingsLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
              질문 카드를 불러오고 있어요...
            </div>
          ) : filteredCardSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
              해당하는 질문 카드가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCardSets.map((card, index) => {
                const category = getCardCategory(card.label);
                const badge = getCardBadge(card.label);
                const color = getKeywordColor(category);

                return (
                  <div
                    key={card.id}
                    className={`rounded-2xl border bg-white shadow-2xs transition-all overflow-hidden ${
                      card.isNew
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : card.isEditing
                          ? "border-indigo-300 shadow-sm"
                          : "border-gray-200/90 hover:border-gray-300"
                    }`}
                  >
                    {/* 카드 요약 헤더 바 */}
                    <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 shrink-0 ${color.bg} ${color.text} ${color.border}`}>
                          <span>{color.emoji}</span>
                          <span>{badge}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                              {card.label}
                            </h3>
                            <span className="text-[11px] font-semibold text-gray-400 shrink-0">
                              (질문 {card.prompts.length}개)
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {card.description || "설명 없음"}
                          </p>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!card.isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateCardSet(card.id, { isExpanded: !card.isExpanded })}
                              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                            >
                              {card.isExpanded ? "질문 접기 ▲" : "질문 보기 👁️"}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateCardSet(card.id, { isEditing: true, isExpanded: true })}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                            >
                              수정 ✏️
                            </button>
                          </>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleDeleteCardSet(card)}
                          disabled={deletingCardId === card.id}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {/* 1. 조회 모드: 질문 힌트 목록 펼침 */}
                    {card.isExpanded && !card.isEditing && (
                      <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-gray-50/50 space-y-2">
                        <p className="text-[11px] font-bold text-gray-500 mt-2 mb-1">
                          포함된 질문 힌트 목록 ({card.prompts.length}개)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {card.prompts.map((prompt, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-3 rounded-xl bg-white border border-gray-200/80 shadow-2xs flex items-start gap-2.5 text-xs text-gray-800 leading-relaxed font-medium"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                {pIdx + 1}
                              </span>
                              <span className="flex-1">{prompt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. 편집 모드: 개별 질문 수정 입력 패널 */}
                    {card.isEditing && (
                      <div className="px-5 pb-5 pt-3 border-t border-indigo-100 bg-indigo-50/20 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">카드 제목</label>
                            <input
                              type="text"
                              value={card.label}
                              onChange={(e) => updateCardSet(card.id, { label: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">카드 설명</label>
                            <input
                              type="text"
                              value={card.description}
                              onChange={(e) => updateCardSet(card.id, { description: e.target.value })}
                              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>
                        </div>

                        {/* 개별 질문 리스트 수정 */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold text-gray-700">
                              질문 힌트 문장 ({card.prompts.length}개)
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                updateCardSet(card.id, {
                                  prompts: [...card.prompts, "새 질문 힌트를 입력하세요."],
                                });
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              + 질문 추가
                            </button>
                          </div>

                          <div className="space-y-2">
                            {card.prompts.map((prompt, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-600 text-[11px] font-bold">
                                  {pIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={prompt}
                                  onChange={(e) => {
                                    const nextPrompts = [...card.prompts];
                                    nextPrompts[pIdx] = e.target.value;
                                    updateCardSet(card.id, { prompts: nextPrompts });
                                  }}
                                  className="w-full text-xs text-gray-800 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextPrompts = card.prompts.filter((_, idx) => idx !== pIdx);
                                    updateCardSet(card.id, { prompts: nextPrompts });
                                  }}
                                  className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-0.5 rounded"
                                  title="질문 삭제"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 저장 및 취소 버튼 */}
                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200/60">
                          <button
                            type="button"
                            onClick={() => {
                              if (card.isNew) {
                                setCardSets((prev) => prev.filter((item) => item.id !== card.id));
                              } else {
                                updateCardSet(card.id, { isEditing: false });
                              }
                            }}
                            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-xl"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCardSet(card, index)}
                            disabled={savingCardId === card.id}
                            className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs transition-all disabled:opacity-50"
                          >
                            {savingCardId === card.id ? "저장 중..." : "저장 완료"}
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
    prompts: [...cardSet.prompts],
    roleId: null,
    isEditing: false,
    isExpanded: false,
  };
}
