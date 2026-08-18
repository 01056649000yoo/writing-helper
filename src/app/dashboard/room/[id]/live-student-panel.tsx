"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { OneLineShareBoard, OneLineShareTopThree } from "@/components/one-line-share-board";
import {
  applyQuestionGeneratorSpellingCorrections,
  correctQuestionGeneratorSpelling,
  getHanjaWritingRoomResults,
  getOneLineShareRoomResults,
  getQuestionGeneratorRoomResults,
  getQuestionVotingRoomResults,
  getRoomSessions,
  updateQuestionGeneratorSelection,
  type SpellingCorrectionCandidate,
} from "@/app/actions/room-actions";
import type { ActivityType } from "@/features/activities/types";
import {
  QuestionVotingCompactList,
  QuestionVotingTopThree,
} from "@/components/question-voting-ranking-summary";

type Student = { id: string; student_number: number; student_name: string };
type Session = {
  id: string;
  agit_student_id?: string | null;
  student_number: number;
  student_name: string;
  level: string | null;
  status: string;
  answers?: unknown;
  submission?: unknown;
  result?: unknown;
};
type QuestionResult = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  selections: Array<{
    id: string;
    method: "direct" | "card_remix";
    cardSetLabel: string;
    originalPrompt: string | null;
    remixedQuestion: string;
    originalRemixedQuestion?: string;
  }>;
};
type QuestionVotingRanking = Array<{
  questionId: string;
  text: string;
  votes: number;
}>;
type OneLineShareResults = Array<{
  entryId: string;
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  likedByCurrentSession: boolean;
  isMine: boolean;
  containsKeywords: boolean;
  createdAt: string;
  updatedAt: string;
}>;
type HanjaWritingResults = Array<{
  entryId: string;
  sessionId: string;
  sentenceIndex: number;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  givenLikeCount: number;
  maxReactionsPerStudent: number;
  createdAt: string;
}>;
function levelLabel(level: string) {
  if (!level || level === "null") return "";
  return { low: "도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return {
    low: "bg-orange-100 text-orange-700",
    mid: "bg-blue-100 text-blue-700",
    high: "bg-green-100 text-green-700",
  }[level] ?? "";
}

