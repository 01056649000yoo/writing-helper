import { notFound, redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isIntegratedLab } from "@/lib/lab-roster";
import { ensureIntegratedStudentRoomSession } from "@/lib/lab-student-session";
import { isActivityType, type ActivityType } from "@/features/activities/types";
import { RoomEntryClient } from "./room-entry-client";
import { loadOutlineBoard } from "@/lib/outline-board-server";
import { OutlineBoardClient } from "@/app/board/[token]/board-client";

export default async function RoomEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, topic, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    notFound();
  }

  const activityType: ActivityType = room.activity_type == null
    ? "outline_builder"
    : isActivityType(room.activity_type)
      ? room.activity_type
      : notFound();
  const integratedEntry = isIntegratedLab()
    ? await ensureIntegratedStudentRoomSession(roomId)
    : null;

  // 아지트에서 들어온 학생은 서버에서 곧바로 내 활동·결과로 보낸다(2026-10-11).
  // 전에는 이 화면을 먼저 그린 뒤 브라우저가 다시 이동해, 화면을 두 번 받느라 느렸다.
  if (integratedEntry?.sessionId) {
    const destination = integratedEntry.status === "done" ? "result" : "activity";
    redirect(`/room/${roomId}/${destination}?session=${integratedEntry.sessionId}`);
  }

  // 종료된 개요짜기 + 열린 친구 개요 모음: 쓰기 화면 대신 친구 개요 모음을 보여 준다(2026-10-11).
  if (integratedEntry?.peerBoardToken) {
    const initial = await loadOutlineBoard(integratedEntry.peerBoardToken).catch(() => null);
    return (
      <>
        <p className="outline-board-ended-note">
          이 활동은 끝났어요. 선생님이 열어 둔 동안 친구들의 개요를 볼 수 있어요.
        </p>
        <OutlineBoardClient token={integratedEntry.peerBoardToken} initial={initial} loadedAt={new Date().toISOString()} />
      </>
    );
  }

  return (
    <RoomEntryClient
      roomId={roomId}
      activityType={activityType}
      topic={room.topic ?? ""}
      integratedEntry={integratedEntry}
    />
  );
}
