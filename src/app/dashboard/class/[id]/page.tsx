import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassWorkspace } from "@/app/actions/class-actions";
import { isActivityType } from "@/features/activities/types";
import { DeleteRoomButton } from "./delete-room-button";
import { EditRoomButton } from "./edit-room-button";
import { DraftSessionsPanel } from "./draft-sessions-panel";
import { ClosedRoomsTabs } from "./closed-rooms-tabs";
import { ActiveRoomsTabs } from "./active-rooms-tabs";

type UnifiedRoom = { kind: "writing"; id: string; title: string; topic: string; topic_description: string; subject_type: string | null; activity_type: string | null; is_active: boolean; created_at: string };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const integratedRoster = process.env.LAB_SSO_ENABLED === "true";
  const workspace = await getClassWorkspace(id);
  if (!workspace) notFound();
  const { class: cls, rooms } = workspace;

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
      topic_description: r.topic_description ?? "",
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
            <p>
              {integratedRoster
                ? "아지트 학생 명단으로 글쓰기 활동을 운영합니다."
                : "학생 명단과 글쓰기 활동 세션을 한곳에서 관리합니다."}
            </p>
          </div>
          <Link href={`/dashboard/room/new?class_id=${id}`} className="lab-button lab-button--primary">
            + 활동 만들기
          </Link>
        </div>

        {/* 학생 명단 칸을 없앴다(2026-08-19). 학생은 아지트에서 바로 들어오므로 QR·번호 입장을
            쓰지 않고, 명단은 아지트 학급이 원본이라 여기서 관리할 일이 없다.
            활동 목록이 화면 전체를 쓴다. */}
        <div className="space-y-7">
          <DraftSessionsPanel classId={id} />

          <ActiveRoomsTabs activeRooms={activeRooms} classId={id} />

          {closedRooms.length > 0 && (
            <ClosedRoomsTabs closedRooms={closedRooms} />
          )}
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
      <div className={`relative bg-white rounded-2xl border border-gray-200 shadow-2xs hover:shadow-md transition-all border-l-4 ${cardAccentBorder(room)}`}>
        <Link href={href} className="block p-5">
          <div className="flex items-start gap-2 pr-16">
            <span className="text-2xl shrink-0">{cardEmoji(room)}</span>
            <h3 className="font-semibold text-gray-700 text-sm leading-snug line-clamp-2">{room.title}</h3>
          </div>
          <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">주제: {room.topic}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${kindChipColor(room)}`}>
              {kindLabel(room)}
            </span>
            {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
              <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{room.subject_type}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
        </Link>
        <div className="absolute top-2.5 right-2.5 z-10"><DeleteRoomButton roomId={room.id} /></div>
      </div>
    );
  }

  return (
    <div className={`relative bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border-l-4 ${cardAccentBorder(room)}`}>
      {/* 이름·주제 수정은 카드 위에 겹쳐 둔다. 카드가 통째로 링크라 그 안에 버튼을 넣으면
          링크 안의 링크가 되어 눌림이 엉킨다. */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <EditRoomButton
          roomId={room.id}
          title={room.title}
          topic={room.topic}
          topicDescription={room.topic_description}
        />
      </div>
      <Link href={href} className="block p-5">
        {/* 첫 줄에는 아이콘만 둔다. 상태 배지를 여기 두면 오른쪽 위 수정 버튼과 겹친다
            (버튼이 글자라 폭이 넓다). 상태는 아래 칩 줄에서 함께 보여 준다. */}
        <span className="block text-2xl">{cardEmoji(room)}</span>
        <h3 className="mt-2 font-bold text-gray-800 text-sm leading-snug line-clamp-2">{room.title}</h3>
        <p className="mt-1 text-xs text-gray-500 line-clamp-1">주제: {room.topic}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isActive ? (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${activeBadgeColor(room)}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeDotColor(room)}`} />
              진행 중
            </span>
          ) : (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">종료</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${kindChipColor(room)}`}>
            {kindLabel(room)}
          </span>
          {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
            <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{room.subject_type}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">{new Date(room.created_at).toLocaleDateString("ko-KR")}</p>
      </Link>
    </div>
  );
}

// 기한 표시(ExpiryBadge)는 없앴다 — 활동은 교사가 종료할 때까지 열려 있다.

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
