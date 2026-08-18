import { getActivityTeacherDetail } from "@/features/activities/teacher-detail/registry";
import type { ActivityType } from "@/features/activities/types";

/**
 * 활동 세션 화면의 껍데기 — 왼쪽 `활동 내용`, 오른쪽 `참여 현황`.
 * 화면을 아래로 스크롤하지 않고도 20명 학생 현황과 활동 내용을 한눈에 볼 수 있도록 상단 여백을 컴팩트하게 최적화.
 */
export function RoomWorkspace({
  room,
  statusSlot,
  chipsSlot,
  participationSlot,
}: {
  room: {
    id: string;
    title: string;
    topic: string;
    topicDescription: string;
    subjectType: string | null;
    gradeLevel: string | null;
    activityType: string | null;
    activityConfig: unknown;
  };
  statusSlot: React.ReactNode;
  chipsSlot: React.ReactNode;
  participationSlot: React.ReactNode;
}) {
  const renderDetail = getActivityTeacherDetail(room.activityType);

  return (
    <>
      {/* 슬림 컴팩트 헤더 */}
      <header className="rounded-2xl border border-gray-200/90 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {statusSlot}
              {chipsSlot}
            </div>
            <h1 className="text-base sm:text-lg font-black text-gray-800 truncate">{room.title}</h1>
            {room.topic && (
              <span className="text-xs text-gray-500 font-medium truncate hidden sm:inline">
                주제: {room.topic}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 좌우 2단 분할 레이아웃 (좌측 내용, 우측 20명 학생 현황) */}
      <div className="mt-3 grid gap-3.5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] items-start">
        {/* 좌측: 활동 내용 */}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">📋 활동 내용</h2>
          </div>
          {renderDetail ? (
            renderDetail({
              activityType: room.activityType as ActivityType,
              config: room.activityConfig,
              room: {
                id: room.id,
                title: room.title,
                topic: room.topic,
                topicDescription: room.topicDescription,
                subjectType: room.subjectType,
                gradeLevel: room.gradeLevel,
              },
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400">이 활동은 아직 내용 화면이 없습니다.</p>
            </div>
          )}
        </div>

        {/* 우측: 참여 현황 */}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">👥 학생 활동 현황</h2>
          </div>
          {participationSlot}
        </div>
      </div>
    </>
  );
}
