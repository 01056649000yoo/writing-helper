"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStudentResult } from "@/app/actions/student-actions";
import type { QuestionGeneratorSubmission } from "@/features/activities/types";

type ActivityType = "outline_builder" | "question_generator" | "question_voting";

function parseOutline(text: string) {
  const sections: { title: string; content: string }[] = [];
  const blocks = text.split(/(?=📝)/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.indexOf("\n");
    const title = trimmed.slice(0, firstLine === -1 ? undefined : firstLine).replace("📝", "").trim();
    const body = firstLine === -1 ? "" : trimmed.slice(firstLine + 1).trim();
    const content = body
      .split("\n")
      .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean)
      .join("\n");
    if (title) sections.push({ title, content });
  }
  return sections;
}

export default function StudentResultPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const [outline, setOutline] = useState("");
  const [draft, setDraft] = useState("");
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [viewMode, setViewMode] = useState<"outline" | "draft">("outline");
  const [activityType, setActivityType] = useState<ActivityType>("outline_builder");
  const [questionSubmission, setQuestionSubmission] = useState<QuestionGeneratorSubmission | null>(null);
  const [anonymousPeerQuestions, setAnonymousPeerQuestions] = useState<Array<{ id: string; order: number; questionOrder: number; text: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  useEffect(() => {
    if (!sessionId || !roomId) return;
    getStudentResult(sessionId, roomId).then((data) => {
      setOutline(data.outline ?? "");
      setDraft(data.draft ?? "");
      setStudentName(data.studentName ?? "");
      setTopic(data.topic ?? "");
      setActivityType((data.activityType as ActivityType) ?? "outline_builder");
      setQuestionSubmission(data.questionGeneratorSubmission ?? null);
      setAnonymousPeerQuestions(data.anonymousPeerQuestions ?? []);
      setLoaded(true);
    });
  }, [sessionId, roomId]);

  const currentText = useMemo(() => {
    if (activityType === "question_generator") {
      return questionSubmission?.selections.map((selection) => selection.remixedQuestion).join("\n") ?? "";
    }

    return viewMode === "draft" && draft ? draft : outline;
  }, [activityType, draft, outline, questionSubmission, viewMode]);

  function copyCurrentText() {
    if (!currentText) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(currentText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
      return;
    }

    const el = document.createElement("textarea");
    el.value = currentText;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <p className="text-gray-500">결과를 불러오고 있어요...</p>
        </div>
      </div>
    );
  }

  if (activityType === "question_generator" && questionSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
        <div className="max-w-2xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-2">🃏</div>
            <h1 className="text-2xl font-bold text-gray-800">질문 완성!</h1>
            <p className="text-gray-500 mt-1 text-sm">
              <strong className="text-sky-600">{studentName}</strong>의{" "}
              <strong>{topic}</strong> 질문 만들기 활동
            </p>
          </div>

          {questionSubmission.selections.map((selection, index) => (
            <div key={selection.id} className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-sky-600 uppercase tracking-wide">
                    질문 {index + 1}
                  </p>
                  <h2 className="text-lg font-bold text-gray-800 mt-1">{selection.cardSetLabel}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {selection.method === "direct" ? "직접 질문 만들기" : "질문 카드로 바꾸기"}
                  </p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  내 질문
                </span>
              </div>

              {selection.originalPrompt && (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{selection.originalPrompt}</p>
                </div>
              )}

              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-xs font-semibold text-sky-700 mb-2">오늘 주제에 맞게 바꾼 질문</p>
                <p className="text-base font-medium text-sky-950 leading-relaxed">{selection.remixedQuestion}</p>
              </div>

              {selection.reason && (
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">이렇게 바꾼 이유</p>
                  <p className="text-sm text-emerald-950 leading-relaxed">{selection.reason}</p>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={copyCurrentText}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
              copied ? "bg-green-500 text-white" : "bg-sky-500 text-white hover:bg-sky-600"
            }`}
          >
            {copied ? "✅ 복사됐어요!" : "📋 내 질문 복사하기"}
          </button>

          <Link
            href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
            className="block w-full rounded-2xl border border-sky-200 bg-white py-4 text-center font-bold text-sky-700 transition-colors hover:bg-sky-50"
          >
            ✏️ 질문 다시 수정하기
          </Link>

          <div className="bg-white rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">우리 반 질문 함께 보기</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">친구들이 만든 질문</h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                익명 공개
              </span>
            </div>

            {anonymousPeerQuestions.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-violet-50 px-4 py-4 text-sm leading-relaxed text-violet-700">
                아직 다른 친구 질문이 없어요. 친구들이 제출하면 여기에 익명으로 함께 보입니다.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {anonymousPeerQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs font-semibold text-violet-600">친구 질문 {index + 1}</p>
                    <p className="mt-2 text-sm leading-relaxed text-violet-950">{question.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!outline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-gray-500">아직 보여줄 결과가 없어요.</p>
        </div>
      </div>
    );
  }

  const sections = parseOutline(outline);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="max-w-lg mx-auto pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">개요 완성!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            <strong className="text-orange-600">{studentName}</strong>의{" "}
            <strong>{topic}</strong> 글쓰기 개요
          </p>
        </div>

        {draft && (
          <div className="bg-white rounded-3xl shadow-xl p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setViewMode("outline")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                  viewMode === "outline"
                    ? "bg-orange-400 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                개요 보기
              </button>
              <button
                onClick={() => setViewMode("draft")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                  viewMode === "draft"
                    ? "bg-orange-400 text-white"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                글처럼 보기
              </button>
            </div>
          </div>
        )}

        {viewMode === "outline" ? (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            {sections.length > 0 ? (
              sections.map((section, index) => (
                <div key={index} className={`p-5 ${index < sections.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-2">
                    {section.title}
                  </p>
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-5">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{outline}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-sm font-bold text-orange-500 uppercase tracking-wide mb-3">고쳐쓰기용 초고</h2>
            <p className="text-gray-800 text-sm leading-7 whitespace-pre-line">{draft}</p>
          </div>
        )}

        <button
          onClick={copyCurrentText}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
            copied ? "bg-green-500 text-white" : "bg-orange-400 text-white hover:bg-orange-500"
          }`}
        >
          {copied ? "✅ 복사됐어요!" : viewMode === "draft" ? "📋 초고 복사하기" : "📋 개요 복사하기"}
        </button>

        <p className="text-center text-xs text-gray-400">
          {viewMode === "draft" ? "초고를 읽고 내 문장으로 고쳐 써봐요 ✍️" : "이 개요를 보면서 글을 완성해봐요 ✍️"}
        </p>
      </div>
    </div>
  );
}
