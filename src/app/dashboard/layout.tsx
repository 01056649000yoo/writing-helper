import Link from "next/link";
import { redirect } from "next/navigation";
import { getTeacherProfile, signOut } from "@/app/actions/auth-actions";
import { DashboardNav } from "./dashboard-nav";

const AGIT_HOME_URL = process.env.NEXT_PUBLIC_AGIT_APP_URL
  ?? "https://xn--vz0ba242ncqcba79xhwx.site";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getTeacherProfile();
  if (!profile) redirect("/access-denied");

  return (
    <div className="lab-shell">
      <div className="lab-shell__chrome">
        <header className="lab-shell__header">
          <Link href="/dashboard" className="lab-brand" aria-label="글쓰기 연구소 대시보드">
            <span className="lab-brand__mark" aria-hidden="true">✏️</span>
            <span>
              <span className="lab-brand__eyebrow">끄적끄적 아지트</span>
              <span className="lab-brand__title">글쓰기 연구소</span>
            </span>
          </Link>

          <div className="lab-shell__actions">
            <span className="lab-profile">{profile?.name} 선생님</span>
            <a className="lab-button" href={AGIT_HOME_URL}>아지트로 돌아가기</a>
            <form action={signOut}>
              <button type="submit" className="lab-button lab-button--quiet">로그아웃</button>
            </form>
          </div>
        </header>
        <div className="lab-shell__nav-wrap">
          <DashboardNav />
        </div>
      </div>
      {children}
    </div>
  );
}
