import Link from "next/link";
import { getTeacherProfile } from "@/app/actions/auth-actions";
import { checkHasApiKey } from "@/app/actions/settings-actions";
import { getClasses } from "@/app/actions/class-actions";
import { signOut } from "@/app/actions/auth-actions";
import { BUILD_LABEL } from "@/lib/build-version";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardPage() {
  const [profile, classes, hasKey] = await Promise.all([
    getTeacherProfile(),
    getClasses(),
    checkHasApiKey(),
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
              href="/dashboard/settings"
              className="text-base px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              🃏 질문 카드 설정
            </Link>
            <Link href="/dashboard/api-key"
              className={`text-base px-5 py-2.5 rounded-xl border transition-colors ${hasKey ? "border-green-200 text-green-700 bg-green-50" : "border-red-200 text-red-700 bg-red-50"}`}>
              {hasKey ? "✅ API 키 설정됨" : "⚠️ API 키 설정 필요"}
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-base text-gray-500 hover:text-gray-700 px-4 py-2.5">로그아웃</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-8">
        {!hasKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-amber-800">⚠️ GPT API 키가 필요합니다</p>
              <p className="text-base text-amber-600 mt-1">AI 기반 활동을 열려면 먼저 OpenAI API 키를 등록해주세요.</p>
            </div>
            <Link href="/dashboard/api-key"
              className="bg-amber-500 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-amber-600">
              키 등록하기
            </Link>
          </div>
        )}

        <DashboardTabs classes={classes} />
      </main>
    </div>
  );
}
