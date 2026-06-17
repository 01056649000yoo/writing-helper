import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { CopyButton } from "./copy-button";

type OutlineAnswer = {
  section: "처음" | "가운데" | "끝";
  label: string;
  answer: string;
};

function normalizeAnswers(raw: unknown): OutlineAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null && !Array.isArray(a))
    .map((a): OutlineAnswer => ({
      section: (a.section === "처음" || a.section === "가운데" || a.section === "끝") ? a.section : "처음",
      label: typeof a.label === "string" ? a.label : "",
      answer: typeof a.answer === "string" ? a.answer : "",
    }))
    .filter((a) => a.label || a.answer);
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const admin = createSupabaseAdminClient();

  // 세션 기본 정보 조회 — sessionId 자체가 추측 불가능한 UUID 토큰이므로 추가 인증 없이 결과를 보여줌
  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, student_number, student_name, room_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">😅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">결과를 찾을 수 없어요</h1>
          <p className="text-gray-500 text-sm">선생님께 QR 코드를 다시 받아보세요.</p>
        </div>
      </div>
    );
  }

  // 학생 세션 답변 + 방 정보
  const [{ data: sessionAnswers }, { data: room }] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("answers")
      .eq("id", sessionId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("topic, title")
      .eq("id", session.room_id)
      .maybeSingle(),
  ]);

  const answers = normalizeAnswers(sessionAnswers?.answers);

  if (answers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">아직 제출된 개요가 없어요</h1>
          <p className="text-gray-500 text-sm">학생이 개요를 제출한 뒤 다시 스캔해보세요.</p>
        </div>
      </div>
    );
  }

  const sectionOrder: OutlineAnswer["section"][] = ["처음", "가운데", "끝"];
  const grouped = sectionOrder
    .map((section) => ({ section, items: answers.filter((a) => a.section === section) }))
    .filter((g) => g.items.length > 0);

  const copyText = grouped
    .map(({ section, items }) => `[${section}]\n${items.map((i) => `- ${i.label}: ${i.answer}`).join("\n")}`)
    .join("\n\n");

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="max-w-lg mx-auto pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">개요 완성!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            <strong className="text-orange-600">
              {session.student_number}번 {session.student_name}
            </strong>
            의 <strong>{room?.topic}</strong> 글쓰기 개요
          </p>
          {room?.title && (
            <p className="text-xs text-gray-400 mt-1">{room.title}</p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {grouped.map(({ section, items }, sectionIndex) => (
            <div key={section} className={`p-5 ${sectionIndex < grouped.length - 1 ? "border-b border-gray-100" : ""}`}>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-3">
                ✏️ {section}
              </p>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-orange-50/60 px-4 py-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">{item.label}</p>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{item.answer || "(비어 있음)"}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <CopyButton text={copyText} />

        <p className="text-center text-xs text-gray-400">
          이 개요를 보면서 글을 완성해봐요 ✍️
        </p>
      </div>
    </div>
  );
}
