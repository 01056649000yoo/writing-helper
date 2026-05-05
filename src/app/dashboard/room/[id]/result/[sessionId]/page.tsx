import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { StudentResultQr } from "./student-result-qr";
import { parseOutlineResult } from "@/lib/result-format";

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
    .select("title, topic, teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (room?.teacher_id !== user?.id) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${sessionId}`;
  const resultPayload = parseOutlineResult(queue?.result);

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
            {resultPayload.outline && (
              <StudentResultQr
                shareUrl={shareUrl}
                studentName={session.student_name}
                studentNumber={session.student_number}
              />
            )}
          </div>

          {resultPayload.outline && (
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
        </div>
      </div>
    </div>
  );
}

function levelLabel(level: string) {
  return { low: "글쓰기 도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return { low: "bg-orange-100 text-orange-700", mid: "bg-blue-100 text-blue-700", high: "bg-green-100 text-green-700" }[level] ?? "bg-gray-100 text-gray-600";
}
