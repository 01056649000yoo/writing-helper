import type { ServiceAuditLogSummary, ServiceAdminUserSummary } from "@/app/actions/admin-actions";

export function AdminDashboardClient({
  initialUsers,
  auditLogs,
}: {
  initialUsers: ServiceAdminUserSummary[];
  auditLogs: ServiceAuditLogSummary[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">가입 교사 목록</h2>
            <p className="mt-1 text-sm text-gray-500">교사별 학급과 활동 방 수를 확인합니다.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {initialUsers.length}명
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-3 py-3 font-semibold">이름</th>
                <th className="px-3 py-3 font-semibold">이메일</th>
                <th className="px-3 py-3 font-semibold">가입일</th>
                <th className="px-3 py-3 font-semibold">학급</th>
                <th className="px-3 py-3 font-semibold">활동</th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-3 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-3 py-3 text-gray-600">{user.email || "-"}</td>
                  <td className="px-3 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="px-3 py-3 text-gray-700">{user.classCount}</td>
                  <td className="px-3 py-3 text-gray-700">{user.roomCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">최근 감사 로그</h2>
          <p className="mt-1 text-sm text-gray-500">관리자 설정 변경과 점검 작업을 최근 순서대로 보여줍니다.</p>
        </div>

        <div className="mt-5 space-y-3">
          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              아직 기록된 감사 로그가 없습니다.
            </div>
          ) : auditLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString("ko-KR")}</p>
              </div>
              <p className="mt-1 text-xs text-gray-500">실행: {log.actorEmail} / 대상: {log.targetEmail}</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 break-all">{log.metadata}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
