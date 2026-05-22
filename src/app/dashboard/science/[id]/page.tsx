import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import os from "os";
import { getCurrentUser } from "@/app/actions/auth-actions";
import {
  getScienceRoom,
  getScienceRoomStudents,
  closeScienceRoom,
  getScienceRoomSessions,
  getScienceRoomReviews,
} from "@/app/actions/science-actions";
import { SKILL_META, TRACK_META } from "@/types/science";
import ScienceMonitorPanel from "./monitor-panel";
import QRCodeSection from "@/app/dashboard/room/[id]/qr-section";

// ── helpers ────────────────────────────────────────────────────────────────

function getLocalNetworkIp(): string | null {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

function StepStat({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-8 text-right">{count}</span>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default async function ScienceRoomDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, room, sessions, reviews, students] = await Promise.all([
    getCurrentUser(),
    getScienceRoom(id),
    getScienceRoomSessions(id),
    getScienceRoomReviews(id),
    getScienceRoomStudents(id),
  ]);

  if (!room || room.teacher_id !== user?.id) notFound();

  // join url
  const headersList = await headers();
  const rawHost = headersList.get("host") ?? "localhost:3002";
  const isLocalhost = rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1");
  let host = rawHost;
  if (isLocalhost) {
    const port = rawHost.split(":")[1] ?? "3002";
    const ip = getLocalNetworkIp();
    host = ip ? `${ip}:${port}` : rawHost;
  }
  const protocol = isLocalhost ? "http" : (headersList.get("x-forwarded-proto") ?? "https");
  const joinUrl = `${protocol}://${host}/science/${id}`;

  const total = sessions.length;
  const doneCount = sessions.filter((s) => s.status === "done").length;

  const isNewTrack = Boolean(room.inquiryTrack && room.enabledSkills.length > 0);

  // 진행 통계 — 신규/legacy 분기
  const trackMeta = room.inquiryTrack ? TRACK_META[room.inquiryTrack] : null;
  const skillProgress = isNewTrack
    ? room.enabledSkills.map((skill) => ({
        skill,
        count: sessions.filter((s) => s.completedSkills.includes(skill)).length,
      }))
    : [];
  const legacyStep2 = sessions.filter((s) => s.current_step >= 2 || s.status === "done").length;
  const legacyStep3 = sessions.filter((s) => s.current_step >= 3 || s.status === "done").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-6">
      <div className="max-w-6xl mx-auto pt-8 pb-16 space-y-6">
        <Link
          href={room.class_id ? `/dashboard/class/${room.class_id}` : "/dashboard"}
          className="text-cyan-600 text-sm hover:underline"
        >
          ← {room.class_id ? "학급으로" : "대시보드로"}
        </Link>

        <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔬</span>
              <div>
                <p className="text-xs font-semibold text-cyan-600">
                  {trackMeta ? `${trackMeta.emoji} ${trackMeta.label} · ${trackMeta.gradeBand}` : "과학 관찰·추론 활동"}
                </p>
                <h1 className="text-2xl font-bold text-gray-800">{room.title}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{room.topic}</p>
                {isNewTrack && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {room.enabledSkills.map((skill, i) => (
                      <span key={skill} className="text-[11px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">
                        {i + 1}. {SKILL_META[skill].emoji} {SKILL_META[skill].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {room.is_active ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  진행 중
                </span>
              ) : (
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">종료됨</span>
              )}
              {room.is_active && (
                <form action={async () => { "use server"; await closeScienceRoom(id); }}>
                  <button type="submit" className="text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-1.5 rounded-full transition-colors">
                    활동 종료
                  </button>
                </form>
              )}
            </div>
          </div>

          {room.is_active && <QRCodeSection roomUrl={joinUrl} />}
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-white/70 px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">참여 학생</p>
            <p className="text-3xl font-bold text-cyan-700">{total}<span className="text-base font-normal text-gray-400 ml-1">명</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-white/70 px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">전체 완료</p>
            <p className="text-3xl font-bold text-emerald-700">{doneCount}<span className="text-base font-normal text-gray-400 ml-1">명</span></p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-white/70 px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">진행 중</p>
            <p className="text-3xl font-bold text-amber-700">{total - doneCount}<span className="text-base font-normal text-gray-400 ml-1">명</span></p>
          </div>
        </div>

        {total > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-white/70 px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-gray-600 mb-3">단계별 진행 현황</p>
            {isNewTrack ? (
              skillProgress.map(({ skill, count }) => (
                <StepStat
                  key={skill}
                  label={`${SKILL_META[skill].emoji} ${SKILL_META[skill].label}`}
                  count={count}
                  total={total}
                  color="bg-cyan-400"
                />
              ))
            ) : (
              <>
                <StepStat label="1단계 관찰" count={legacyStep2} total={total} color="bg-sky-400" />
                <StepStat label="2단계 추론" count={legacyStep3} total={total} color="bg-violet-400" />
                <StepStat label="3단계 질문" count={doneCount} total={total} color="bg-amber-400" />
              </>
            )}
          </div>
        )}

        <ScienceMonitorPanel
          roomId={id}
          isActive={room.is_active}
          inquiryTrack={room.inquiryTrack}
          enabledSkills={room.enabledSkills}
          students={students}
          initialSessions={sessions}
          initialReviews={reviews}
        />
      </div>
    </div>
  );
}
