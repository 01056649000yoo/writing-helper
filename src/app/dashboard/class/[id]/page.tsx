import Link from "next/link";
import { notFound } from "next/navigation";
import { getClass, getClassStudents, getClassRooms } from "@/app/actions/class-actions";
import { getClassScienceRooms } from "@/app/actions/science-actions";
import { getClassMoralsRooms } from "@/app/actions/morals-actions";
import { TRACK_META } from "@/types/science";
import { MORALS_TRACK_META } from "@/types/morals";
import { DeleteClassButton } from "./delete-button";
import { DeleteRoomButton } from "./delete-room-button";
import { DeleteScienceRoomButton } from "./delete-science-room-button";
import { DeleteMoralsRoomButton } from "./delete-morals-room-button";
import { RosterManager } from "./roster-manager";
import { DraftSessionsPanel } from "./draft-sessions-panel";

type UnifiedRoom =
  | { kind: "writing"; id: string; title: string; topic: string; subject_type: string | null; is_active: boolean; created_at: string; expires_at: string | null }
  | { kind: "science"; id: string; title: string; topic: string; inquiry_track: "basic" | "integrated" | null; is_active: boolean; created_at: string; expires_at: string | null }
  | { kind: "morals"; id: string; title: string; topic: string; track: "reflection" | "judgement"; is_active: boolean; created_at: string; expires_at: string | null };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cls, students, rooms, scienceRooms, moralsRooms] = await Promise.all([
    getClass(id),
    getClassStudents(id),
    getClassRooms(id),
    getClassScienceRooms(id),
    getClassMoralsRooms(id),
  ]);

  if (!cls) notFound();

  const unified: UnifiedRoom[] = [
    ...rooms.map((r): UnifiedRoom => ({
      kind: "writing",
      id: r.id,
      title: r.title,
      topic: r.topic,
      subject_type: r.subject_type ?? null,
      is_active: r.is_active,
      created_at: r.created_at,
      expires_at: r.expires_at ?? null,
    })),
    ...scienceRooms.map((r): UnifiedRoom => ({
      kind: "science",
      id: r.id,
      title: r.title,
      topic: r.topic,
      inquiry_track: r.inquiryTrack,
      is_active: r.is_active,
      created_at: r.created_at,
      expires_at: r.expires_at ?? null,
    })),
    ...moralsRooms.map((r): UnifiedRoom => ({
      kind: "morals",
      id: r.id,
      title: r.title,
      topic: r.topic,
      track: r.track,
      is_active: r.is_active,
      created_at: r.created_at,
      expires_at: r.expires_at ?? null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const activeRooms = unified.filter((r) => r.is_active);
  const closedRooms = unified.filter((r) => !r.is_active);
  const renderNow = Date.now();

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
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/room/new?class_id=${id}`}
              className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-semibold text-sm hover:bg-indigo-600 transition-colors">
              + 활동 만들기
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-10 py-8 grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <RosterManager classId={id} students={students} rosterLocked={activeRooms.length > 0} />
            <div className="bg-white rounded-2xl shadow-sm p-7">
              <DeleteClassButton classId={id} />
            </div>
          </div>
        </div>

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
                {activeRooms.map((room) => (
                  <ActivityCard key={`${room.kind}-${room.id}`} room={room} status="active" now={renderNow} />
                ))}
              </div>
            )}
          </div>

          {closedRooms.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">⚫ 종료된 활동 세션 ({closedRooms.length})</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {closedRooms.map((room) => (
                  <ActivityCard key={`${room.kind}-${room.id}`} room={room} status="closed" now={renderNow} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ActivityCard({ room, status, now }: { room: UnifiedRoom; status: "active" | "closed"; now: number }) {
  const href =
    room.kind === "writing" ? `/dashboard/room/${room.id}` :
    room.kind === "science" ? `/dashboard/science/${room.id}` :
    `/dashboard/morals/${room.id}`;
  const isActive = status === "active";

  function deleteBtn() {
    if (room.kind === "writing") return <DeleteRoomButton roomId={room.id} />;
    if (room.kind === "science") return <DeleteScienceRoomButton roomId={room.id} />;
    return <DeleteMoralsRoomButton roomId={room.id} />;
  }

  if (status === "closed") {
    return (
      <div className="relative bg-white/60 rounded-2xl hover:bg-white transition-colors opacity-70 hover:opacity-100">
        <Link href={href} className="block p-6">
          <div className="flex items-start gap-3 mb-2 pr-16">
            <span className="text-2xl shrink-0">{cardEmoji(room)}</span>
            <h3 className="font-semibold text-gray-700 text-base leading-snug">{room.title}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">주제: {room.topic}</p>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full ${kindChipColor(room)}`}>
              {kindLabel(room)}
            </span>
            {room.kind === "writing" && room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
              <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">{room.subject_type}</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-2">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
        </Link>
        <div className="absolute top-3 right-3">{deleteBtn()}</div>
      </div>
    );
  }

  return (
    <Link href={href}
      className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-transparent ${
        room.kind === "science" ? "hover:border-cyan-100" :
        room.kind === "morals" ? "hover:border-rose-100" :
        "hover:border-indigo-100"
      }`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{cardEmoji(room)}</span>
        {isActive ? (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${activeBadgeColor(room)}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeDotColor(room)}`} />
            진행 중
          </span>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">종료</span>
        )}
      </div>
      <h3 className="font-bold text-gray-800 text-base">{room.title}</h3>
      <p className="text-sm text-gray-500 mt-1 line-clamp-1">주제: {room.topic}</p>
      <div className="flex gap-2 mt-2.5 flex-wrap">
        <span className={`text-xs px-2.5 py-1 rounded-full ${kindChipColor(room)}`}>
          {kindLabel(room)}
        </span>
        {room.kind === "writing" && room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
          <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">{room.subject_type}</span>
        )}
        {isActive && room.expires_at && (
          <ExpiryBadge expiresAt={room.expires_at} now={now} />
        )}
      </div>
      <p className="text-sm text-gray-400 mt-2">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
    </Link>
  );
}

