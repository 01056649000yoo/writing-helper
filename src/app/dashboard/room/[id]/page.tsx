import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import os from "os";
import QRCodeSection from "./qr-section";
import { RoomWorkspace } from "./room-workspace";
import LiveStudentPanel from "./live-student-panel";
import {
  getHanjaWritingRoomResults,
  getRoom,
  getRoomStudents,
  getOneLineShareRoomResults,
  getQuestionGeneratorRoomResults,
  getQuestionVotingRoomResults,
  closeRoom,
} from "@/app/actions/room-actions";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { withBasePath } from "@/lib/app-path";
import { isIntegratedLab } from "@/lib/lab-roster";

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [room, students, user] = await Promise.all([
    getRoom(id),
    getRoomStudents(id),
    getCurrentUser(),
  ]);

  if (!room || room.teacher_id !== user?.id) notFound();

  const questionResults = room.activity_type === "question_generator"
    ? await getQuestionGeneratorRoomResults(id)
    : [];
  const questionVotingResults = room.activity_type === "question_voting"
    ? await getQuestionVotingRoomResults(id)
    : [];
  const oneLineShareResults = room.activity_type === "one_line_share"
    ? await getOneLineShareRoomResults(id)
    : [];
  const hanjaWritingResults = room.activity_type === "hanja_writing"
    ? await getHanjaWritingRoomResults(id)
    : [];
  const integratedLab = isIntegratedLab();
  let sessionJoinUrl = "";
  let shortUrl: string | null = null;

  if (!integratedLab) {
    const headersList = await headers();
    const rawHost = headersList.get("host") ?? "localhost:3002";
    const forwardedProto = headersList.get("x-forwarded-proto");
    const isLocalhost = rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1");
    let host = rawHost;
    if (isLocalhost) {
      const port = rawHost.split(":")[1] ?? "3002";
      const networkIp = getLocalNetworkIp();
      host = networkIp ? `${networkIp}:${port}` : rawHost;
    }
    const protocol = isLocalhost ? "http" : forwardedProto || "https";
    sessionJoinUrl = `${protocol}://${host}${withBasePath(`/room/${id}`)}`;
    shortUrl = room.short_code ? `${protocol}://${host}${withBasePath(`/s/${room.short_code}`)}` : null;
  }
  const dashboardClassId = room.agit_class_id ?? room.class_id;

  return (
    <main className="lab-page">
      <div className="lab-page__content space-y-4">
        <div className="flex items-center justify-between">
          <Link href={dashboardClassId ? `/dashboard/class/${dashboardClassId}` : "/dashboard"} className="lab-breadcrumb mb-0">
            ← {dashboardClassId ? "학급으로" : "대시보드로"}
          </Link>
          {room.is_active && (
            <form action={async () => { "use server"; await closeRoom(id); }}>
              <button type="submit" className="lab-button lab-button--danger">
                활동 종료하기
              </button>
            </form>
          )}
        </div>

        <RoomWorkspace
          room={{
            id,
            title: room.title,
            topic: room.topic,
            topicDescription: room.topic_description ?? "",
            subjectType: room.subject_type ?? null,
            gradeLevel: room.grade_level ?? null,
            activityType: room.activity_type ?? null,
            activityConfig: room.activity_config,
          }}
          statusSlot={
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${room.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {room.is_active ? "진행 중" : "종료됨"}
            </span>
          }
          chipsSlot={
            <>
              {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">
                  {room.subject_type}
                </span>
              )}
              {room.grade_level && String(room.grade_level) !== "null" && String(room.grade_level).trim() !== "" && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full font-medium">
                  {gradeLabel(room.grade_level)}
                </span>
              )}
            </>
          }
          participationSlot={
            <>
              {/* 통합 모드에서는 학생이 아지트에서 바로 들어오므로 입장 QR 이 필요 없다.
                  독립 실행판에서만 QR 을 참여 현황 위에 둔다. */}
              {!integratedLab && room.is_active && (
                <QRCodeSection roomUrl={sessionJoinUrl} shortUrl={shortUrl} />
              )}
              <LiveStudentPanel
                roomId={id}
                students={students}
                isActive={room.is_active}
                activityType={room.activity_type}
                questionResults={questionResults}
                questionVotingResults={questionVotingResults}
                oneLineShareResults={oneLineShareResults}
                hanjaWritingResults={hanjaWritingResults}
                showResultQr={!integratedLab}
              />
            </>
          }
        />
      </div>
    </main>
  );
}

// 기한 표시(ExpiryBadge)는 없앴다 — 활동은 교사가 종료할 때까지 열려 있다.


function getLocalNetworkIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal && info.address.startsWith("192.168.")) {
        return info.address;
      }
    }
  }
  return null;
}

function gradeLabel(grade: string) {
  const map: Record<string, string> = {
    "저학년": "🌱 저학년 (1~2학년)",
    "중학년": "🌿 중학년 (3~4학년)",
    "고학년": "🌳 고학년 (5~6학년)",
  };
  return map[grade] ?? grade;
}
