import Link from "next/link";
import { notFound } from "next/navigation";
import { getClasses, getClassWorkspace } from "@/app/actions/class-actions";
import { isActivityType } from "@/features/activities/types";
import { DraftSessionsPanel } from "./draft-sessions-panel";
import { ClosedRoomsTabs } from "./closed-rooms-tabs";
import { ActiveRoomsTabs } from "./active-rooms-tabs";

type UnifiedRoom = { kind: "writing"; id: string; title: string; topic: string; topic_description: string; subject_type: string | null; activity_type: string | null; is_active: boolean; created_at: string };

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const integratedRoster = process.env.LAB_SSO_ENABLED === "true";
  const [workspace, classes] = await Promise.all([getClassWorkspace(id), getClasses()]);
  if (!workspace) notFound();

  // 학급이 하나뿐인 선생님에게는 `학급 목록` 으로 가는 길이 제자리걸음이다.
  // `/dashboard` 는 학급이 1개면 곧바로 그 학급으로 되돌려 보내기 때문이다(dashboard/page.tsx).
  // 즉 눌러도 화면만 깜빡이고 같은 자리로 돌아온다. 2026-09-09 기준 승인 교사 526명 중
  // 506명이 학급 1개라, 대부분에게는 아무 일도 하지 않는 버튼이었다.
  // 학급이 여럿인 선생님에게는 다른 학급으로 넘어가는 유일한 길이므로 그대로 둔다.
  const canSwitchClass = classes.length > 1;
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
        {canSwitchClass && (
          <Link href="/dashboard" className="lab-breadcrumb">← 학급 목록</Link>
        )}
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

