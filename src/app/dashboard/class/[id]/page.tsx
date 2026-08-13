import Link from "next/link";
import { notFound } from "next/navigation";
import { getClass, getClassStudents, getClassRooms } from "@/app/actions/class-actions";
import { isActivityType } from "@/features/activities/types";
import { DeleteClassButton } from "./delete-button";
import { DeleteRoomButton } from "./delete-room-button";
import { RosterManager } from "./roster-manager";
import { DraftSessionsPanel } from "./draft-sessions-panel";
import { ClosedRoomsTabs } from "./closed-rooms-tabs";

type UnifiedRoom = { kind: "writing"; id: string; title: string; topic: string; subject_type: string | null; activity_type: string | null; is_active: boolean; created_at: string; expires_at: string | null };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cls, students, rooms] = await Promise.all([
    getClass(id),
    getClassStudents(id),
    getClassRooms(id),
  ]);

  if (!cls) notFound();

  const unified: UnifiedRoom[] = [
    ...rooms
      .filter((room) => room.activity_type == null || isActivityType(room.activity_type))
      .map((r): UnifiedRoom => ({
      kind: "writing",
      id: r.id,
      title: r.title,
      topic: r.topic,
      subject_type: r.subject_type ?? null,
      activity_type: r.activity_type ?? null,
      is_active: r.is_active,
      created_at: r.created_at,
      expires_at: r.expires_at ?? null,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const activeRooms = unified.filter((r) => r.is_active);
  const closedRooms = unified.filter((r) => !r.is_active);

  return (
    <main className="lab-page">
      <div className="lab-page__content">
        <Link href="/dashboard" className="lab-breadcrumb">← 학급 목록</Link>
        <div className="lab-page-heading">
          <div>
            <div className="flex items-center gap-3">
              <h1>🏫 {cls.name}</h1>
              <span className="lab-chip">{cls.grade_level}</span>
            </div>
            <p>학생 명단과 글쓰기 활동 세션을 한곳에서 관리합니다.</p>
          </div>
          <Link href={`/dashboard/room/new?class_id=${id}`} className="lab-button lab-button--primary">
            + 활동 만들기
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <RosterManager classId={id} students={students} rosterLocked={activeRooms.length > 0} />
            <div className="lab-panel p-7">
              <DeleteClassButton classId={id} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-7">
          <DraftSessionsPanel classId={id} />

          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4">🟢 진행 중인 활동 세션 ({activeRooms.length})</h2>
            {activeRooms.length === 0 ? (
              <div className="lab-panel lab-empty">
                <p className="text-base text-gray-400">진행 중인 활동 세션이 없습니다.</p>
                <Link href={`/dashboard/room/new?class_id=${id}`}
                  className="inline-block mt-3 text-indigo-500 text-base hover:underline">
                  새 활동 시작하기 →
                </Link>
              </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                {activeRooms.map((room) => (
                  <ActivityCard key={room.id} room={room} status="active" />
                ))}
              </div>
            )}
          </div>

          {closedRooms.length > 0 && (
            <ClosedRoomsTabs closedRooms={closedRooms} />
          )}
        </div>
        </div>
      </div>
    </main>
  );
}

function ActivityCard({ room, status }: { room: UnifiedRoom; status: "active" | "closed" }) {
  const href = `/dashboard/room/${room.id}`;
  const isActive = status === "active";

  if (status === "closed") {
    return (
      <div className={`relative bg-white/60 rounded-2xl hover:bg-white transition-colors opacity-70 hover:opacity-100 border-l-4 ${cardAccentBorder(room)}`}>
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
            {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
              <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">{room.subject_type}</span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-2">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
        </Link>
        <div className="absolute top-3 right-3"><DeleteRoomButton roomId={room.id} /></div>
      </div>
    );
  }

  return (
    <Link href={href}
      className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 ${cardAccentBorder(room)}`}>
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
        {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
          <span className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">{room.subject_type}</span>
        )}
        {isActive && room.expires_at && (
          <ExpiryBadge expiresAt={room.expires_at} />
        )}
      </div>
      <p className="text-sm text-gray-400 mt-2">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
    </Link>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  return (
    <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">
      ⏰ {new Date(expiresAt).toLocaleString("ko-KR")}까지
    </span>
  );
}

function kindLabel(room: UnifiedRoom): string {
  return writingActivityMeta(room.activity_type).label;
}

function kindChipColor(room: UnifiedRoom): string {
  return writingActivityMeta(room.activity_type).chip;
}

function activeBadgeColor(room: UnifiedRoom): string {
  return writingActivityMeta(room.activity_type).activeBadge;
}

function activeDotColor(room: UnifiedRoom): string {
  return writingActivityMeta(room.activity_type).activeDot;
}

function cardAccentBorder(room: UnifiedRoom): string {
  switch (room.activity_type) {
    case "question_generator": return "border-violet-300 hover:border-violet-400";
    case "question_voting": return "border-amber-300 hover:border-amber-400";
    case "one_line_share": return "border-rose-300 hover:border-rose-400";
    case "hanja_writing": return "border-amber-300 hover:border-orange-400";
    case "outline_builder":
    default: return "border-indigo-300 hover:border-indigo-400";
  }
}

function cardEmoji(room: UnifiedRoom): string {
  const activityMeta = writingActivityMeta(room.activity_type);
  if (activityMeta.emoji) return activityMeta.emoji;
  return subjectEmoji(room.subject_type);
}

export type WritingActivityMeta = {
  label: string;
  emoji: string;
  chip: string;
  border: string;
  hoverBorder: string;
  activeBadge: string;
  activeDot: string;
};

export function writingActivityMeta(activityType: string | null | undefined): WritingActivityMeta {
  switch (activityType) {
    case "question_generator":
      return {
        label: "질문 만들기",
        emoji: "🃏",
        chip: "bg-violet-50 text-violet-700 border border-violet-100",
        border: "border-violet-100",
        hoverBorder: "hover:border-violet-200",
        activeBadge: "text-violet-700 bg-violet-50",
        activeDot: "bg-violet-500",
      };
    case "question_voting":
      return {
        label: "좋은 질문 고르기",
        emoji: "🗳️",
        chip: "bg-amber-50 text-amber-700 border border-amber-100",
        border: "border-amber-100",
        hoverBorder: "hover:border-amber-200",
        activeBadge: "text-amber-700 bg-amber-50",
        activeDot: "bg-amber-500",
      };
    case "one_line_share":
      return {
        label: "한 줄 모아",
        emoji: "💬",
        chip: "bg-rose-50 text-rose-700 border border-rose-100",
        border: "border-rose-100",
        hoverBorder: "hover:border-rose-200",
        activeBadge: "text-rose-700 bg-rose-50",
        activeDot: "bg-rose-500",
      };
    case "hanja_writing":
      return {
        label: "한자 활용 문장",
        emoji: "📜",
        chip: "bg-amber-50 text-amber-700 border border-amber-100",
        border: "border-amber-100",
        hoverBorder: "hover:border-amber-200",
        activeBadge: "text-amber-700 bg-amber-50",
        activeDot: "bg-amber-500",
      };
    case "outline_builder":
    default:
      return {
        label: "글 개요짜기",
        emoji: "",
        chip: "bg-indigo-50 text-indigo-600 border border-indigo-100",
        border: "border-indigo-100",
        hoverBorder: "hover:border-indigo-200",
        activeBadge: "text-green-700 bg-green-100",
        activeDot: "bg-green-500",
      };
  }
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
