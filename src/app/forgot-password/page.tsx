"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/app/actions/auth-actions";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sentEmail, setSentEmail] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const result = await requestPasswordReset(new FormData(event.currentTarget));
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setSentEmail(result?.email ?? "");
    setPending(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] p-10 md:p-12">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-900">비밀번호 재설정</h1>
          <p className="text-gray-500 mt-3 leading-relaxed">
            가입한 이메일로 재설정 링크를 보내드릴게요.
          </p>
        </div>

        {sentEmail ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-700">
              <strong className="font-semibold">{sentEmail}</strong> 으로 비밀번호 재설정 메일을 보냈습니다.
              메일을 열어 새 비밀번호를 설정해주세요.
            </div>
            <Link
              href="/login"
              className="block w-full rounded-2xl bg-indigo-600 px-6 py-4 text-center text-base font-bold text-white transition-colors hover:bg-indigo-700"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">이메일</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                placeholder="teacher@school.kr"
              />
            </div>

            {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "메일 보내는 중..." : "재설정 메일 보내기"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-gray-500">
          <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
            로그인 화면으로
          </Link>
        </p>
      </div>
    </div>
  );
}
