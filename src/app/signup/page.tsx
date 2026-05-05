"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/app/actions/auth-actions";

export default function SignupPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await signUp(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setPending(false); }
    else if (result?.success) { setSentEmail(result.email ?? ""); }
  }

  if (sentEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg text-center">
          <div className="text-6xl mb-5">📧</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">이메일을 확인해주세요</h1>
          <p className="text-base text-gray-500 mb-4">
            <span className="font-medium text-indigo-600">{sentEmail}</span>으로<br />
            인증 링크를 보냈어요.
          </p>
          <p className="text-base text-gray-400 mb-7">
            메일함을 확인하고 링크를 클릭하면<br />로그인할 수 있어요.
          </p>
          <Link href="/login"
            className="inline-block w-full py-4 bg-indigo-500 text-white rounded-xl font-semibold text-base hover:bg-indigo-600 transition-colors">
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-3xl font-bold text-gray-800">교사 회원가입</h1>
          <p className="text-base text-gray-500 mt-2">끄적끄적아지트 길잡이</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이름</label>
            <input name="name" type="text" required
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="홍길동 선생님" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이메일</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="teacher@school.kr" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">비밀번호</label>
            <input name="password" type="password" required autoComplete="new-password"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
