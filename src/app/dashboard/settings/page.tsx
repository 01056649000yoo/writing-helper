"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteQuestionCardRole,
  deleteQuestionCardSetting,
  getQuestionCardSettings,
  saveQuestionCardRole,
  saveQuestionCardSetting,
  checkHasApiKey,
} from "@/app/actions/settings-actions";
import AiGenerationModal from "./ai-generation-modal";
import type { QuestionCardRole, QuestionCardSet } from "@/features/activities/types";

type EditableQuestionCardSet = {
  id: string;
  label: string;
  description: string;
  promptsText: string;
  roleId: string | null;
  isNew?: boolean;
  expanded?: boolean;
};

type EditableQuestionCardRole = {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  cardSetIds: string[];
  expanded?: boolean;
  isNew?: boolean;
};

export default function SettingsPage() {
  const [roles, setRoles] = useState<EditableQuestionCardRole[]>([]);
  const [cardSets, setCardSets] = useState<EditableQuestionCardSet[]>([]);
  const [cardSettingsLoading, setCardSettingsLoading] = useState(true);
  const [cardSettingsError, setCardSettingsError] = useState("");
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  function refreshSettings() {
    setCardSettingsLoading(true);
    getQuestionCardSettings().then((result) => {
      if (result.error) {
        setCardSettingsError(result.error);
      } else {
        setRoles(result.roles.map(toEditableRole));
        setCardSets(result.cardSets.map(toEditableCardSet));
      }
      setCardSettingsLoading(false);
    });
  }

  useEffect(() => {
    let active = true;

    checkHasApiKey().then((hasKey) => {
      if (active) setHasApiKey(hasKey);
    });

    getQuestionCardSettings().then((result) => {
      if (!active) return;
      if (result.error) {
        setCardSettingsError(result.error);
      } else {
        setRoles(result.roles.map(toEditableRole));
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

  const roleCardSetCount = useMemo(
    () => roles.reduce((count, role) => count + cardSets.filter((cardSet) => cardSet.roleId === role.id).length, 0),
    [cardSets, roles],
  );

  function updateRole(id: string, patch: Partial<EditableQuestionCardRole>) {
    setRoles((prev) => prev.map((role) => role.id === id ? { ...role, ...patch } : role));
  }

  function updateCardSet(id: string, patch: Partial<EditableQuestionCardSet>) {
    setCardSets((prev) => prev.map((cardSet) => cardSet.id === id ? { ...cardSet, ...patch } : cardSet));
  }

  function toggleRoleExpand(id: string) {
    setRoles((prev) => prev.map((role) => role.id === id ? { ...role, expanded: !role.expanded } : role));
  }

  function addRole() {
    const nextIndex = roles.length + 1;
    setRoles((prev) => [
      ...prev,
      {
        id: `draft-role-${Date.now()}`,
        label: `새 역할 ${nextIndex}`,
        subtitle: "",
        description: "",
        icon: "🃏",
        cardSetIds: [],
        expanded: true,
        isNew: true,
      },
    ]);
  }

  function addCardSet(roleId: string) {
    const role = roles.find((item) => item.id === roleId);
    const nextIndex = cardSets.filter((cardSet) => cardSet.roleId === roleId).length + 1;

    setCardSets((prev) => [
      ...prev,
      {
        id: `draft-card-${Date.now()}`,
        label: `${role?.label ?? "새 역할"} 카드 ${nextIndex}`,
        description: "",
        promptsText: "",
        roleId,
        isNew: true,
        expanded: true,
      },
    ]);
    setRoles((prev) => prev.map((item) => item.id === roleId ? { ...item, expanded: true } : item));
  }

  async function handleSaveRole(role: EditableQuestionCardRole, index: number) {
    setSavingRoleId(role.id);
    setCardSettingsError("");
    const result = await saveQuestionCardRole({
      id: role.isNew ? undefined : role.id,
      label: role.label,
      subtitle: role.subtitle,
      description: role.description,
      icon: role.icon,
      sortOrder: index,
    });

    if (result.error || !result.role) {
      setCardSettingsError(result.error ?? "질문 카드 역할을 저장하지 못했습니다.");
      setSavingRoleId(null);
      return;
    }

    setRoles((prev) => prev.map((item) => (
      item.id === role.id
        ? { ...item, ...toEditableRole(result.role!), isNew: false, expanded: false }
        : item
    )));
    setCardSets((prev) => prev.map((cardSet) => (
      cardSet.roleId === role.id ? { ...cardSet, roleId: result.role!.id } : cardSet
    )));
    setSavingRoleId(null);
  }

  async function handleDeleteRole(role: EditableQuestionCardRole) {
    if (role.isNew) {
      setCardSets((prev) => prev.filter((cardSet) => cardSet.roleId !== role.id));
      setRoles((prev) => prev.filter((item) => item.id !== role.id));
      return;
    }
    if (!confirm(`「${role.label}」 역할을 삭제할까요?`)) return;

    setDeletingRoleId(role.id);
    setCardSettingsError("");
    const result = await deleteQuestionCardRole(role.id);
    if (result.error) {
      setCardSettingsError(result.error);
      setDeletingRoleId(null);
      return;
    }

    setRoles((prev) => prev.filter((item) => item.id !== role.id));
    setDeletingRoleId(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto pt-8 pb-16 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-indigo-500 text-base hover:underline">← 대시보드로</Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-gray-800">질문 카드 설정</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            연구원 역할 아래에 질문 카드를 트리처럼 정리해 둘 수 있어요.
            역할도 직접 만들고, 역할 안의 질문 카드도 추가하거나 수정해서 학생용 질문 만들기 흐름에 그대로 반영할 수 있습니다.
          </p>

          <div className="grid gap-3 mt-6 grid-cols-4">
            <Stat label="연구원 역할" value={`${roles.length}개`} tone="emerald" />
            <Stat label="역할별 카드" value={`${roleCardSetCount}개`} tone="sky" />
            <Stat label="전체 질문" value={`${totalPrompts}개`} tone="amber" />
            <Stat label="질문 카드 묶음" value={`${cardSets.length}개`} tone="indigo" />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-gray-800">🧭 연구원 역할 트리</h2>
              <p className="text-sm text-gray-500 mt-1">
                학생 질문 만들기에서 보이는 역할과 그 안의 질문 카드들을 여기서 관리합니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                disabled={!hasApiKey}
                title={!hasApiKey ? "AI 기능을 사용하려면 먼저 대시보드에서 OpenAI API 키를 등록해주세요." : "AI가 주제에 꼭 맞는 역할을 자동으로 만들어줍니다."}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100 flex items-center gap-1.5 whitespace-nowrap transition-all"
              >
                ✨ AI 역할 & 질문 생성
              </button>
              <button
                type="button"
                onClick={addRole}
                className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 whitespace-nowrap transition-colors"
              >
                + 역할 추가
              </button>
            </div>
          </div>

          {!hasApiKey && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span>💡</span>
                <p>
                  <strong>OpenAI API 키 등록 안내</strong>: AI로 역할과 질문을 자동 완성하는 스마트 비서 기능을 사용해 보세요! 대시보드에서 API 키를 등록하시면 활성화됩니다.
                </p>
              </div>
              <Link href="/dashboard" className="shrink-0 font-bold hover:underline whitespace-nowrap text-amber-800">
                등록하러 가기 →
              </Link>
            </div>
          )}

          {cardSettingsError && (
            <p className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{cardSettingsError}</p>
          )}

          {cardSettingsLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-gray-400">
              질문 카드 역할을 불러오고 있어요...
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role, roleIndex) => {
                const roleCardSets = cardSets.filter((cardSet) => cardSet.roleId === role.id);
                return (
                  <div key={role.id} className="rounded-3xl border border-indigo-100 bg-indigo-50/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleRoleExpand(role.id)}
                      className="w-full px-5 py-4 text-left hover:bg-indigo-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          <span className="text-2xl">{role.icon || "🃏"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-800 truncate">{role.label || "(이름 없음)"}</p>
                              {role.subtitle && (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                                  {role.subtitle}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">{role.description || "설명 없음"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs bg-white border border-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-semibold">
                            카드 {roleCardSets.length}개
                          </span>
                          <span className={`text-gray-400 transition-transform ${role.expanded ? "rotate-180" : ""}`}>▾</span>
                        </div>
                      </div>
                    </button>

                    {role.expanded && (
                      <div className="border-t border-indigo-100 bg-white px-5 py-5 space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">역할 이름</label>
                            <input
                              value={role.label}
                              onChange={(event) => updateRole(role.id, { label: event.target.value })}
                              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="예) 탐정 모드"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
                            <input
                              value={role.icon}
                              onChange={(event) => updateRole(role.id, { icon: event.target.value })}
                              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="예) 🕵️"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">짧은 성격 설명</label>
                            <input
                              value={role.subtitle}
                              onChange={(event) => updateRole(role.id, { subtitle: event.target.value })}
                              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="예) 사실/추론"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">역할 설명</label>
                            <input
                              value={role.description}
                              onChange={(event) => updateRole(role.id, { description: event.target.value })}
                              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="학생에게 보여줄 역할 설명"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveRole(role, roleIndex)}
                            disabled={savingRoleId === role.id}
                            className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                          >
                            {savingRoleId === role.id ? "저장 중..." : "역할 저장"}
                          </button>
                          <button
                            type="button"
                            onClick={() => addCardSet(role.id)}
                            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
                          >
                            + 카드 추가
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(role)}
                            disabled={deletingRoleId === role.id}
                            className="rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingRoleId === role.id ? "삭제 중..." : "역할 삭제"}
                          </button>
                        </div>

                        {roleCardSets.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
                            아직 이 역할 아래 카드가 없어요. 위 버튼으로 첫 카드를 추가해보세요.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {roleCardSets.map((cardSet, cardIndex) => {
                              const promptCount = cardSet.promptsText.split("\n").map((prompt) => prompt.trim()).filter(Boolean).length;
                              return (
                                <div key={cardSet.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => updateCardSet(cardSet.id, { expanded: !cardSet.expanded })}
                                    className="w-full px-5 py-4 text-left hover:bg-gray-100/60 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{cardSet.label || "(이름 없음)"}</p>
                                        <p className="text-xs text-gray-400 mt-1 truncate">{cardSet.description || "설명 없음"}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs bg-white border border-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                                          질문 {promptCount}개
                                        </span>
                                        <span className={`text-gray-400 transition-transform ${cardSet.expanded ? "rotate-180" : ""}`}>▾</span>
                                      </div>
                                    </div>
                                  </button>

                                  {cardSet.expanded && (
                                    <div className="border-t border-gray-200 bg-white px-5 py-5 space-y-4">
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">카드 이름</label>
                                          <input
                                            value={cardSet.label}
                                            onChange={(event) => updateCardSet(cardSet.id, { label: event.target.value })}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                            placeholder="예) 상상 카드"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-2">소속 역할</label>
                                          <select
                                            value={cardSet.roleId ?? ""}
                                            onChange={(event) => updateCardSet(cardSet.id, { roleId: event.target.value || null })}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                          >
                                            <option value="">역할 없음</option>
                                            {roles.map((option) => (
                                              <option key={option.id} value={option.id}>{option.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                                        <input
                                          value={cardSet.description}
                                          onChange={(event) => updateCardSet(cardSet.id, { description: event.target.value })}
                                          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                          placeholder="예) 보이지 않는 이야기의 빈칸을 채워보는 질문 만들기"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">질문 카드</label>
                                        <textarea
                                          value={cardSet.promptsText}
                                          onChange={(event) => updateCardSet(cardSet.id, { promptsText: event.target.value })}
                                          rows={8}
                                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 leading-6 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
                                          placeholder={"질문을 한 줄에 하나씩 적어주세요.\n예)\n이 일이 끝난 뒤에 주인공은 어디로 갔을까?"}
                                        />
                                        <p className="text-xs text-gray-400 mt-2">한 줄에 하나씩 저장됩니다.</p>
                                      </div>

                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCardSet(cardSet, cardIndex)}
                                          disabled={savingCardId === cardSet.id}
                                          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                                        >
                                          {savingCardId === cardSet.id ? "저장 중..." : "카드 저장"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteCardSet(cardSet)}
                                          disabled={deletingCardId === cardSet.id}
                                          className="rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          {deletingCardId === cardSet.id ? "삭제 중..." : "카드 삭제"}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
      <AiGenerationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSuccess={refreshSettings}
      />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" | "amber" | "indigo" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];
  const valueClass = {
    emerald: "text-emerald-900",
    sky: "text-sky-900",
    amber: "text-amber-900",
    indigo: "text-indigo-900",
  }[tone];

  return (
    <div className={`rounded-2xl ${toneClass} px-4 py-4`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}

function toEditableRole(role: QuestionCardRole): EditableQuestionCardRole {
  return {
    id: role.id,
    label: role.label,
    subtitle: role.subtitle,
    description: role.description,
    icon: role.icon,
    cardSetIds: role.cardSetIds,
    expanded: false,
  };
}

function toEditableCardSet(cardSet: QuestionCardSet): EditableQuestionCardSet {
  return {
    id: cardSet.id,
    label: cardSet.label,
    description: cardSet.description,
    promptsText: cardSet.prompts.join("\n"),
    roleId: cardSet.roleId ?? null,
    expanded: false,
  };
}
