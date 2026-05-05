"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-3xl font-bold text-gray-800">아지트 글쓰기 연구소</h1>
          <p className="text-base text-gray-500 mt-2">교사 로그인</p>
        </div>
        <form action={formAction} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이메일</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="teacher@school.kr" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">비밀번호</label>
            <input name="password" type="password" required autoComplete="current-password"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="비밀번호 입력" />
          </div>
          {state?.error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full py-4 bg-indigo-500 text-white rounded-xl font-semibold text-base hover:bg-indigo-600 disabled:opacity-50 transition-colors">
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="text-center text-base text-gray-500 mt-7">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-indigo-500 font-medium hover:underline">회원가입</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-4">
          build check: writing-helper ed815d0
        </p>
      </div>
    </div>
  );
}
