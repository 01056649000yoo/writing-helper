import { redirect } from "next/navigation";
import { getTeacherProfile, signOut } from "@/app/actions/auth-actions";
import { DashboardNav, DashboardBrandLink } from "./dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getTeacherProfile();
  if (!profile) redirect("/access-denied");

  return (
    <div className="lab-shell">
      <div className="lab-shell__chrome">
        <header className="lab-shell__header">
          {/* 끄적끄적 아지트 글쓰기 연구소 브랜드 링크 (활성 학급 유지) */}
          <DashboardBrandLink />

          <div className="lab-shell__actions">
            <span className="lab-profile">{profile?.name} 선생님</span>
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
