"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/app/actions/auth-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type ResetPasswordClientProps = {
  initialReady: boolean;
};

export default function ResetPasswordClient({ initialReady }: ResetPasswordClientProps) {
  const router = useRouter();
  const [ready, setReady] = useState(initialReady);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (initialReady) return;

    const supabase = createSupabaseBrowserClient();

    async function hydrateRecoverySession() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description");

      if (hashError) {
        setError(hashError.replaceAll("+", " "));
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError("재설정 링크를 확인하지 못했습니다. 메일을 다시 받아주세요.");
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
        setReady(true);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError("재설정 링크를 확인하지 못했습니다. 메일을 다시 받아주세요.");
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
        setReady(true);
        return;
      }

      setError("재설정 링크가 유효하지 않거나 만료되었습니다. 메일을 다시 받아주세요.");
    }

    void hydrateRecoverySession();
  }, [initialReady]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const result = await updatePassword(new FormData(event.currentTarget));
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    setSuccess(true);
    setPending(false);
    window.setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] p-10 md:p-12">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">✨</div>
          <h1 className="text-3xl font-bold text-gray-900">새 비밀번호 설정</h1>
          <p className="text-gray-500 mt-3 leading-relaxed">
            메일 링크를 통해 들어오셨다면 새 비밀번호를 바로 설정할 수 있어요.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-700">
            비밀번호가 변경되었습니다. 잠시 후 로그인 화면으로 이동합니다.
          </div>
        ) : !ready ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-relaxed text-slate-600">
            {error || "재설정 링크를 확인하는 중입니다."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">새 비밀번호</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                placeholder="6자 이상"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">새 비밀번호 확인</label>
              <input
                name="passwordConfirm"
                type="password"
                required
                autoComplete="new-password"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                placeholder="한 번 더 입력"
              />
            </div>

            {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "변경 중..." : "비밀번호 변경하기"}
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
