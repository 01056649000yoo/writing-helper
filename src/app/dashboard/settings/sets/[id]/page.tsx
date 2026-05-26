"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getQuestionCardSettings,
  getTeacherQuestionSet,
  saveQuestionSet,
} from "@/app/actions/settings-actions";
import type { QuestionCardSet, QuestionSetItem } from "@/features/activities/types";

export default function QuestionSetEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuestionSetItem[]>([]);

  const [bundles, setBundles] = useState<QuestionCardSet[]>([]);
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);

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
      if (bundlesResult.error) {
        setError(bundlesResult.error);
      } else {
        setBundles(bundlesResult.cardSets);
        if (bundlesResult.cardSets.length > 0) {
          setActiveBundleId((prev) => prev ?? bundlesResult.cardSets[0].id);
        }
      }

      if (!isNew) {
        const setResult = await getTeacherQuestionSet(id);
        if (!active) return;
        if (setResult.error) {
          setError(setResult.error);
        } else if (setResult.set) {
          setName(setResult.set.name);
          setDescription(setResult.set.description);
          setItems(setResult.set.items);
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, isNew]);

  const itemTextSet = useMemo(() => new Set(items.map((i) => i.text)), [items]);

  const activeBundle = useMemo(
    () => bundles.find((b) => b.id === activeBundleId) ?? bundles[0] ?? null,
    [bundles, activeBundleId]
  );

  function togglePrompt(text: string, source_label?: string) {
    if (itemTextSet.has(text)) {
      setItems((prev) => prev.filter((i) => i.text !== text));
    } else {
      setItems((prev) => [...prev, source_label ? { text, source_label } : { text }]);
    }
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
          {/* 좌측: 묶음 → 질문 선택 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-700">🎴 묶음에서 골라 담기</h2>
              <p className="text-xs text-gray-400 mt-1">묶음을 골라 질문에 체크하면 우측에 담깁니다.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {bundles.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setActiveBundleId(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    activeBundle?.id === b.id
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
                  }`}
                >
                  {b.label}
                  <span className={`ml-1.5 text-[10px] ${activeBundle?.id === b.id ? "text-amber-100" : "text-gray-400"}`}>
                    {b.prompts.length}
                  </span>
                </button>
              ))}
            </div>

            {activeBundle && (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {activeBundle.prompts.map((prompt, i) => {
                  const selected = itemTextSet.has(prompt);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => togglePrompt(prompt, activeBundle.label)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left text-sm transition-colors ${
                        selected
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-white border-gray-200 text-gray-700 hover:border-amber-200"
                      }`}
                    >
                      <span className={`inline-flex w-5 h-5 shrink-0 rounded-md border-2 items-center justify-center text-xs font-bold ${
                        selected ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-300 text-transparent"
                      }`}>
                        ✓
                      </span>
                      <span className="leading-relaxed">{prompt}</span>
                    </button>
                  );
                })}
              </div>
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
