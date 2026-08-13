import { redirect } from "next/navigation";
import { getServiceAdminDashboardData } from "@/app/actions/admin-actions";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default async function ServiceAdminDashboardPage() {
  const result = await getServiceAdminDashboardData();
  if (result.error || !result.data) {
    redirect("/dashboard");
  }

  const { data } = result;

  return (
    <main className="lab-page">
      <div className="lab-page__content">
        <div className="flex items-center justify-between gap-4">
          <span />
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            관리자 전용
          </span>
        </div>

        <div className="lab-panel lab-panel--raised mt-4 px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-500">Service Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">서비스 관리자 대시보드</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            가입 교사 현황과 기본 서비스 사용 통계를 확인할 수 있습니다.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="가입 교사" value={`${data.stats.teacherCount}명`} tone="indigo" />
          <StatCard label="학급 수" value={`${data.stats.classCount}개`} tone="emerald" />
          <StatCard label="활동 방" value={`${data.stats.roomCount}개`} tone="amber" />
          <StatCard label="활성 방" value={`${data.stats.activeRoomCount}개`} tone="rose" />
          <StatCard label="학생 세션" value={`${data.stats.studentSessionCount}개`} tone="sky" />
          <StatCard label="완료 제출" value={`${data.stats.completedSessionCount}개`} tone="violet" />
        </div>

        <div className="mt-6">
          <AdminDashboardClient initialUsers={data.users} auditLogs={data.auditLogs} />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
  }[tone];

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
