import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { CopyButton } from "./copy-button";
import { parseOutlineResult } from "@/lib/result-format";

function parseOutline(text: string) {
  const sections: { title: string; content: string }[] = [];
  const blocks = text.split(/(?=📝)/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.indexOf("\n");
    const title = trimmed
      .slice(0, firstLine === -1 ? undefined : firstLine)
      .replace("📝", "")
      .trim();
    const body = firstLine === -1 ? "" : trimmed.slice(firstLine + 1).trim();
    const content = body
      .split("\n")
      .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
      .filter(Boolean)
      .join("\n");
    if (title) sections.push({ title, content });
  }
  return sections;
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ n?: string; name?: string }>;
}) {
  const { sessionId } = await params;
  const { n, name } = await searchParams;

  const admin = createSupabaseAdminClient();

  // 세션 기본 정보 조회
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

  // 인증 전: 번호+이름 입력 폼
  const studentNumber = Number(n ?? "");
  const studentName = (name ?? "").trim();
  const verified =
    studentNumber === session.student_number &&
    studentName === session.student_name;
  const attempted = n !== undefined || name !== undefined;

  if (!verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📋</div>
            <h1 className="text-xl font-bold text-gray-800">내 개요 보기</h1>
            <p className="text-sm text-gray-500 mt-1">
              번호와 이름을 입력하면 내 글쓰기 개요를 볼 수 있어요
            </p>
          </div>

          {/* GET 방식 폼 — JS 없이도 동작 */}
          <form method="GET" action="" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                학생 번호
              </label>
              <input
                name="n"
                type="number"
                required
                inputMode="numeric"
                placeholder="예) 5"
                defaultValue={n ?? ""}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="예) 홍길동"
                defaultValue={name ?? ""}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>

            {attempted && !verified && (
              <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">
                번호나 이름이 맞지 않아요. 다시 확인해보세요.
              </p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-orange-400 text-white rounded-xl font-bold text-base hover:bg-orange-500 active:scale-95 transition-all"
            >
              📖 내 개요 보기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 인증 성공: 결과 조회
  const [{ data: queue }, { data: room }] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("outline_queue")
      .select("result")
      .eq("session_id", sessionId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("topic, title")
      .eq("id", session.room_id)
      .maybeSingle(),
  ]);

  if (!queue?.result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">개요 생성 중이에요</h1>
          <p className="text-gray-500 text-sm">잠시 후 다시 스캔해보세요.</p>
        </div>
      </div>
    );
  }

  const resultPayload = parseOutlineResult(queue.result);
  const sections = parseOutline(resultPayload.outline ?? "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="max-w-lg mx-auto pt-8 pb-16 space-y-4">
        {/* 헤더 */}
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

        {/* 개요 본문 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {sections.length > 0 ? (
            sections.map((sec, i) => (
              <div
                key={i}
                className={`p-5 ${i < sections.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-2">
                  {sec.title}
                </p>
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
              </div>
            ))
          ) : (
            <div className="p-5">
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                {resultPayload.outline ?? queue.result}
              </p>
            </div>
          )}
        </div>

        {resultPayload.draft && (
          <div className="bg-white rounded-3xl shadow-xl p-5">
            <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">
              글처럼 보기
            </h2>
            <p className="text-gray-800 text-sm leading-7 whitespace-pre-line">
              {resultPayload.draft}
            </p>
          </div>
        )}

        {/* 복사 버튼 */}
        <CopyButton text={resultPayload.outline ?? queue.result} />

        <p className="text-center text-xs text-gray-400">
          이 개요를 보면서 글을 완성해봐요 ✍️
        </p>
      </div>
    </div>
  );
}
