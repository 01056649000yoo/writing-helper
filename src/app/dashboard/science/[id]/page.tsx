import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import os from "os";
import { getCurrentUser } from "@/app/actions/auth-actions";
import {
  getScienceRoom,
  closeScienceRoom,
  getScienceRoomSessions,
  getScienceRoomReviews,
} from "@/app/actions/science-actions";
import ScienceMonitorPanel from "./monitor-panel";

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

// ── step progress bar ──────────────────────────────────────────────────────

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
      <span className="text-sm text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-8 text-right">
        {count}
      </span>
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
  const [user, room, sessions, reviews] = await Promise.all([
    getCurrentUser(),
    getScienceRoom(id),
    getScienceRoomSessions(id),
    getScienceRoomReviews(id),
  ]);

  if (!room || room.teacher_id !== user?.id) notFound();

  // join url
  const headersList = await headers();
  const rawHost = headersList.get("host") ?? "localhost:3002";
  const isLocalhost =
    rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1");
  let host = rawHost;
  if (isLocalhost) {
    const port = rawHost.split(":")[1] ?? "3002";
    const ip = getLocalNetworkIp();
    host = ip ? `${ip}:${port}` : rawHost;
  }
  const protocol = isLocalhost
    ? "http"
    : (headersList.get("x-forwarded-proto") ?? "https");
  const joinUrl = `${protocol}://${host}/science/${id}`;

  // stats
  const total = sessions.length;
  const doneCount = sessions.filter((s) => s.status === "done").length;
  const step2Count = sessions.filter(
    (s) => s.current_step >= 2 || s.status === "done",
  ).length;
  const step3Count = sessions.filter(
    (s) => s.current_step >= 3 || s.status === "done",
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-6">
      <div className="max-w-6xl mx-auto pt-8 pb-16 space-y-6">
        {/* back */}
        <Link href="/dashboard" className="text-cyan-600 text-sm hover:underline">
          ← 대시보드로
        </Link>

        {/* header card */}
        <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔬</span>
              <div>
                <p className="text-xs font-semibold text-cyan-600">
                  과학 관찰·추론 활동
                </p>
                <h1 className="text-2xl font-bold text-gray-800">{room.title}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{room.topic}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {room.is_active ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  진행 중
                </span>
              ) : (
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                  종료됨
                </span>
              )}
              {room.is_active && (
                <form
                  action={async () => {
                    "use server";
                    await closeScienceRoom(id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-1.5 rounded-full transition-colors"
                  >
                    활동 종료
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* join url */}
          {room.is_active && (
            <div className="mt-5 flex items-center gap-3 bg-cyan-50 border border-cyan-100 rounded-2xl px-4 py-3">
              <span className="text-xs font-semibold text-cyan-700">
                학생 접속 주소
              </span>
              <code className="flex-1 text-sm text-cyan-900 font-mono break-all">
                {joinUrl}
              </code>
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-cyan-700 hover:text-cyan-900 bg-white border border-cyan-200 px-3 py-1.5 rounded-xl transition"
              >
                열기 →
              </a>
            </div>
          )}
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "참여 학생", value: total, color: "text-cyan-700" },
            { label: "관찰 완료", value: step2Count, color: "text-sky-700" },
            { label: "추론 완료", value: step3Count, color: "text-violet-700" },
            { label: "전체 완료", value: doneCount, color: "text-emerald-700" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl shadow-sm border border-white/70 px-5 py-4"
            >
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>
                {s.value}
                <span className="text-base font-normal text-gray-400 ml-1">명</span>
              </p>
            </div>
          ))}
        </div>

        {/* progress bars */}
        {total > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-white/70 px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-gray-600 mb-3">
              단계별 진행 현황
            </p>
            <StepStat
              label="1단계 관찰"
              count={step2Count}
              total={total}
              color="bg-sky-400"
            />
            <StepStat
              label="2단계 추론"
              count={step3Count}
              total={total}
              color="bg-violet-400"
            />
            <StepStat
              label="3단계 질문"
              count={doneCount}
              total={total}
              color="bg-amber-400"
            />
          </div>
        )}

        {/* live panel — polls every 5 s */}
        <ScienceMonitorPanel
          roomId={id}
          isActive={room.is_active}
          initialSessions={sessions}
          initialReviews={reviews}
        />
      </div>
    </div>
  );
}
