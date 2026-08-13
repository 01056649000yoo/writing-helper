const AGIT_HOME_URL = (process.env.NEXT_PUBLIC_AGIT_APP_URL
  ?? "https://xn--vz0ba242ncqcba79xhwx.site").replace(/\/+$/, "");
const AGIT_LAB_ACTIVITIES_URL = `${AGIT_HOME_URL}/?studentPage=lab_activities`;
const INTEGRATED_LAB = process.env.NEXT_PUBLIC_LAB_SSO_ENABLED === "true";

/** 통합 연구소의 모든 학생 활동 화면에서 빠지지 않는 공통 복귀 동선 */
export function StudentLabNavigation() {
  if (!INTEGRATED_LAB) return null;

  return (
    <nav
      aria-label="학생 활동 이동"
      className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-2 sm:flex sm:justify-end">
        <a
          href={AGIT_HOME_URL}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span aria-hidden="true">🏠</span>
          <span className="ml-1.5">홈으로 이동하기</span>
        </a>
        <a
          href={AGIT_LAB_ACTIVITIES_URL}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-3 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-violet-700"
        >
          <span aria-hidden="true">🧪</span>
          <span className="ml-1.5">글쓰기 연구소 페이지</span>
        </a>
      </div>
    </nav>
  );
}
