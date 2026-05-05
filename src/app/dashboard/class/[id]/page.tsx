import Link from "next/link";
import { notFound } from "next/navigation";
import { getClass, getClassStudents, getClassRooms } from "@/app/actions/class-actions";
import { DeleteClassButton } from "./delete-button";
import { DeleteRoomButton } from "./delete-room-button";
import { RosterManager } from "./roster-manager";
import { DraftSessionsPanel } from "./draft-sessions-panel";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cls, students, rooms] = await Promise.all([
    getClass(id),
    getClassStudents(id),
    getClassRooms(id),
  ]);

  if (!cls) notFound();

  const activeRooms = rooms.filter(r => r.is_active);
  const closedRooms = rooms.filter(r => !r.is_active);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-base">← 대시보드</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-800">🏫 {cls.name}</h1>
            <span className="text-sm bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-medium">{cls.grade_level}</span>
          </div>
          <Link href={`/dashboard/room/new?class_id=${id}`}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-semibold text-base hover:bg-indigo-600 transition-colors">
            + 새 활동 시작하기
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-10 py-8 grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* 학생 명단 */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <RosterManager
              classId={id}
              students={students}
              rosterLocked={activeRooms.length > 0}
            />
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <DeleteClassButton classId={id} />
            </div>
          </div>
        </div>

        {/* 활동 세션 목록 */}
        <div className="lg:col-span-2 space-y-7">
          <DraftSessionsPanel classId={id} />

          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">🟢 진행 중인 활동 세션 ({activeRooms.length})</h2>
            {activeRooms.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                <p className="text-base text-gray-400">진행 중인 활동 세션이 없습니다.</p>
                <Link href={`/dashboard/room/new?class_id=${id}`}
                  className="inline-block mt-3 text-indigo-500 text-base hover:underline">
                  새 활동 시작하기 →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeRooms.map(room => (
                  <Link key={room.id} href={`/dashboard/room/${room.id}`}
                    className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-indigo-100">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{subjectEmoji(room.subject_type)}</span>
                      <span className="text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">진행 중</span>
                    </div>
                    <h3 className="font-bold text-gray-800 text-base">{room.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">주제: {room.topic}</p>
                    <div className="flex gap-2 mt-2.5">
                      <span className="text-sm bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded">{room.subject_type}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {closedRooms.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">⚫ 종료된 활동 세션 ({closedRooms.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {closedRooms.map(room => (
                  <div key={room.id} className="relative bg-white/60 rounded-2xl hover:bg-white transition-colors opacity-70 hover:opacity-100">
                    <Link href={`/dashboard/room/${room.id}`} className="block p-6">
                      <h3 className="font-semibold text-gray-700 text-base">{room.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">주제: {room.topic}</p>
                      <p className="text-sm text-gray-400 mt-1.5">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
                    </Link>
                    <div className="absolute top-3 right-3">
                      <DeleteRoomButton roomId={room.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function subjectEmoji(type: string) {
  const map: Record<string, string> = {
    "생활문": "📖", "일기": "📓", "편지": "✉️", "독서감상문": "📚",
    "기행문": "🗺️", "관찰기록문": "🔬", "이야기 글": "🌈",
    "설명하는 글": "🔍", "주장하는 글": "💬", "소개하는 글": "🙋",
    "동시": "🎵", "보고서": "📋",
  };
  return map[type] ?? "✏️";
}
