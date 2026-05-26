"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getQuestionCardSettings,
  getTeacherQuestionSet,
  saveQuestionSet,
} from "@/app/actions/settings-actions";
import type { QuestionCardSet, QuestionSetItem } from "@/features/activities/types";

type BuilderMode = "bundle" | "edit";

export default function QuestionSetEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;
  const isNew = id === "new";
  const requestedMode = searchParams.get("mode");
  const initialMode: BuilderMode = requestedMode === "edit" ? "edit" : "bundle";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuestionSetItem[]>([]);
  const [builderMode, setBuilderMode] = useState<BuilderMode>(initialMode);

  const [bundles, setBundles] = useState<QuestionCardSet[]>([]);
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);
  const [bundleDrafts, setBundleDrafts] = useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");

  // Load bundles + (if editing) existing set
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const bundlesResult = await getQuestionCardSettings();
      if (!active) return;
      let loadedBundles: QuestionCardSet[] = [];
      if (bundlesResult.error) {
        setError(bundlesResult.error);
      } else {
        loadedBundles = bundlesResult.cardSets;
        setBundles(loadedBundles);
        setBundleDrafts(
          Object.fromEntries(
            loadedBundles.map((bundle) => [bundle.id, [...bundle.prompts]])
          )
        );
        if (loadedBundles.length > 0) {
          setActiveBundleId((prev) => prev ?? loadedBundles[0].id);
        }
      }

      let loadedItems: QuestionSetItem[] = [];
      if (!isNew) {
        const setResult = await getTeacherQuestionSet(id);
        if (!active) return;
        if (setResult.error) {
          setError(setResult.error);
        } else if (setResult.set) {
          setName(setResult.set.name);
          setDescription(setResult.set.description);
          setItems(setResult.set.items);
          loadedItems = setResult.set.items;
        }
      }

      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, isNew]);

  function handleSelectBundle(bundleId: string) {
    setActiveBundleId(bundleId);
  }

  const itemTextSet = useMemo(() => new Set(items.map((i) => i.text)), [items]);

  const activeBundle = useMemo(
    () => bundles.find((b) => b.id === activeBundleId) ?? bundles[0] ?? null,
    [bundles, activeBundleId]
  );

  useEffect(() => {
    setBuilderMode(initialMode);
  }, [initialMode]);

  function toggleAllInActiveBundle() {
    if (!activeBundle) return;
    const bundlePrompts = activeBundle.prompts;
    const allSelected = bundlePrompts.every((p) => itemTextSet.has(p));
    if (allSelected) {
      // 현재 묶음의 모든 질문을 세트에서 제거
      const removeSet = new Set(bundlePrompts);
      setItems((prev) => prev.filter((i) => !removeSet.has(i.text)));
    } else {
      // 현재 묶음에서 누락된 질문을 모두 추가 (순서 유지)
      const label = activeBundle.label;
      setItems((prev) => {
        const existingTexts = new Set(prev.map((i) => i.text));
        const additions = bundlePrompts
          .filter((p) => !existingTexts.has(p))
          .map((text) => ({ text, source_label: label }));
        return [...prev, ...additions];
      });
    }
  }

  function toggleBundle(bundle: QuestionCardSet) {
    const allSelected = bundle.prompts.length > 0 && bundle.prompts.every((prompt) => itemTextSet.has(prompt));
    if (allSelected) {
      const removeSet = new Set(bundle.prompts);
      setItems((prev) => prev.filter((item) => !removeSet.has(item.text)));
      return;
    }

    setItems((prev) => {
      const existingTexts = new Set(prev.map((item) => item.text));
      const additions = bundle.prompts
        .filter((prompt) => !existingTexts.has(prompt))
        .map((text) => ({ text, source_label: bundle.label }));
      return [...prev, ...additions];
    });
  }

  function updateBundleDraft(bundleId: string, promptIndex: number, value: string) {
    setBundleDrafts((prev) => {
      const next = { ...prev };
      const current = next[bundleId] ? [...next[bundleId]] : [];
      current[promptIndex] = value;
      next[bundleId] = current;
      return next;
    });
  }

  function addEditedPrompt(bundle: QuestionCardSet, promptIndex: number) {
    const text = (bundleDrafts[bundle.id]?.[promptIndex] ?? bundle.prompts[promptIndex] ?? "").trim();
    if (!text) {
      setError("빈 질문은 담을 수 없어요.");
      return;
    }
    if (itemTextSet.has(text)) {
      setError("이미 담긴 질문입니다.");
      return;
    }
    setItems((prev) => [...prev, { text, source_label: bundle.label }]);
    setError(null);
  }

  function resetBundleDraft(bundleId: string, promptIndex: number) {
    const original = bundles.find((bundle) => bundle.id === bundleId)?.prompts[promptIndex] ?? "";
    updateBundleDraft(bundleId, promptIndex, original);
  }

  function removeAt(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }
  function moveDown(idx: number) {
    setItems((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  }

  function addCustom() {
    const text = customDraft.trim();
    if (!text) return;
    if (itemTextSet.has(text)) {
      setError("이미 추가된 질문입니다.");
      return;
    }
    setItems((prev) => [...prev, { text }]);
    setCustomDraft("");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("세트 이름을 입력해주세요."); return; }
    if (items.length === 0) { setError("질문을 1개 이상 골라주세요."); return; }

    setSaving(true);
    const result = await saveQuestionSet({
      id: isNew ? undefined : id,
      name: name.trim(),
      description: description.trim(),
      items,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard/settings");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <p className="text-amber-700">세트 정보를 불러오고 있어요...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-6">
      <div className="max-w-6xl mx-auto pt-6 pb-16 space-y-5">
        <Link href="/dashboard/settings" className="text-amber-700 text-sm hover:underline">
          ← 설정으로
        </Link>

        {/* 헤더 */}
        <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-6 md:p-8 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">📚</span>
              <h1 className="text-xl font-bold text-gray-800">
                {isNew ? "새 질문 세트 만들기" : "질문 세트 편집"}
              </h1>
            </div>
            <p className="text-sm text-gray-500">
              여러 카드 묶음에서 질문을 골라 나만의 세트를 만드세요. 활동 만들 때 이 세트를 통째로 쓸 수 있어요.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-3">세트를 만드는 방법</p>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setBuilderMode("bundle")}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  builderMode === "bundle"
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-amber-200 bg-white hover:border-amber-300"
                }`}
              >
                <p className="text-sm font-bold text-gray-800">1. 내 질문 세트 만들기</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  어울리는 카드 묶음만 골라 한 번에 담고, 묶음을 조합해서 세트를 만듭니다.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setBuilderMode("edit")}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  builderMode === "edit"
                    ? "border-sky-400 bg-sky-50"
                    : "border-amber-200 bg-white hover:border-amber-300"
                }`}
              >
                <p className="text-sm font-bold text-gray-800">2. 질문을 수정해서 세트 만들기</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  묶음 속 질문을 다듬어 담고, 필요한 묶음을 더해 맞춤형 세트를 만듭니다.
                </p>
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="세트 이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예) 우리 반 글쓰기 주간 세트"
                className={inputClass}
              />
            </Field>
            <Field label="설명" optional>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예) 이번 주 주제에 맞는 질문 모음"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {/* 빌더 본문 */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 좌측: 묶음 선택 / 질문 수정 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-700">
                {builderMode === "bundle" ? "🎴 묶음 골라 담기" : "✍️ 질문 수정해서 담기"}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {builderMode === "bundle"
                  ? "어울리는 묶음만 선택해서 세트에 바로 담아 보세요."
                  : "묶음 속 질문을 다듬은 뒤 원하는 질문만 세트에 담아 보세요."}
              </p>
            </div>

            {builderMode === "bundle" ? (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-400">
                  💡 묶음을 통째로 담고, 필요 없는 묶음은 다시 눌러 한 번에 뺄 수 있어요.
                </p>
                <div className="space-y-3">
                  {bundles.map((bundle) => {
                    const selectedCount = bundle.prompts.filter((prompt) => itemTextSet.has(prompt)).length;
                    const allSelected = bundle.prompts.length > 0 && selectedCount === bundle.prompts.length;
                    return (
                      <button
                        type="button"
                        key={bundle.id}
                        onClick={() => toggleBundle(bundle)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          allSelected
                            ? "border-emerald-300 bg-emerald-50"
                            : selectedCount > 0
                              ? "border-amber-200 bg-amber-50/60"
                              : "border-gray-200 bg-white hover:border-amber-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-gray-800">{bundle.label}</p>
                            {bundle.description && (
                              <p className="mt-1 text-xs leading-relaxed text-gray-500">{bundle.description}</p>
                            )}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            allSelected
                              ? "bg-emerald-500 text-white"
                              : selectedCount > 0
                                ? "bg-amber-200 text-amber-800"
                                : "bg-gray-100 text-gray-500"
                          }`}>
                            {selectedCount}/{bundle.prompts.length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {bundles.map((b) => {
                    const usedCount = b.prompts.filter((p) => itemTextSet.has(p)).length;
                    const isActive = activeBundle?.id === b.id;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => handleSelectBundle(b.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isActive
                            ? "bg-sky-500 text-white border-sky-500"
                            : usedCount > 0
                              ? "bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-300"
                              : "bg-white text-gray-600 border-gray-200 hover:border-sky-300"
                        }`}
                      >
                        {b.label}
                        <span className={`ml-1.5 text-[10px] ${isActive ? "text-sky-100" : "text-gray-400"}`}>
                          {usedCount}/{b.prompts.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeBundle && (() => {
                  const selectedCount = activeBundle.prompts.filter((p) => itemTextSet.has(p)).length;
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-xs text-gray-500">
                          이 묶음에서 <strong className="text-sky-700">{selectedCount}</strong> / {activeBundle.prompts.length}개 담음
                        </p>
                        <button
                          type="button"
                          onClick={toggleAllInActiveBundle}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors"
                        >
                          묶음 원문 모두 담기
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {activeBundle.prompts.map((prompt, i) => {
                          const draftText = bundleDrafts[activeBundle.id]?.[i] ?? prompt;
                          const selected = itemTextSet.has(draftText);
                          const changed = draftText.trim() !== prompt.trim();
                          return (
                            <div
                              key={i}
                              className={`rounded-2xl border p-3 ${
                                selected
                                  ? "border-sky-300 bg-sky-50"
                                  : "border-gray-200 bg-white"
                              }`}
                            >
                              <p className="text-[11px] font-semibold text-gray-400 mb-2">원문</p>
                              <p className="text-sm leading-relaxed text-gray-600">{prompt}</p>
                              <textarea
                                value={draftText}
                                onChange={(e) => updateBundleDraft(activeBundle.id, i, e.target.value)}
                                className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                              />
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-gray-400">
                                  {changed ? "질문을 다듬은 뒤 세트에 담을 수 있어요." : "원문 그대로 담거나 수정해서 담을 수 있어요."}
                                </div>
                                <div className="flex gap-2">
                                  {changed && (
                                    <button
                                      type="button"
                                      onClick={() => resetBundleDraft(activeBundle.id, i)}
                                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                    >
                                      원문으로
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => addEditedPrompt(activeBundle, i)}
                                    disabled={selected}
                                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {selected ? "이미 담김" : "세트에 담기"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>

          {/* 우측: 선택된 항목 + 직접 추가 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-700">📝 내 세트에 담긴 질문 ({items.length})</h2>
              <p className="text-xs text-gray-400 mt-1">위/아래 화살표로 순서 변경, ✕로 제거</p>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-8 text-center text-sm text-amber-700">
                아직 담긴 질문이 없어요. 왼쪽에서 골라 담아 보세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="text-amber-600 hover:text-amber-800 disabled:opacity-30 leading-none">▲</button>
                      <button type="button" onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                        className="text-amber-600 hover:text-amber-800 disabled:opacity-30 leading-none">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-relaxed">{item.text}</p>
                      {item.source_label && (
                        <p className="text-[10px] text-amber-600 mt-1">출처: {item.source_label}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => removeAt(idx)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* 직접 추가 */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500">✍️ 직접 질문 추가</p>
              <div className="flex gap-2">
                <input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="새 질문을 적고 Enter 또는 추가 버튼"
                  className={inputClass}
                />
                <button type="button" onClick={addCustom}
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold whitespace-nowrap">
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 하단: 저장 / 취소 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}
        <div className="flex gap-3">
          <Link
            href="/dashboard/settings"
            className="flex-1 py-4 border-2 border-gray-200 bg-white text-gray-600 rounded-2xl font-medium text-center hover:border-gray-300"
          >
            취소
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-lg"
          >
            {saving ? "저장 중..." : isNew ? "세트 만들기" : "변경 사항 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white";

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-600">
        {label}{optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      {children}
    </div>
  );
}
