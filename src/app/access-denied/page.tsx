const AGIT_HOME_URL = process.env.NEXT_PUBLIC_AGIT_APP_URL
  ?? "https://xn--vz0ba242ncqcba79xhwx.site";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="text-5xl" aria-hidden="true">🔒</span>
        <p className="mt-5 text-sm font-bold text-blue-600">글쓰기 연구소</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">승인된 교사만 이용할 수 있어요</h1>
        <p className="mt-4 leading-7 text-slate-600">
          끄적끄적 아지트의 교사 승인 상태를 확인해 주세요. 학생 계정이나 승인 대기 계정으로는 연구소에 들어갈 수 없습니다.
        </p>
        <a
          href={AGIT_HOME_URL}
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 font-bold text-white transition-colors hover:bg-blue-700"
        >
          아지트로 돌아가기
        </a>
      </section>
    </main>
  );
}
