import Link from "next/link";
import { getTeacherProfile } from "@/app/actions/auth-actions";
import { checkHasApiKey } from "@/app/actions/settings-actions";
import { getClasses } from "@/app/actions/class-actions";
import { signOut } from "@/app/actions/auth-actions";
import { ManualModal } from "./manual-modal";

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
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ManualModal />
            <Link
              href="/dashboard/settings"
              className="text-base px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              🃏 질문 카드 설정
            </Link>
            <Link href="/dashboard/settings"
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
            <Link href="/dashboard/settings"
              className="bg-amber-500 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-amber-600">
              키 등록하기
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">내 학급 목록</h2>
          <Link href="/dashboard/class/new"
            className="px-6 py-3 rounded-xl font-semibold text-base bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">
            + 새 학급 만들기
          </Link>
        </div>

        {classes.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-sm">
            <div className="text-6xl mb-5">🏫</div>
            <p className="text-xl text-gray-500 font-medium">아직 만든 학급이 없습니다.</p>
            <p className="text-base text-gray-400 mt-2">학급을 만들고 학생 명단을 등록하면 바로 활동을 시작할 수 있어요.</p>
            <Link href="/dashboard/class/new"
              className="inline-block mt-6 px-8 py-3.5 bg-indigo-500 text-white rounded-xl text-base font-semibold hover:bg-indigo-600 transition-colors">
              첫 학급 만들기
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map(cls => (
              <Link key={cls.id} href={`/dashboard/class/${cls.id}`}
                className="bg-white rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-indigo-100">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">🏫</span>
                  <span className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium">{cls.grade_level}</span>
                </div>
                <h3 className="font-bold text-gray-800 text-xl">{cls.name}</h3>
                <p className="text-sm text-gray-400 mt-3">
                  {new Date(cls.created_at).toLocaleDateString("ko-KR")} 개설
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