function StudentQrModal({
  sessionId,
  studentName,
  studentNumber,
  onClose,
}: {
  sessionId: string;
  studentName: string;
  studentNumber: number;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/${sessionId}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#166534", light: "#ffffff" },
    }).then(setQrUrl);
  }, [shareUrl]);

  function copyUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.focus(); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-7 flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">개인 결과 QR</p>
          <h3 className="text-lg font-bold text-gray-800">
            {studentNumber}번 {studentName}
          </h3>
        </div>
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="QR" className="w-48 h-48 rounded-xl" />
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
        )}
        <p className="text-xs text-gray-400 text-center">
          이 QR을 스캔하면 개요를 바로 복사할 수 있어요
        </p>
        <button
          onClick={copyUrl}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          🔗 링크 복사
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function QuestionResultsModal({
  results,
  roomId,
  onResultsChange,
  onClose,
}: {
  results: QuestionResult[];
  roomId: string;
  onResultsChange: (next: QuestionResult[]) => void;
  onClose: () => void;
}) {
  const totalQuestions = results.reduce((sum, result) => sum + result.selections.length, 0);
  const [viewMode, setViewMode] = useState<"students" | "questions">("students");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [correctionMode, setCorrectionMode] = useState<"idle" | "loading" | "review">("idle");
  const [correctionCandidates, setCorrectionCandidates] = useState<SpellingCorrectionCandidate[]>([]);
  const [correctionSelected, setCorrectionSelected] = useState<Set<string>>(new Set());
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [applyingCorrections, setApplyingCorrections] = useState(false);

  const flattenedQuestions = results.flatMap((result) =>
    result.selections.map((selection, index) => ({
      sessionId: result.sessionId,
      studentNumber: result.studentNumber,
      studentName: result.studentName,
      order: index + 1,
      selection,
    }))
  );

  function buildKey(sessionId: string, selectionId: string) {
    return `${sessionId}::${selectionId}`;
  }

  function applyLocalUpdates(updates: Array<{ sessionId: string; selectionId: string; newText: string }>) {
    const bySession = new Map<string, Map<string, string>>();
    for (const update of updates) {
      if (!bySession.has(update.sessionId)) bySession.set(update.sessionId, new Map());
      bySession.get(update.sessionId)!.set(update.selectionId, update.newText);
    }
    onResultsChange(
      results.map((result) => {
        const sessionUpdates = bySession.get(result.sessionId);
        if (!sessionUpdates) return result;
        return {
          ...result,
          selections: result.selections.map((selection) => {
            const nextText = sessionUpdates.get(selection.id);
            if (!nextText || nextText === selection.remixedQuestion) return selection;
            return {
              ...selection,
              remixedQuestion: nextText,
              originalRemixedQuestion: selection.originalRemixedQuestion ?? selection.remixedQuestion,
            };
          }),
        };
      })
    );
  }

  function startEdit(sessionId: string, selectionId: string, currentText: string) {
    setEditingKey(buildKey(sessionId, selectionId));
    setEditingText(currentText);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditingText("");
    setEditError(null);
  }

  async function saveEdit(sessionId: string, selectionId: string) {
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditError("질문 내용을 비워둘 수 없습니다.");
      return;
    }
    const key = buildKey(sessionId, selectionId);
    setSavingKey(key);
    setEditError(null);
    const result = await updateQuestionGeneratorSelection(roomId, sessionId, selectionId, trimmed);
    setSavingKey(null);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    applyLocalUpdates([{ sessionId, selectionId, newText: trimmed }]);
    cancelEdit();
  }

  async function runCorrection() {
    if (!window.confirm("AI로 모든 질문의 맞춤법을 확인합니다. 진행할까요?")) return;
    setCorrectionMode("loading");
    setCorrectionError(null);
    const result = await correctQuestionGeneratorSpelling(roomId);
    if (result.error) {
      setCorrectionError(result.error);
      setCorrectionMode("idle");
      return;
    }
    const candidates = result.candidates ?? [];
    if (candidates.length === 0) {
      setCorrectionMode("idle");
      window.alert("교정할 항목이 없어요. 이미 맞춤법이 깨끗합니다!");
      return;
    }
    setCorrectionCandidates(candidates);
    setCorrectionSelected(new Set(candidates.map((c) => buildKey(c.sessionId, c.selectionId))));
    setCorrectionMode("review");
  }

  function toggleCorrection(key: string) {
    setCorrectionSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cancelCorrections() {
    setCorrectionMode("idle");
    setCorrectionCandidates([]);
    setCorrectionSelected(new Set());
    setCorrectionError(null);
  }

  async function applyCorrections() {
    const updates = correctionCandidates
      .filter((c) => correctionSelected.has(buildKey(c.sessionId, c.selectionId)))
      .map((c) => ({ sessionId: c.sessionId, selectionId: c.selectionId, newText: c.corrected }));
    if (updates.length === 0) {
      cancelCorrections();
      return;
    }
    setApplyingCorrections(true);
    setCorrectionError(null);
    const result = await applyQuestionGeneratorSpellingCorrections(roomId, updates);
    setApplyingCorrections(false);
    if (result.error) {
      setCorrectionError(result.error);
      return;
    }
    applyLocalUpdates(updates);
    cancelCorrections();
    window.alert(`${result.applied ?? updates.length}개 질문의 맞춤법을 교정했습니다.`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-500">질문 만들기 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">학생 질문 모아보기</h3>
            <p className="text-sm text-gray-500 mt-1">
              {results.length}명의 학생이 만든 질문 {totalQuestions}개를 한 번에 확인할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl bg-sky-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("students")}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                  viewMode === "students"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-sky-600 hover:text-sky-700"
                }`}
              >
                학생별 보기
              </button>
              <button
                type="button"
                onClick={() => setViewMode("questions")}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                  viewMode === "questions"
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-sky-600 hover:text-sky-700"
                }`}
              >
                질문만 모아보기
              </button>
            </div>
            {viewMode === "questions" && results.length > 0 && correctionMode === "idle" && (
              <button
                type="button"
                onClick={runCorrection}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-600"
              >
                ✨ 맞춤법 자동 교정
              </button>
            )}
            {viewMode === "questions" && correctionMode === "loading" && (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                AI가 맞춤법을 점검하고 있어요...
              </span>
            )}
          </div>

          {correctionError && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {correctionError}
            </div>
          )}

          {viewMode === "questions" && correctionMode === "review" && (
            <div className="mb-4 sticky top-0 z-10 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-violet-800">
                  교정안 {correctionCandidates.length}개 · 선택됨 {correctionSelected.size}개
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelCorrections}
                    disabled={applyingCorrections}
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={applyCorrections}
                    disabled={applyingCorrections || correctionSelected.size === 0}
                    className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {applyingCorrections ? "적용 중..." : `선택한 ${correctionSelected.size}개 적용`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/70 p-10 text-center">
              <p className="text-base font-semibold text-sky-800">아직 제출된 질문이 없어요.</p>
              <p className="mt-2 text-sm text-sky-600">학생이 질문 만들기를 완료하면 여기에 모아볼 수 있습니다.</p>
            </div>
          ) : viewMode === "questions" ? (
            <div className="grid gap-3">
              {flattenedQuestions.map(({ sessionId, studentNumber, studentName, order, selection }) => {
                const key = buildKey(sessionId, selection.id);
                const candidate = correctionMode === "review"
                  ? correctionCandidates.find((c) => buildKey(c.sessionId, c.selectionId) === key)
                  : null;
                const isSelected = candidate ? correctionSelected.has(key) : false;
                return (
                  <div key={key} className={`rounded-2xl border bg-white p-4 shadow-sm ${candidate ? "border-violet-200" : "border-sky-100"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sky-500">
                          {studentNumber}번 {studentName} · 질문 {order}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {selection.method === "direct" ? "직접 질문 만들기" : `${selection.cardSetLabel} 카드`}
                        </p>
                      </div>
                      {candidate && (
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCorrection(key)}
                            className="h-4 w-4 accent-violet-500"
                          />
                          <span className="text-xs font-semibold text-violet-700">교정 적용</span>
                        </label>
                      )}
                    </div>
                    {candidate ? (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl bg-gray-50 px-3 py-2">
                          <p className="text-xs font-semibold text-gray-400">교정 전</p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-500 line-through decoration-gray-300">
                            {candidate.original}
                          </p>
                        </div>
                        <div className="rounded-xl bg-violet-50 px-3 py-2">
                          <p className="text-xs font-semibold text-violet-700">교정 후 (적용 시 최종 질문)</p>
                          <p className="mt-1 text-base font-medium leading-relaxed text-violet-950">
                            {candidate.corrected}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion && (
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-xs font-semibold text-gray-400">학생이 적은 원본</p>
                            <p className="mt-1 text-sm leading-relaxed text-gray-500 line-through decoration-gray-300">
                              {selection.originalRemixedQuestion}
                            </p>
                          </div>
                        )}
                        <div className={`rounded-xl px-3 py-2 ${selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "bg-emerald-50" : ""}`}>
                          {selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion && (
                            <p className="text-xs font-semibold text-emerald-700">최종 질문 (교정 적용됨)</p>
                          )}
                          <p className={`text-base font-medium leading-relaxed ${selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "mt-1 text-emerald-950" : "text-sky-950"}`}>
                            {selection.remixedQuestion}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.sessionId} className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-sky-500">학생</p>
                      <h4 className="text-lg font-bold text-gray-800">
                        {result.studentNumber}번 {result.studentName}
                      </h4>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                      질문 {result.selections.length}개
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {result.selections.map((selection, index) => {
                      const key = buildKey(result.sessionId, selection.id);
                      const isEditing = editingKey === key;
                      const isSaving = savingKey === key;
                      return (
                        <div key={selection.id} className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-sky-500">
                                질문 {index + 1}
                              </p>
                              <p className="mt-1 text-sm text-gray-500">
                                {selection.method === "direct" ? "직접 질문 만들기" : `${selection.cardSetLabel} 카드`}
                              </p>
                            </div>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => startEdit(result.sessionId, selection.id, selection.remixedQuestion)}
                                className="rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                              >
                                ✏️ 수정
                              </button>
                            )}
                          </div>

                          {selection.originalPrompt && (
                            <div className="mt-3 rounded-2xl bg-gray-50 p-3">
                              <p className="text-xs font-semibold text-gray-500">고른 질문 카드</p>
                              <p className="mt-1 text-sm leading-relaxed text-gray-700">{selection.originalPrompt}</p>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="mt-3 rounded-2xl bg-sky-50 p-3">
                              <p className="text-xs font-semibold text-sky-700">학생이 만든 질문 수정</p>
                              <textarea
                                value={editingText}
                                onChange={(event) => setEditingText(event.target.value)}
                                rows={3}
                                className="mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm leading-relaxed text-sky-950 focus:outline-none focus:ring-2 focus:ring-sky-300 resize-y"
                              />
                              {editError && (
                                <p className="mt-2 text-xs font-semibold text-red-600">{editError}</p>
                              )}
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isSaving}
                                  className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(result.sessionId, selection.id)}
                                  disabled={isSaving}
                                  className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                                >
                                  {isSaving ? "저장 중..." : "저장"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion && (
                                <div className="rounded-2xl bg-gray-50 p-3">
                                  <p className="text-xs font-semibold text-gray-500">학생이 적은 원본</p>
                                  <p className="mt-1 text-sm leading-relaxed text-gray-500 line-through decoration-gray-300">
                                    {selection.originalRemixedQuestion}
                                  </p>
                                </div>
                              )}
                              <div className={`rounded-2xl p-3 ${selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "bg-emerald-50" : "bg-sky-50"}`}>
                                <p className={`text-xs font-semibold ${selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "text-emerald-700" : "text-sky-700"}`}>
                                  {selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "최종 질문 (수정/교정 적용됨)" : "학생이 만든 질문"}
                                </p>
                                <p className={`mt-1 text-base font-medium leading-relaxed ${selection.originalRemixedQuestion && selection.originalRemixedQuestion !== selection.remixedQuestion ? "text-emerald-950" : "text-sky-950"}`}>
                                  {selection.remixedQuestion}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionVotingResultsModal({
  ranking,
  onClose,
}: {
  ranking: QuestionVotingRanking;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-violet-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-500">좋은 질문 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">익명 질문 투표 결과</h3>
            <p className="text-sm text-gray-500 mt-1">
              학생들이 좋은 질문으로 고른 결과를 득표순으로 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          {ranking.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/70 p-10 text-center">
              <p className="text-base font-semibold text-violet-800">아직 제출된 평가가 없어요.</p>
              <p className="mt-2 text-sm text-violet-600">학생들이 좋은 질문을 고르면 여기에 득표 순서대로 모입니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <QuestionVotingTopThree ranking={ranking} />
              <QuestionVotingCompactList ranking={ranking} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function StudentSessionResultModal({
  session,
  activityType,
  questionResults,
  questionVotingResults,
  oneLineShareResults,
  onClose,
}: {
  session: Session;
  activityType: ActivityType;
  questionResults: QuestionResult[];
  questionVotingResults: QuestionVotingRanking;
  oneLineShareResults: OneLineShareResults;
  onClose: () => void;
}) {
  const currentQuestionResult = questionResults.find((r) => r.sessionId === session.id);
  const currentOneLine = oneLineShareResults.find((e) => e.sessionId === session.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-5 shrink-0 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-sm font-bold text-green-700">
              {session.student_number}
            </span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {session.student_name} 학생의 완성 결과
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {activityType === "question_generator"
                  ? "질문 만들기"
                  : activityType === "question_voting"
                    ? "좋은 질문 고르기"
                    : activityType === "one_line_share"
                      ? "한줄모아"
                      : activityType === "hanja_writing"
                        ? "한자 활용 문장"
                        : "글 개요짜기"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 개요 짜기 */}
          {activityType === "outline_builder" && (
            <OutlineAnswersView answers={session.answers} />
          )}

          {/* 질문 만들기 */}
          {activityType === "question_generator" && (
            <div className="space-y-3">
              {currentQuestionResult && currentQuestionResult.selections.length > 0 ? (
                currentQuestionResult.selections.map((selection, idx) => (
                  <div key={selection.id || idx} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-sky-600">질문 {idx + 1}</span>
                      <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-sky-100">
                        {selection.method === "direct" ? "직접 작성" : selection.cardSetLabel}
                      </span>
                    </div>
                    {selection.originalPrompt && (
                      <p className="text-xs text-gray-500 mb-1.5 bg-white/70 p-2 rounded-lg">
                        💡 {selection.originalPrompt}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-sky-950 whitespace-pre-line">
                      {selection.remixedQuestion}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">제출된 질문이 없습니다.</p>
              )}
            </div>
          )}

          {/* 좋은 질문 고르기 */}
          {activityType === "question_voting" && (
            <div className="space-y-3">
              {(() => {
                const sub = typeof session.submission === "object" && session.submission !== null ? session.submission as Record<string, unknown> : {};
                const selectedIds = Array.isArray(sub.selectedQuestionIds) ? sub.selectedQuestionIds : [];
                if (selectedIds.length === 0) {
                  return <p className="text-sm text-gray-500 text-center py-6">선택한 질문이 없습니다.</p>;
                }
                return selectedIds.map((qId, idx) => {
                  const match = questionVotingResults.find((r) => r.questionId === qId);
                  return (
                    <div key={String(qId)} className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-800">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-violet-950">
                          {match ? match.text : String(qId)}
                        </p>
                        {match && (
                          <span className="inline-block mt-2 text-xs font-bold text-violet-700 bg-white px-2.5 py-0.5 rounded-full border border-violet-100">
                            🗳️ 학급 전체 {match.votes}표 득표
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* 한줄모아 */}
          {activityType === "one_line_share" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
                <p className="text-xs font-bold text-rose-500 mb-2">내가 작성한 한 줄</p>
                <p className="text-base font-semibold text-rose-950 leading-relaxed bg-white p-4 rounded-xl shadow-sm">
                  💬 &ldquo;{currentOneLine?.content || (typeof session.submission === "object" && session.submission !== null && "content" in session.submission ? String((session.submission as Record<string, unknown>).content) : "작성된 문장이 없습니다.")}&rdquo;
                </p>
                {currentOneLine && (
                  <div className="mt-3 flex items-center justify-between text-xs text-rose-700">
                    <span>❤️ 받은 좋아요: {currentOneLine.likeCount}개</span>
                    <span>{new Date(currentOneLine.createdAt).toLocaleTimeString("ko-KR")}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 한자 문장 */}
          {activityType === "hanja_writing" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
                <p className="text-xs font-bold text-amber-600 mb-2">작성한 문장</p>
                <p className="text-base font-semibold text-gray-900 leading-relaxed bg-white p-4 rounded-xl shadow-sm">
                  {typeof session.submission === "object" && session.submission !== null && "content" in session.submission
                    ? String((session.submission as Record<string, unknown>).content)
                    : "작성된 문장이 없습니다."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-900"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function OutlineAnswersView({ answers }: { answers: unknown }) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6">제출된 개요 내용이 없습니다.</p>;
  }

  const normalized = answers
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      section: (a.section === "처음" || a.section === "가운데" || a.section === "끝") ? a.section : null,
      label: typeof a.label === "string" ? a.label : (typeof a.question === "string" ? a.question : ""),
      answer: typeof a.answer === "string" ? a.answer : "",
    }))
    .filter((a) => a.label || a.answer);

  const sectionOrder = ["처음", "가운데", "끝"];
  const grouped = sectionOrder
    .map((section) => ({
      section,
      items: normalized.filter((a) => a.section === section),
    }))
    .filter((group) => group.items.length > 0);
  const ungrouped = normalized.filter((a) => a.section === null);

  return (
    <div className="space-y-4">
      {grouped.map(({ section, items }) => (
        <div key={section} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-bold text-indigo-600 mb-2.5">{section}</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500 mb-1 font-medium">{item.label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-line font-medium leading-relaxed">
                  {item.answer || "(비어 있음)"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-bold text-gray-500 mb-2.5">기타</p>
          <div className="space-y-2">
            {ungrouped.map((item, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500 mb-1 font-medium">{item.label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-line font-medium leading-relaxed">
                  {item.answer || "(비어 있음)"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OneLineShareResultsModal({
  entries,
  onClose,
}: {
  entries: OneLineShareResults;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-rose-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">한줄모아 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">학생 한 줄 모아보기</h3>
            <p className="text-sm text-gray-500 mt-1">
              좋아요를 많이 받은 문장부터 학생 이름과 함께 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <OneLineShareTopThree entries={entries} showStudentName />
            <OneLineShareBoard entries={entries} showStudentName />
          </div>
        </div>
      </div>
    </div>
  );
}

function HanjaWritingResultsModal({
  entries,
  onClose,
}: {
  entries: HanjaWritingResults;
  onClose: () => void;
}) {
  const topEntries = entries.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-amber-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">한자 문장 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">학급 전체 문장 모아보기</h3>
            <p className="text-sm text-gray-500 mt-1">
              학생들이 만든 문장과 반응 수를 번호, 이름과 함께 한 번에 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          {entries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 p-10 text-center">
              <p className="text-base font-semibold text-amber-800">아직 제출된 문장이 없어요.</p>
              <p className="mt-2 text-sm text-amber-700">학생들이 문장을 제출하면 여기에 모입니다.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Best 5</p>
                    <h4 className="mt-1 text-xl font-bold text-gray-800">좋아요 상위 문장 먼저 보기</h4>
                    <p className="mt-1 text-sm text-gray-500">가장 많은 공감을 받은 학생 문장을 위에서 바로 확인할 수 있어요.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                    상위 {topEntries.length}문장
                  </span>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {topEntries.map((entry, index) => (
                    <div key={`top-${entry.entryId}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-700">#{index + 1} · {entry.studentNumber}번 {entry.studentName}</p>
                          <p className="mt-1 text-[11px] font-medium text-gray-400">문장 {entry.sentenceIndex + 1}</p>
                          <p className="mt-2 text-sm leading-relaxed text-gray-800">{entry.content}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          ❤️ {entry.likeCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">전체 문장 목록</h4>
                    <p className="mt-1 text-sm text-gray-500">좋아요 순으로 정렬된 학급 전체 결과입니다.</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    전체 {entries.length}명
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <div key={entry.entryId} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-amber-700">{entry.studentNumber}번 {entry.studentName}</p>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700">
                            받은 ❤️ {entry.likeCount}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-600">
                            누른 ❤️ {entry.givenLikeCount}/{entry.maxReactionsPerStudent}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-gray-400">문장 {entry.sentenceIndex + 1}</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-800">{entry.content}</p>
                      <p className="mt-3 text-[11px] text-gray-400">
                        {new Date(entry.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveStudentPanel({
  roomId,
  students,
  isActive,
  activityType,
  questionResults: initialQuestionResults,
  questionVotingResults: initialQuestionVotingResults,
  oneLineShareResults: initialOneLineShareResults,
  hanjaWritingResults: initialHanjaWritingResults,
  showResultQr,
}: {
  roomId: string;
  students: Student[];
  isActive: boolean;
  activityType: ActivityType;
  questionResults: QuestionResult[];
  questionVotingResults: QuestionVotingRanking;
  oneLineShareResults: OneLineShareResults;
  hanjaWritingResults: HanjaWritingResults;
  showResultQr: boolean;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [qrTarget, setQrTarget] = useState<Session | null>(null);
  const [activeSessionResult, setActiveSessionResult] = useState<Session | null>(null);
  const [isQuestionResultsOpen, setIsQuestionResultsOpen] = useState(false);
  const [isQuestionVotingResultsOpen, setIsQuestionVotingResultsOpen] = useState(false);
  const [isOneLineShareResultsOpen, setIsOneLineShareResultsOpen] = useState(false);
  const [isHanjaWritingResultsOpen, setIsHanjaWritingResultsOpen] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>(initialQuestionResults);
  const [questionVotingResults, setQuestionVotingResults] = useState<QuestionVotingRanking>(initialQuestionVotingResults);
  const [oneLineShareResults, setOneLineShareResults] = useState<OneLineShareResults>(initialOneLineShareResults);
  const [hanjaWritingResults, setHanjaWritingResults] = useState<HanjaWritingResults>(initialHanjaWritingResults);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const data = await getRoomSessions(roomId);
      if (cancelled) return;
      setSessions((data as Session[]) ?? []);

      if (activityType === "question_generator") {
        const questionData = await getQuestionGeneratorRoomResults(roomId);
        if (cancelled) return;
        setQuestionResults((questionData as QuestionResult[]) ?? []);
      } else if (activityType === "question_voting") {
        const votingData = await getQuestionVotingRoomResults(roomId);
        if (cancelled) return;
        setQuestionVotingResults(votingData ?? []);
      } else if (activityType === "one_line_share") {
        const oneLineData = await getOneLineShareRoomResults(roomId);
        if (cancelled) return;
        setOneLineShareResults(oneLineData ?? []);
      } else if (activityType === "hanja_writing") {
        const hanjaData = await getHanjaWritingRoomResults(roomId);
        if (cancelled) return;
        setHanjaWritingResults(hanjaData ?? []);
      }
    };

    void run();
    if (!isActive) return () => { cancelled = true; };
    const interval = setInterval(() => void run(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, isActive, activityType]);

  const doneSessions = sessions.filter(s => s.status === "done");
  const activeSessions = sessions.filter(s => s.status === "in_progress");
  const connectedStudentIds = new Set(
    sessions.flatMap((session) => session.agit_student_id ? [session.agit_student_id] : []),
  );
  const connectedLegacyNumbers = new Set(
    sessions.flatMap((session) => session.agit_student_id ? [] : [session.student_number]),
  );
  const notConnected = students.filter((student) => (
    !connectedStudentIds.has(student.id)
    && !connectedLegacyNumbers.has(student.student_number)
  ));
  return (
    <>
      {showResultQr && qrTarget ? (
        <StudentQrModal
          sessionId={qrTarget.id}
          studentName={qrTarget.student_name}
          studentNumber={qrTarget.student_number}
          onClose={() => setQrTarget(null)}
        />
      ) : null}
      {isQuestionResultsOpen && (
        <QuestionResultsModal
          results={questionResults}
          roomId={roomId}
          onResultsChange={setQuestionResults}
          onClose={() => setIsQuestionResultsOpen(false)}
        />
      )}
      {isQuestionVotingResultsOpen && (
        <QuestionVotingResultsModal
          ranking={questionVotingResults}
          onClose={() => setIsQuestionVotingResultsOpen(false)}
        />
      )}
      {isOneLineShareResultsOpen && (
        <OneLineShareResultsModal
          entries={oneLineShareResults}
          onClose={() => setIsOneLineShareResultsOpen(false)}
        />
      )}
      {activeSessionResult && (
        <StudentSessionResultModal
          session={activeSessionResult}
          activityType={activityType}
          questionResults={questionResults}
          questionVotingResults={questionVotingResults}
          oneLineShareResults={oneLineShareResults}
          onClose={() => setActiveSessionResult(null)}
        />
      )}
      {isHanjaWritingResultsOpen && (
        <HanjaWritingResultsModal
          entries={hanjaWritingResults}
          onClose={() => setIsHanjaWritingResultsOpen(false)}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-md p-4 sm:p-5 space-y-3.5">
        {/* 상단 액션 바 (실시간 상태 + 결과 모아보기 버튼) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                실시간 갱신 중
              </span>
            )}
            <span className="text-xs text-gray-500">
              {activityType === "question_generator" && "학생 질문 모아보기 가능"}
              {activityType === "question_voting" && "좋은 질문 득표수 실시간 집계"}
              {activityType === "one_line_share" && "한 줄 및 좋아요 수 집계"}
              {activityType === "hanja_writing" && "한자 문장 및 반응 집계"}
              {activityType === "outline_builder" && "개요 완성 즉시 팝업 열람 가능"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activityType === "question_generator" && (
              <button
                type="button"
                onClick={() => setIsQuestionResultsOpen(true)}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-sky-200"
                disabled={questionResults.length === 0}
              >
                📊 질문 결과 모아보기
              </button>
            )}
            {activityType === "question_voting" && (
              <button
                type="button"
                onClick={() => setIsQuestionVotingResultsOpen(true)}
                className="rounded-xl bg-violet-500 hover:bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-violet-200"
                disabled={questionVotingResults.length === 0}
              >
                📊 좋은 질문 결과 보기
              </button>
            )}
            {activityType === "one_line_share" && (
              <button
                type="button"
                onClick={() => setIsOneLineShareResultsOpen(true)}
                className="rounded-xl bg-rose-500 hover:bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-rose-200"
                disabled={oneLineShareResults.length === 0}
              >
                💬 한줄모아 결과 보기
              </button>
            )}
            {activityType === "hanja_writing" && (
              <button
                type="button"
                onClick={() => setIsHanjaWritingResultsOpen(true)}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-amber-200"
                disabled={hanjaWritingResults.length === 0}
              >
                📜 한자 문장 결과 보기
              </button>
            )}
          </div>
        </div>

        {/* 📊 슬림 현황 대시보드 (20명 기준) */}
        {(() => {
          const totalCount = students.length || (doneSessions.length + activeSessions.length);
          const donePct = totalCount > 0 ? Math.round((doneSessions.length / totalCount) * 100) : 0;
          const activePct = totalCount > 0 ? Math.round((activeSessions.length / totalCount) * 100) : 0;
          const notConnectedPct = totalCount > 0 ? Math.max(0, 100 - donePct - activePct) : 0;

          return (
            <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                <span>학급 전체 진척도 (총 {totalCount}명)</span>
                <span className="text-emerald-700 font-extrabold">{donePct}% 완료 ({doneSessions.length}명)</span>
              </div>

              {/* 3단 프로그레스 바 */}
              <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${donePct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`제출 완료: ${doneSessions.length}명 (${donePct}%)`}
                />
                <div
                  style={{ width: `${activePct}%` }}
                  className="bg-sky-400 transition-all duration-500"
                  title={`작성 중: ${activeSessions.length}명 (${activePct}%)`}
                />
                <div
                  style={{ width: `${notConnectedPct}%` }}
                  className="bg-gray-300 transition-all duration-500"
                  title={`시작 전: ${notConnected.length}명 (${notConnectedPct}%)`}
                />
              </div>

              {/* 3개 지표 인라인 카드 */}
              <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                <div className="rounded-lg bg-white px-2 py-1.5 border border-emerald-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-700 block">🟢 완료</span>
                  <span className="text-lg font-black text-emerald-800 leading-tight block mt-0.5">
                    {doneSessions.length}<span className="text-[10px] font-normal text-gray-400">/{totalCount}</span>
                  </span>
                </div>

                <div className="rounded-lg bg-white px-2 py-1.5 border border-sky-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-sky-700 block">🔵 작성 중</span>
                  <span className="text-lg font-black text-sky-800 leading-tight block mt-0.5">
                    {activeSessions.length}<span className="text-[10px] font-normal text-gray-400">명</span>
                  </span>
                </div>

                <div className="rounded-lg bg-white px-2 py-1.5 border border-gray-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-gray-500 block">⚪ 시작 전</span>
                  <span className="text-lg font-black text-gray-700 leading-tight block mt-0.5">
                    {notConnected.length}<span className="text-[10px] font-normal text-gray-400">명</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 1. 제출 완료 학생 목록 (최상단 배치: 결과 조회 및 피드백 우선) */}
        {doneSessions.length > 0 && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ✅ 제출 완료 ({doneSessions.length}명)
              </p>
              <p className="text-[11px] text-emerald-700 font-medium">
                {activityType === "question_generator"
                  ? "보기 → 학생 질문 상세"
                  : activityType === "question_voting"
                    ? "보기 → 학생 선택 결과"
                    : activityType === "one_line_share"
                      ? "보기 → 학생 문장 상세"
                      : activityType === "hanja_writing"
                        ? "보기 → 학생 문장 상세"
                    : showResultQr
                      ? "QR 버튼 → 학생 개인 결과 QR"
                      : "보기 → 학생 개요 상세"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {doneSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-1.5 bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 shadow-2xs hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-700 font-mono">
                      {s.student_number}
                    </span>
                    <span className="text-xs font-bold text-gray-800 truncate">{s.student_name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {activityType === "outline_builder" && showResultQr ? (
                      <button
                        type="button"
                        onClick={() => setQrTarget(s)}
                        className="text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium transition-colors"
                        title="개인 결과 QR 보기"
                      >
                        QR
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setActiveSessionResult(s)}
                      className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded shadow-2xs transition-all active:scale-95"
                    >
                      보기 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. 작성 중인 학생 목록 (중간 배치) */}
        {activeSessions.length > 0 && (
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-sky-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                ✏️ 작성 중인 학생 ({activeSessions.length}명)
              </p>
              <span className="text-[11px] text-sky-600 font-medium">실시간 작성 진행</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
              {activeSessions.map((s) => (
                <div key={s.id} className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 shadow-2xs flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-100 text-[11px] font-bold text-sky-700 font-mono">
                    {s.student_number}
                  </span>
                  <span className="text-xs font-bold text-gray-800 truncate flex-1">{s.student_name}</span>
                  {s.level && (
                    <span className={`text-[10px] px-1 rounded shrink-0 ${levelStyle(s.level)}`}>
                      {levelLabel(s.level)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. 시작 전 학생 목록 (컴팩트 칩 그리드) */}
        {notConnected.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-600">⬜ 시작 전 ({notConnected.length}명)</p>
              <span className="text-[11px] text-gray-400">미참여 학생</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-1">
              {notConnected.map((s) => (
                <div key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-1.5 py-1 text-xs shadow-2xs">
                  <span className="text-[10px] text-gray-400 font-mono w-3.5 shrink-0">{s.student_number}</span>
                  <span className="text-[11px] text-gray-600 font-medium truncate">{s.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && students.length === 0 && (
          <p className="text-center text-gray-400 text-xs py-3">학생 명단이 없습니다.</p>
        )}

        {sessions.length === 0 && students.length > 0 && (
          <p className="text-center text-gray-400 text-xs py-2 animate-pulse">
            학생이 활동에 입장하면 여기에 표시돼요
          </p>
        )}
      </div>
    </>
  );
}
