import { getActivityTeacherDetail } from "@/features/activities/teacher-detail/registry";
import type { ActivityType } from "@/features/activities/types";

/**
 * 활동 세션 화면의 껍데기 — 왼쪽 `활동 내용`, 오른쪽 `참여 현황`.
 *
 * 활동마다 다른 것은 **왼쪽 하나뿐**이고 오른쪽·머리말·종료 버튼은 모든 활동이 공유한다.
 * 새 활동을 추가할 때는 `teacher-detail/registry.ts` 에 컴포넌트만 등록하면
 * 이 구성이 그대로 따라온다.
 *
 * 전에는 머리말이 화면 위쪽을 통째로 차지하고(활동 종류·학년 칩, 매번 같은 참여 안내)
 * 정작 **활동의 세부 내용은 어디에도 없었으며** 참여 현황은 스크롤을 내려야 나왔다.
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
      <header className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">{statusSlot}{chipsSlot}</div>
        <h1 className="mt-2 text-2xl font-bold text-gray-800">{room.title}</h1>
        {room.topic && <p className="mt-0.5 text-sm text-gray-500">주제: {room.topic}</p>}
      </header>

      {/* 왼쪽이 더 좁다. 참여 현황이 수업 중 계속 보는 쪽이라 넓게 준다. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-start">
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500">활동 내용</h2>
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
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-400">이 활동은 아직 내용 화면이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-500">참여 현황</h2>
          {participationSlot}
        </div>
      </div>
    </>
  );
}
