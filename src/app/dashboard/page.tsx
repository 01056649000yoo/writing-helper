import Link from "next/link";
import { getTeacherProfile } from "@/app/actions/auth-actions";
import { isCurrentUserServiceAdmin } from "@/app/actions/admin-actions";
import { getClasses } from "@/app/actions/class-actions";
import { signOut } from "@/app/actions/auth-actions";
import { BUILD_LABEL } from "@/lib/build-version";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardPage() {
  const [profile, classes, isServiceAdmin] = await Promise.all([
    getTeacherProfile(),
    getClasses(),
    isCurrentUserServiceAdmin(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl">✏️</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">아지트 글쓰기 연구소</h1>
              <p className="text-base text-gray-500">{profile?.name} 선생님</p>
              <p className="text-xs text-gray-400 mt-0.5">{BUILD_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/hanja-wordbook"
              className="text-base px-5 py-2.5 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              📚 한자 단어집
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-base px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              🃏 질문 카드 설정
            </Link>
            {isServiceAdmin && (
              <Link
                href="/dashboard/admin"
                className="text-base px-5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                🛠️ 관리자
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="text-base text-gray-500 hover:text-gray-700 px-4 py-2.5">로그아웃</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-8">
        <DashboardTabs classes={classes} />
      </main>
    </div>
  );
}
