import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import os from "os";
import QRCodeSection from "./qr-section";
import LiveStudentPanel from "./live-student-panel";
import {
  getRoom,
  getRoomStudents,
  getQuestionGeneratorRoomResults,
  getQuestionVotingRoomResults,
  closeRoom,
} from "@/app/actions/room-actions";
import { getCurrentUser } from "@/app/actions/auth-actions";

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
  const sessionJoinUrl = `${protocol}://${host}/room/${id}`;
  const shortUrl = room.short_code ? `${protocol}://${host}/s/${room.short_code}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto pt-8 pb-16 space-y-6">
        <div className="flex items-center justify-between">
          <Link href={room.class_id ? `/dashboard/class/${room.class_id}` : "/dashboard"} className="text-indigo-500 text-base hover:underline">
            ← {room.class_id ? "학급으로" : "대시보드로"}
          </Link>
          {room.is_active && (
            <form action={async () => { "use server"; await closeRoom(id); }}>
              <button type="submit" className="text-base text-red-500 border border-red-200 px-5 py-2.5 rounded-xl hover:bg-red-50">
                활동 종료하기
              </button>
            </form>
          )}
        </div>

        {/* 활동 세션 정보 */}
        <div className="bg-white rounded-3xl shadow-xl p-10">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${room.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {room.is_active ? "진행 중" : "종료됨"}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-800">{room.title}</h1>
              <p className="text-base text-gray-500 mt-1">주제: {room.topic}</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
                  <span className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium">
                    {room.subject_type}
                  </span>
                )}
                {room.grade_level && String(room.grade_level) !== "null" && String(room.grade_level).trim() !== "" && (
                  <span className="text-sm bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg font-medium">
                    {gradeLabel(room.grade_level)}
                  </span>
                )}
                {room.expires_at && room.is_active && (
                  <ExpiryBadge expiresAt={room.expires_at} />
                )}
                {room.expires_at && !room.is_active && (
                  <span className="text-sm bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-medium">
                    종료됨
                  </span>
                )}
              </div>
            </div>
          </div>

          {room.is_active && <QRCodeSection roomUrl={sessionJoinUrl} shortUrl={shortUrl} />}
        </div>

        {/* 실시간 학생 현황 */}
        <LiveStudentPanel
          roomId={id}
          students={students}
          isActive={room.is_active}
          activityType={room.activity_type}
          questionResults={questionResults}
          questionVotingResults={questionVotingResults}
        />
      </div>
    </div>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diffMs = exp - now;

  if (diffMs <= 0) {
    return (
      <span className="text-sm bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium">
        ⛔ 시간 만료 (학생 접속 차단)
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
    <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${isWarning ? "bg-amber-100 text-amber-700" : "bg-teal-50 text-teal-700"}`}>
      ⏰ {label}
    </span>
  );
}

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
