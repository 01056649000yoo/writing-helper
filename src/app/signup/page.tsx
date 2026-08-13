"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/app/actions/auth-actions";

const signupEnabled = process.env.NEXT_PUBLIC_LAB_SIGNUP_ENABLED !== "false";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!signupEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg text-center">
          <div className="text-6xl mb-4">🧪</div>
          <h1 className="text-2xl font-bold text-gray-800">통합 연구소 계정 안내</h1>
          <p className="mt-4 text-base leading-relaxed text-gray-500">
            별도 회원가입은 받지 않습니다. 끄적끄적 아지트에서 승인된 교사 계정으로 로그인해주세요.
          </p>
          <Link href="/login" className="mt-7 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await signUp(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-3xl font-bold text-gray-800">교사 회원가입</h1>
          <p className="text-base text-gray-500 mt-2">아지트 글쓰기 연구소</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이름</label>
            <input name="name" type="text" required
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="홍길동 선생님" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">학교 이름</label>
            <input name="schoolName" type="text" required
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="아지트초등학교" />
            <p className="mt-2 text-sm text-gray-400">학교 이름은 2자 이상 60자 이하로 입력해주세요.</p>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이메일</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="teacher@school.kr" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">비밀번호</label>
            <input name="password" type="password" required autoComplete="new-password"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="6자 이상" />
          </div>
          {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}
          <button type="submit" disabled={pending}
            className="w-full py-4 bg-indigo-500 text-white rounded-xl font-semibold text-base hover:bg-indigo-600 disabled:opacity-50 transition-colors">
            {pending ? "가입 중..." : "회원가입"}
          </button>
        </form>
        <p className="text-center text-base text-gray-500 mt-7">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-indigo-500 font-medium hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  );
}
