"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  getWordGameRoomResults,
  updateQuestionGeneratorSelection,
  type SpellingCorrectionCandidate,
} from "@/app/actions/room-actions";
import {
  QuestionVotingCompactList,
  QuestionVotingTopThree,
} from "@/components/question-voting-ranking-summary";

type Student = { id: string; student_number: number; student_name: string };
type Session = {
  id: string;
  student_number: number;
  student_name: string;
  level: string | null;
  status: string;
};
type ActivityType = "outline_builder" | "question_generator" | "question_voting" | "one_line_share" | "hanja_writing" | "word_game";
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
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  createdAt: string;
}>;
type WordGameResults = {
  rankings: Array<{
    studentNumber: number;
    studentName: string;
    score: number;
    correctCount: number;
    wrongCount: number;
    usedHints: number;
    currentIndex: number;
    totalQuestions: number;
    teamId: string | null;
    status: "in_progress" | "done";
  }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    color: string;
    memberCount: number;
    activeCount: number;
    completedCount: number;
    averageScore: number;
    averageGrowthBonus: number;
    averageCorrectRate: number;
    tugOffset: number;
  }>;
  progress: {
    totalStudents: number;
    connectedStudents: number;
    activeStudents: number;
    completedStudents: number;
    averageCorrectRate: number;
  };
  hardWords: Array<{
    word: string;
    wrongCount: number;
    correctCount: number;
  }>;
};

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
    if (!window.confirm("OpenAI에 모든 질문을 보내 맞춤법을 교정합니다. 진행할까요?")) return;
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
            <div className="grid gap-3 sm:grid-cols-2">
              {entries.map((entry) => (
                <div key={entry.sessionId} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-amber-700">{entry.studentNumber}번 {entry.studentName}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700">
                      좋아요 {entry.likeCount}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-800">{entry.content}</p>
                  <p className="mt-3 text-[11px] text-gray-400">
                    {new Date(entry.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
              ))}
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
  wordGameResults: initialWordGameResults,
}: {
  roomId: string;
  students: Student[];
  isActive: boolean;
  activityType: ActivityType;
  questionResults: QuestionResult[];
  questionVotingResults: QuestionVotingRanking;
  oneLineShareResults: OneLineShareResults;
  hanjaWritingResults: HanjaWritingResults;
  wordGameResults: WordGameResults | null;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [qrTarget, setQrTarget] = useState<Session | null>(null);
  const [isQuestionResultsOpen, setIsQuestionResultsOpen] = useState(false);
  const [isQuestionVotingResultsOpen, setIsQuestionVotingResultsOpen] = useState(false);
  const [isOneLineShareResultsOpen, setIsOneLineShareResultsOpen] = useState(false);
  const [isHanjaWritingResultsOpen, setIsHanjaWritingResultsOpen] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>(initialQuestionResults);
  const [questionVotingResults, setQuestionVotingResults] = useState<QuestionVotingRanking>(initialQuestionVotingResults);
  const [oneLineShareResults, setOneLineShareResults] = useState<OneLineShareResults>(initialOneLineShareResults);
  const [hanjaWritingResults, setHanjaWritingResults] = useState<HanjaWritingResults>(initialHanjaWritingResults);
  const [wordGameResults, setWordGameResults] = useState<WordGameResults | null>(initialWordGameResults);

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
      } else if (activityType === "word_game") {
        const wordGameData = await getWordGameRoomResults(roomId);
        if (cancelled) return;
        setWordGameResults(wordGameData);
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
  const connectedNums = new Set(sessions.map(s => s.student_number));
  const notConnected = students.filter(s => !connectedNums.has(s.student_number));
  const wordGameRankingByStudent = useMemo(
    () => new Map((wordGameResults?.rankings ?? []).map((entry) => [entry.studentNumber, entry] as const)),
    [wordGameResults],
  );
  const sortedTeams = useMemo(
    () => [...(wordGameResults?.teams ?? [])].sort((a, b) => b.averageScore - a.averageScore || b.averageCorrectRate - a.averageCorrectRate),
    [wordGameResults],
  );
  const topWordGamePlayers = useMemo(
    () => (wordGameResults?.rankings ?? []).slice(0, 5),
    [wordGameResults],
  );
  const chasingPlayers = useMemo(
    () => (wordGameResults?.rankings ?? []).filter((entry) => entry.status === "in_progress").slice(0, 4),
    [wordGameResults],
  );

  return (
    <>
      {qrTarget && (
        <StudentQrModal
          sessionId={qrTarget.id}
          studentName={qrTarget.student_name}
          studentNumber={qrTarget.student_number}
          onClose={() => setQrTarget(null)}
        />
      )}
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
      {isHanjaWritingResultsOpen && (
        <HanjaWritingResultsModal
          entries={hanjaWritingResults}
          onClose={() => setIsHanjaWritingResultsOpen(false)}
        />
      )}

      <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">학생 활동 현황</h2>
            {activityType === "question_generator" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 만든 질문을 모달에서 한 번에 모아볼 수 있어요.</p>
            )}
            {activityType === "question_voting" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 고른 좋은 질문 결과를 득표순으로 바로 확인할 수 있어요.</p>
            )}
            {activityType === "one_line_share" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 쓴 한 줄과 좋아요 수를 실시간으로 모아볼 수 있어요.</p>
            )}
            {activityType === "hanja_writing" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 만든 한자 문장을 실시간으로 모아보고 학급 전체 결과를 함께 볼 수 있어요.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activityType === "question_generator" && (
              <button
                type="button"
                onClick={() => setIsQuestionResultsOpen(true)}
                className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200"
                disabled={questionResults.length === 0}
              >
                질문 결과 모아보기
              </button>
            )}
            {activityType === "question_voting" && (
              <button
                type="button"
                onClick={() => setIsQuestionVotingResultsOpen(true)}
                className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-violet-200"
                disabled={questionVotingResults.length === 0}
              >
                좋은 질문 결과 보기
              </button>
            )}
            {activityType === "one_line_share" && (
              <button
                type="button"
                onClick={() => setIsOneLineShareResultsOpen(true)}
                className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-200"
                disabled={oneLineShareResults.length === 0}
              >
                한줄모아 결과 보기
              </button>
            )}
            {activityType === "hanja_writing" && (
              <button
                type="button"
                onClick={() => setIsHanjaWritingResultsOpen(true)}
                className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-200"
                disabled={hanjaWritingResults.length === 0}
              >
                한자 문장 결과 보기
              </button>
            )}
            <div className="flex gap-3 text-sm">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                접속 중 {activeSessions.length}명
              </span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                완료 {doneSessions.length}명
              </span>
              <span className="bg-gray-50 text-gray-500 px-3 py-1 rounded-full font-medium">
                전체 {students.length}명
              </span>
            </div>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                실시간
              </span>
            )}
          </div>
        </div>

        {/* 접속 중 */}
        {activityType === "word_game" && wordGameResults && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-indigo-100 bg-[radial-gradient(circle_at_top,#eef2ff,transparent_55%),linear-gradient(135deg,#f8fbff,#eef2ff)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Live Match</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">팀 경쟁 진행 보드</h3>
                  <p className="mt-1 text-sm text-slate-500">선두 팀과 추격 팀의 흐름을 한눈에 보여줍니다.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <MiniMetric label="참여" value={`${wordGameResults!.progress.connectedStudents}/${wordGameResults!.progress.totalStudents}`} tone="sky" />
                  <MiniMetric label="완료" value={String(wordGameResults!.progress.completedStudents)} tone="emerald" />
                  <MiniMetric label="진행중" value={String(wordGameResults!.progress.activeStudents)} tone="amber" />
                  <MiniMetric label="정답률" value={`${wordGameResults!.progress.averageCorrectRate}%`} tone="violet" />
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">팀 레이스</p>
                    {sortedTeams[0] && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        선두 {sortedTeams[0].teamName}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {sortedTeams.map((team, index) => (
                      <div key={team.teamId} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: team.color }}
                            >
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900">{team.teamName}</p>
                              <p className="text-xs text-slate-500">평균 점수 {team.averageScore} · 성장 {team.averageGrowthBonus}</p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>완료 {team.completedCount}/{team.memberCount}</p>
                            <p>정답률 {team.averageCorrectRate}%</p>
                          </div>
                        </div>
                        <div className="mt-3 h-4 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(team.tugOffset, 8)}%`,
                              background: `linear-gradient(90deg, ${team.color}, ${team.color}cc)`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-white/90 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-800">개인 랭킹 Top 5</p>
                      <span className="text-xs text-slate-400">실시간 반영</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {topWordGamePlayers.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">아직 집계된 점수가 없어요.</p>
                      ) : (
                        topWordGamePlayers.map((player, index) => (
                          <div key={`${player.studentNumber}-${player.teamId ?? "solo"}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{player.studentNumber}번 {player.studentName}</p>
                                {player.teamId && (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                    {player.teamId.replace("team-", "T")}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                                  style={{ width: `${Math.max(Math.round((player.currentIndex / Math.max(player.totalQuestions, 1)) * 100), player.status === "done" ? 100 : 6)}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">{player.score}</p>
                              <p className="text-[11px] text-slate-500">{player.correctCount}정답</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/90 p-4 shadow-sm">
                    <p className="text-sm font-bold text-slate-800">지금 추격 중인 학생</p>
                    <div className="mt-4 space-y-2">
                      {chasingPlayers.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">현재 진행 중인 학생이 없어요.</p>
                      ) : (
                        chasingPlayers.map((player) => {
                          const percent = Math.round((player.currentIndex / Math.max(player.totalQuestions, 1)) * 100);
                          return (
                            <div key={`chase-${player.studentNumber}`} className="rounded-2xl bg-amber-50/70 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">{player.studentNumber}번 {player.studentName}</p>
                                <span className="text-xs font-semibold text-amber-700">{player.currentIndex}/{player.totalQuestions} 문제</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${Math.max(percent, 8)}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {wordGameResults!.hardWords.length > 0 && (
                <div className="mt-4 rounded-3xl bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-800">자주 틀리는 단어</p>
                    <span className="text-xs text-slate-400">즉시 복습 포인트</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {wordGameResults!.hardWords.map((word) => (
                      <div key={word.word} className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
                        <p className="text-base font-bold text-rose-900">{word.word}</p>
                        <div className="mt-3 flex gap-2 text-xs">
                          <span className="rounded-full bg-white px-3 py-1 font-semibold text-rose-700">오답 {word.wrongCount}</span>
                          <span className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-700">정답 {word.correctCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {false && activityType === "word_game" && wordGameResults && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Live Match</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">팀 경쟁 현황</h3>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>참여 {wordGameResults!.progress.connectedStudents}/{wordGameResults!.progress.totalStudents}</p>
                  <p>완료 {wordGameResults!.progress.completedStudents}</p>
                </div>
              </div>
              <div className="mt-4 rounded-full bg-white p-2 shadow-inner">
                <div className="relative h-6 overflow-hidden rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                  {wordGameResults!.teams.slice(0, 2).map((team, index) => (
                    <div
                      key={team.teamId}
                      className={`absolute inset-y-0 ${index === 0 ? "left-0 rounded-r-full" : "right-0 rounded-l-full"} transition-all`}
                      style={{ width: `${Math.max(team.tugOffset, 6)}%`, backgroundColor: team.color }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {wordGameResults!.teams.map((team) => (
                  <div key={team.teamId} className="rounded-2xl bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                        <p className="font-bold text-slate-900">{team.teamName}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        평균 {team.averageScore}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-slate-50 px-2 py-2 text-slate-600">완료 {team.completedCount}/{team.memberCount}</div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2 text-slate-600">성장 {team.averageGrowthBonus}</div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2 text-slate-600">정답률 {team.averageCorrectRate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSessions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-blue-600 mb-2">✏️ 지금 활동 중</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeSessions.map((s) => {
                const ranking = wordGameRankingByStudent.get(s.student_number);
                const progressPercent = ranking
                  ? Math.round((ranking.currentIndex / Math.max(ranking.totalQuestions, 1)) * 100)
                  : 0;

                return (
                  <div key={s.id} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-300 font-mono w-5 shrink-0">{s.student_number}</span>
                      <span className="text-sm font-medium text-blue-800 truncate flex-1">{s.student_name}</span>
                      {s.level && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${levelStyle(s.level)}`}>
                          {levelLabel(s.level)}
                        </span>
                      )}
                    </div>
                    {activityType === "word_game" && ranking && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-blue-700">
                          <span>{ranking.currentIndex}/{ranking.totalQuestions} 문제</span>
                          <span>{ranking.score}점</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${Math.max(progressPercent, 8)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 완료 */}
        {doneSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-600">
                {activityType === "question_generator"
                  ? "✅ 질문 제출 완료"
                  : activityType === "question_voting"
                    ? "✅ 좋은 질문 평가 완료"
                    : activityType === "one_line_share"
                      ? "✅ 한 줄 제출 완료"
                      : activityType === "hanja_writing"
                        ? "✅ 한자 문장 제출 완료"
                    : "✅ 개요 완성"}
              </p>
              <p className="text-xs text-gray-400">
                {activityType === "question_generator"
                  ? "보기 → 학생 질문 상세"
                  : activityType === "question_voting"
                    ? "보기 → 학생 선택 결과"
                    : activityType === "one_line_share"
                      ? "보기 → 학생 문장 상세"
                      : activityType === "hanja_writing"
                        ? "보기 → 학생 문장 상세"
                    : "QR 버튼 → 학생 개인 결과 QR"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {doneSessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-green-300 font-mono w-5 shrink-0">{s.student_number}</span>
                  <span className="text-sm font-medium text-green-800 truncate flex-1">{s.student_name}</span>
                  {/* QR 버튼 */}
                  {activityType === "outline_builder" && (
                    <button
                      type="button"
                      onClick={() => setQrTarget(s)}
                      className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg font-medium transition-colors shrink-0"
                      title="개인 결과 QR 보기"
                    >
                      QR
                    </button>
                  )}
                  {/* 결과 보기 링크 */}
                  <Link
                    href={`/dashboard/room/${roomId}/result/${s.id}`}
                    className="text-xs text-green-500 hover:text-green-700 shrink-0"
                  >
                    보기 →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미접속 */}
        {notConnected.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-2">⬜ 미접속 ({notConnected.length}명)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {notConnected.map(s => (
                <div key={s.id}
                  className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-300 font-mono w-4 shrink-0">{s.student_number}</span>
                  <span className="text-sm text-gray-500 truncate">{s.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">학생 명단이 없습니다.</p>
        )}

        {sessions.length === 0 && students.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-2 animate-pulse">
            학생이 QR 코드로 접속하면 여기에 표시돼요
          </p>
        )}
      </div>
    </>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber" | "violet";
}) {
  const styles = {
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-2xl px-3 py-2 ${styles}`}>
      <p className="text-[11px] font-semibold">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
