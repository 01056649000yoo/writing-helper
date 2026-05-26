"use client";

import { useState, useEffect } from "react";
import { generateAiRolesAndCardsAction, saveBulkQuestionRolesAndCards } from "@/app/actions/settings-actions";
import type { GeneratedRoleData } from "@/lib/gpt";

interface AiGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LOADING_STEPS = [
  "💡 주제에 어울리는 새로운 연구원 정체성을 고민하고 있어요...",
  "🃏 질문 카드에 들어갈 매력적인 힌트를 구상하는 중이에요...",
  "🎨 학생들이 재미있게 질문을 완성할 수 있도록 쉬운 단어로 조율하고 있어요...",
  "✨ 마지막으로 이모지와 힌트 문장들을 정교하게 가다듬고 있어요...",
];

export default function AiGenerationModal({ isOpen, onClose, onSuccess }: AiGenerationModalProps) {
  const [step, setStep] = useState<"input" | "generating" | "preview" | "saving">("input");
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState<"저학년" | "중학년" | "고학년">("중학년");
  const [roleCount, setRoleCount] = useState<number>(3);
  
  const [error, setError] = useState("");
  const [generatedRoles, setGeneratedRoles] = useState<GeneratedRoleData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});
  
  // Loading step message rotator
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (step !== "generating") return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) {
      setError("글쓰기 수업 주제를 입력해주세요.");
      return;
    }
    setError("");
    setStep("generating");
    setLoadingMsgIdx(0);

    const result = await generateAiRolesAndCardsAction(topic, gradeLevel, roleCount);
    if (result.error || !result.roles) {
      setError(result.error ?? "AI 생성 중 오류가 발생했습니다. OpenAI API 키를 확인해주세요.");
      setStep("input");
      return;
    }

    setGeneratedRoles(result.roles);
    // Select all generated roles by default
    const initialSelection: Record<number, boolean> = {};
    result.roles.forEach((_, idx) => {
      initialSelection[idx] = true;
    });
    setSelectedIndices(initialSelection);
    setStep("preview");
  }

  // Edit Handlers for Preview Board
  function handleUpdateRoleField(roleIdx: number, field: keyof GeneratedRoleData, value: string) {
    setGeneratedRoles((prev) => {
      const next = [...prev];
      next[roleIdx] = { ...next[roleIdx], [field]: value };
      return next;
    });
  }

  function handleUpdateCardSetField(roleIdx: number, cardIdx: number, field: "label" | "description", value: string) {
    setGeneratedRoles((prev) => {
      const next = [...prev];
      const cardSets = [...next[roleIdx].cardSets];
      cardSets[cardIdx] = { ...cardSets[cardIdx], [field]: value };
      next[roleIdx] = { ...next[roleIdx], cardSets };
      return next;
    });
  }

  function handleUpdatePrompts(roleIdx: number, cardIdx: number, promptsText: string) {
    setGeneratedRoles((prev) => {
      const next = [...prev];
      const cardSets = [...next[roleIdx].cardSets];
      cardSets[cardIdx] = {
        ...cardSets[cardIdx],
        prompts: promptsText.split("\n"),
      };
      next[roleIdx] = { ...next[roleIdx], cardSets };
      return next;
    });
  }

  async function handleSave() {
    const approvedRoles = generatedRoles.filter((_, idx) => selectedIndices[idx]);
    if (approvedRoles.length === 0) {
      setError("저장할 역할을 최소 1개 이상 선택해 주세요.");
      return;
    }

    setError("");
    setStep("saving");

    const result = await saveBulkQuestionRolesAndCards(approvedRoles);
    if (result.error) {
      setError(result.error);
      setStep("preview");
      return;
    }

    onSuccess();
    onClose();
    // Reset state
    setStep("input");
    setTopic("");
    setGeneratedRoles([]);
  }

  const toggleSelectRole = (idx: number) => {
    setSelectedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={step !== "generating" && step !== "saving" ? onClose : undefined} 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-indigo-50/50 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/30">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
              <span>✨</span> AI 연구원 역할 & 질문 생성기
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">교과 수업 주제에 딱 맞는 맞춤형 질문 카드를 빠르게 구성합니다.</p>
          </div>
          {step !== "generating" && step !== "saving" && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors text-xl font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Content Box (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100">
              ⚠️ {error}
            </div>
          )}

          {/* ────── STEP 1: INPUT FORM ────── */}
          {step === "input" && (
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">
                  1. 오늘 진행할 글쓰기 수업 주제를 적어주세요
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed transition-all"
                  placeholder="예) 지난주에 다녀온 가을 소풍을 주제로 추억이 담긴 글쓰기를 합니다. 혹은 환경 보호와 재활용을 실천한 경험 쓰기."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Grade Level Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    2. 대상 학생 학년
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["저학년", "중학년", "고학년"] as const).map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setGradeLevel(grade)}
                        className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                          gradeLevel === grade
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Count Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    3. 추천 역할 개수
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([2, 3, 4] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setRoleCount(count)}
                        className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                          roleCount === count
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                        }`}
                      >
                        {count}개
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-indigo-600 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  ✨ AI 질문 생성 시작
                </button>
              </div>
            </form>
          )}

          {/* ────── STEP 2: GENERATING STATUS ────── */}
          {step === "generating" && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                {/* Premium Spinning Ring */}
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">✨</span>
              </div>
              <div className="text-center space-y-2 max-w-md">
                <h3 className="text-base font-bold text-gray-800">질문을 생성하는 중입니다</h3>
                <p className="text-sm text-indigo-600 font-medium animate-pulse transition-all duration-500 min-h-[40px] leading-relaxed">
                  {LOADING_STEPS[loadingMsgIdx]}
                </p>
              </div>
            </div>
          )}

          {/* ────── STEP 3: PREVIEW BOARD ────── */}
          {step === "preview" && (
            <div className="space-y-6">
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/60">
                <p className="text-xs text-indigo-700 font-bold leading-relaxed">
                  💡 <strong>작성 꿀팁</strong>: AI가 추천한 역할과 질문들을 확인해 보세요. 
                  이모지와 텍스트를 마우스로 클릭하면 즉시 수정할 수 있습니다. 
                  수정이 완료된 역할 중 등록할 카드만 왼쪽 체크박스를 켜고 하단 '일괄 등록'을 누르세요.
                </p>
              </div>

              <div className="space-y-6">
                {generatedRoles.map((role, roleIdx) => {
                  const isSelected = !!selectedIndices[roleIdx];
                  return (
                    <div 
                      key={roleIdx}
                      className={`rounded-2xl border transition-all ${
                        isSelected 
                          ? "border-indigo-200 bg-indigo-50/20" 
                          : "border-gray-200 bg-gray-50/40 opacity-70"
                      }`}
                    >
                      {/* Card Header (Role details editable) */}
                      <div className="p-5 flex items-start gap-4 border-b border-gray-100 bg-white/70 rounded-t-2xl">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRole(roleIdx)}
                          className="mt-2 h-5 w-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />

                        {/* Icon & Label inputs */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={role.icon}
                              onChange={(e) => handleUpdateRoleField(roleIdx, "icon", e.target.value)}
                              className="w-12 text-center rounded-lg border border-gray-200 py-1.5 text-base focus:ring-1 focus:ring-indigo-500"
                              placeholder="🕵️"
                            />
                            <input
                              type="text"
                              value={role.label}
                              onChange={(e) => handleUpdateRoleField(roleIdx, "label", e.target.value)}
                              className="flex-1 font-bold text-gray-800 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500"
                              placeholder="역할 이름"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={role.subtitle}
                              onChange={(e) => handleUpdateRoleField(roleIdx, "subtitle", e.target.value)}
                              className="w-full text-indigo-600 bg-indigo-50/50 rounded-lg border border-indigo-100 px-2 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
                              placeholder="짧은 성격 설명"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <input
                              type="text"
                              value={role.description}
                              onChange={(e) => handleUpdateRoleField(roleIdx, "description", e.target.value)}
                              className="w-full text-gray-500 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                              placeholder="학생용 역할 설명"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Sets inside role */}
                      {isSelected && (
                        <div className="p-5 space-y-4">
                          {role.cardSets.map((cardSet, cardIdx) => (
                            <div key={cardIdx} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 shadow-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">카드 묶음 이름</label>
                                  <input
                                    type="text"
                                    value={cardSet.label}
                                    onChange={(e) => handleUpdateCardSetField(roleIdx, cardIdx, "label", e.target.value)}
                                    className="w-full text-xs font-bold text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">카드 설명</label>
                                  <input
                                    type="text"
                                    value={cardSet.description}
                                    onChange={(e) => handleUpdateCardSetField(roleIdx, cardIdx, "description", e.target.value)}
                                    className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                                  질문 카드 리스트 (한 줄에 하나씩)
                                </label>
                                <textarea
                                  value={cardSet.prompts.join("\n")}
                                  onChange={(e) => handleUpdatePrompts(roleIdx, cardIdx, e.target.value)}
                                  rows={Math.max(3, cardSet.prompts.length)}
                                  className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500 resize-y"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  ← 재설정하기
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-indigo-600 shadow-lg shadow-indigo-100 transition-all"
                >
                  🚀 선택한 역할 일괄 등록하기
                </button>
              </div>
            </div>
          )}

          {/* ────── STEP 4: BULK SAVING STATUS ────── */}
          {step === "saving" && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-xl">💾</span>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-gray-800">데이터베이스에 일괄 저장 중입니다</h3>
                <p className="text-sm text-gray-400">연구원 정보와 질문 카드를 서버에 올바르게 기록하고 있어요...</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