function ExpiryBadge({ expiresAt, now }: { expiresAt: string; now: number }) {
  const exp = new Date(expiresAt).getTime();
  const diffMs = exp - now;

  if (diffMs <= 0) {
    return (
      <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium">
        ⛔ 시간 만료
      </span>
    );
  }

  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;

  let label = "";
  if (diffHour > 0) {
    label = remainMin > 0 ? `${diffHour}시간 ${remainMin}분 남음` : `${diffHour}시간 남음`;
  } else {
    label = `${diffMin}분 남음`;
  }

  const isWarning = diffMin <= 30;

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isWarning ? "bg-amber-100 text-amber-700" : "bg-teal-50 text-teal-700"}`}>
      ⏰ {label}
    </span>
  );
}

function kindLabel(room: UnifiedRoom): string {
  if (room.kind === "writing") return "글쓰기";
  if (room.kind === "science") return room.inquiry_track ? `과학 · ${TRACK_META[room.inquiry_track].label}` : "과학";
  return `도덕 · ${MORALS_TRACK_META[room.track].label}`;
}

function kindChipColor(room: UnifiedRoom): string {
  if (room.kind === "science") return "bg-cyan-50 text-cyan-700";
  if (room.kind === "morals") return "bg-rose-50 text-rose-700";
  return "bg-indigo-50 text-indigo-600";
}

function activeBadgeColor(room: UnifiedRoom): string {
  if (room.kind === "science") return "text-emerald-700 bg-emerald-50";
  if (room.kind === "morals") return "text-rose-700 bg-rose-50";
  return "text-green-700 bg-green-100";
}

function activeDotColor(room: UnifiedRoom): string {
  if (room.kind === "science") return "bg-emerald-500";
  if (room.kind === "morals") return "bg-rose-500";
  return "bg-green-500";
}

function cardEmoji(room: UnifiedRoom): string {
  if (room.kind === "science") return "🔬";
  if (room.kind === "morals") return "🪞";
  return subjectEmoji(room.subject_type);
}

function subjectEmoji(type: string | null) {
  if (!type) return "✏️";
  const map: Record<string, string> = {
    "생활문": "📖", "일기": "📓", "편지": "✉️", "독서감상문": "📚",
    "기행문": "🗺️", "관찰기록문": "🔬", "이야기 글": "🌈",
    "설명하는 글": "🔍", "주장하는 글": "💬", "소개하는 글": "🙋",
    "동시": "🎵", "보고서": "📋",
  };
  return map[type] ?? "✏️";
}
