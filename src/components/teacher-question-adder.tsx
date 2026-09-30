"use client";

import { useEffect, useState } from "react";
import {
  addRoomTeacherQuestion,
  deleteRoomTeacherQuestion,
  getRoomTeacherQuestions,
  updateRoomTeacherQuestion,
} from "@/app/actions/teacher-question-actions";

type TeacherQuestion = { id: string; text: string; createdAt: string };

/**
 * 질문 만들기 실시간 보기의 `👩‍🏫 선생님 질문` (2026-09-30).
 *
 * 학생 질문이 모자랄 때 선생님이 질문을 더한다. 더한 질문은 `좋은 질문 고르기` 를 만들 때 미리 담긴 후보로
 * 올라오고, 거기서 학생들이 개요 짜기 `친구들과 만든 질문` 으로 불러온다. 학생 제출 수에는 섞이지 않는다.
 * 규칙(글자 수·개수)은 서버(lib/room-teacher-questions.ts)가 정하고, 이 화면은 알려 줄 뿐이다.
 */
export function TeacherQuestionAdder({ roomId }: { roomId: string }) {
  const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    let cancelled = false;
    getRoomTeacherQuestions(roomId).then((result) => {
      if (cancelled) return;
      setQuestions(result.questions);
      setError(result.error ?? "");
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [roomId]);

  async function handleAdd() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    const result = await addRoomTeacherQuestion(roomId, text);
    setBusy(false);
    if (result.error || !result.question) {
      setError(result.error ?? "질문을 저장하지 못했습니다.");
      return;
    }
    setQuestions((current) => [...current, result.question!]);
    setDraft("");
  }

  async function handleSaveEdit(questionId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await updateRoomTeacherQuestion(roomId, questionId, editingText);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const text = editingText.replace(/\s+/g, " ").trim();
    setQuestions((current) => current.map((question) => (question.id === questionId ? { ...question, text } : question)));
    setEditingId(null);
  }

  async function handleDelete(questionId: string) {
    if (busy || !window.confirm("이 선생님 질문을 지울까요? 이미 만든 좋은 질문 고르기 활동에는 그대로 남아요.")) return;
    setBusy(true);
    setError("");
    const result = await deleteRoomTeacherQuestion(roomId, questionId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setQuestions((current) => current.filter((question) => question.id !== questionId));
  }

  return (
    <section className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5" aria-label="선생님 질문">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-bold text-violet-900">👩‍🏫 선생님 질문 {questions.length > 0 ? `${questions.length}개` : ""}</h4>
        <p className="text-sm text-violet-700">
          질문이 모자라면 더해 주세요. 좋은 질문 고르기 후보로 담긴 채 올라가고, 학생들이 개요 짜기에서 불러올 수 있어요.
        </p>
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAdd();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={300}
          placeholder="예) 주인공이 그 선택을 하지 않았다면 어떻게 되었을까?"
          aria-label="더할 선생님 질문"
          className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-base font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          + 선생님 질문 추가
        </button>
      </form>

      {error && <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{error}</p>}
      {!loaded && <p className="mt-3 text-sm text-violet-600">선생님 질문을 불러오는 중...</p>}

      {questions.length > 0 && (
        <ol className="mt-3 space-y-2">
          {questions.map((question, index) => (
            <li key={question.id} className="rounded-xl bg-white p-3 shadow-sm">
              {editingId === question.id ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    maxLength={300}
                    aria-label="선생님 질문 고치기"
                    className="min-w-0 flex-1 rounded-xl border border-violet-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                      취소
                    </button>
                    <button type="button" onClick={() => void handleSaveEdit(question.id)} disabled={busy || !editingText.trim()} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-medium leading-relaxed text-gray-900">
                    <span className="mr-2 font-bold text-violet-600">{index + 1}.</span>
                    {question.text}
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setEditingId(question.id); setEditingText(question.text); }}
                      disabled={busy}
                      className="rounded-lg bg-violet-50 px-2.5 py-1 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      ✏️ 수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(question.id)}
                      disabled={busy}
                      className="rounded-lg bg-gray-50 px-2.5 py-1 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      지우기
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
