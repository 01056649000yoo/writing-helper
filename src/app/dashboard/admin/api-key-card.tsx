"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { saveGptApiKey, testApiKey } from "@/app/actions/settings-actions";

export function AdminApiKeyCard({
  hasKey,
  adminEmail,
}: {
  hasKey: boolean;
  adminEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string; success?: boolean } | null, formData: FormData) => saveGptApiKey(formData),
    null,
  );
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isTesting, startTransition] = useTransition();

  const statusText = useMemo(() => {
    if (state?.success) return "공용 OpenAI API 키가 저장되었습니다.";
    if (hasKey) return "현재 공용 OpenAI API 키가 등록되어 있습니다.";
    return "아직 공용 OpenAI API 키가 등록되지 않았습니다.";
  }, [hasKey, state?.success]);

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testApiKey();
      setTestResult(result);
    });
  }

  return (
    <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)] xl:items-start">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">Shared OpenAI</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">공용 API 키</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                관리자 이메일 한 계정만 공용 OpenAI API 키를 관리합니다. 나머지 사용자는 이 키를 그대로 사용합니다.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${hasKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {hasKey ? "등록됨" : "미등록"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <p className="font-semibold">관리자 이메일</p>
              <p className="mt-1 break-all">{adminEmail ?? "첫 저장 시 현재 계정이 관리자 이메일로 고정됩니다."}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">현재 상태</p>
              <p className="mt-1">{statusText}</p>
            </div>
          </div>

          {(state?.error || state?.success || testResult) && (
            <div className="mt-4 space-y-3">
              {state?.error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {state.error}
                </div>
              )}

              {state?.success && (
                <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                  공용 API 키가 저장되었습니다.
                </div>
              )}

              {testResult && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${testResult.ok ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-600"}`}>
                  {testResult.ok ? "공용 API 키 테스트에 성공했습니다." : testResult.error ?? "API 키 테스트에 실패했습니다."}
                </div>
              )}
            </div>
          )}
        </div>

        <form action={formAction} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">OpenAI API 키</label>
            <input
              name="api_key"
              type="password"
              required
              autoComplete="off"
              placeholder="sk-로 시작하는 API 키를 입력하세요"
              className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="mt-2 text-xs text-gray-400">
              저장된 키는 서비스 전체 AI 기능에서 공용으로 사용됩니다.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-2xl bg-indigo-600 px-5 py-4 text-base font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "저장 중..." : "공용 API 키 저장"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-base font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            >
              {isTesting ? "테스트 중..." : "저장된 키 테스트"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
