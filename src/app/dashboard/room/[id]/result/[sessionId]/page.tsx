import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { StudentResultQr } from "./student-result-qr";
import { parseOutlineResult } from "@/lib/result-format";
import type { QuestionGeneratorSubmission } from "@/features/activities/types";

export default async function TeacherResultPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const user = await getCurrentUser();
  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("room_id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: queue } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .select("result")
    .eq("session_id", sessionId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("title, topic, teacher_id, activity_type")
    .eq("id", id)
    .maybeSingle();

  if (room?.teacher_id !== user?.id) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${sessionId}`;
  const resultPayload = parseOutlineResult(queue?.result);
  const questionSubmission = normalizeQuestionGeneratorSubmission(session.submission);
  const isQuestionGenerator = room?.activity_type === "question_generator";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8 pb-16">
        <Link href={`/dashboard/room/${id}`} className="text-indigo-500 text-sm hover:underline">← 방으로</Link>
        <div className="bg-white rounded-3xl shadow-xl p-8 mt-4 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-400">{room?.title} · {room?.topic}</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-1">
                {session.student_number}번 {session.student_name}
              </h1>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${levelStyle(session.level)}`}>
                  {levelLabel(session.level)}
                </span>
              </div>
            </div>
            {/* 학생 개인 QR */}
            {!isQuestionGenerator && resultPayload.outline && (
              <StudentResultQr
                shareUrl={shareUrl}
                studentName={session.student_name}
                studentNumber={session.student_number}
              />
            )}
          </div>

          {!isQuestionGenerator && resultPayload.outline && (
            <div className="grid gap-4">
              <div className="bg-indigo-50 rounded-2xl p-6">
                <h2 className="font-bold text-indigo-800 mb-3">📝 완성된 글쓰기 개요</h2>
                <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed font-sans">
                  {resultPayload.outline}
                </pre>
              </div>

              {resultPayload.draft && (
                <div className="bg-emerald-50 rounded-2xl p-6">
                  <h2 className="font-bold text-emerald-800 mb-3">✍️ 고쳐쓰기용 초고</h2>
                  <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-7 font-sans">
                    {resultPayload.draft}
                  </pre>
                </div>
              )}
            </div>
          )}

          {isQuestionGenerator && questionSubmission && (
            <div className="grid gap-4">
              {questionSubmission.selections.map((selection, index) => (
                <div key={selection.id} className="bg-sky-50 rounded-2xl p-6 space-y-4">
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
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                      질문 완성
                    </span>
                  </div>

                  {selection.originalPrompt && (
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{selection.originalPrompt}</p>
                    </div>
                  )}

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold text-sky-700 mb-2">학생이 만든 질문</p>
                    <p className="text-base font-medium text-sky-950 leading-relaxed">{selection.remixedQuestion}</p>
                  </div>

                  {selection.reason && (
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-semibold text-emerald-700 mb-2">이렇게 만든 이유</p>
                      <p className="text-sm text-emerald-950 leading-relaxed">{selection.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isQuestionGenerator && (
          <div>
            <h2 className="font-bold text-gray-700 mb-3">💬 학생 답변 내용</h2>
            <div className="space-y-3">
              {(session.answers as any[]).map((a: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Q. {a.question}</p>
                  <p className="text-sm text-gray-800 font-medium">→ {a.answer}</p>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeQuestionGeneratorSubmission(value: unknown): QuestionGeneratorSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawSelections = Array.isArray((value as { selections?: unknown[] }).selections)
    ? (value as { selections: unknown[] }).selections
    : [];

  const selections: QuestionGeneratorSubmission["selections"] = rawSelections
    .filter((selection): selection is Record<string, unknown> => typeof selection === "object" && selection !== null && !Array.isArray(selection))
    .map((selection, index) => ({
      id: typeof selection.id === "string" && selection.id.trim()
        ? selection.id.trim()
        : `selection-${index + 1}`,
      method: (selection.method === "direct" ? "direct" : "card_remix") as "direct" | "card_remix",
      cardSetId: typeof selection.cardSetId === "string" && selection.cardSetId.trim()
        ? selection.cardSetId.trim()
        : "custom",
      cardSetLabel: typeof selection.cardSetLabel === "string" && selection.cardSetLabel.trim()
        ? selection.cardSetLabel.trim()
        : (selection.method === "direct" ? "직접 질문 만들기" : "질문 카드"),
      originalPrompt: typeof selection.originalPrompt === "string" && selection.originalPrompt.trim()
        ? selection.originalPrompt.trim()
        : null,
      remixedQuestion: typeof selection.remixedQuestion === "string" ? selection.remixedQuestion.trim() : "",
      reason: typeof selection.reason === "string" && selection.reason.trim()
        ? selection.reason.trim()
        : undefined,
    }))
    .filter((selection) => selection.remixedQuestion.length > 0);

  return selections.length > 0 ? { selections } : null;
}

function levelLabel(level: string) {
  return { low: "글쓰기 도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return { low: "bg-orange-100 text-orange-700", mid: "bg-blue-100 text-blue-700", high: "bg-green-100 text-green-700" }[level] ?? "bg-gray-100 text-gray-600";
}
