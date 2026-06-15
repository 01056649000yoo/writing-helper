"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { saveGptApiKey, testApiKey } from "@/app/actions/settings-actions";

type ApiKeyFormProps = {
  hasKey: boolean;
  isAdmin: boolean;
  adminEmail: string | null;
};

export function ApiKeyForm({ hasKey, isAdmin, adminEmail }: ApiKeyFormProps) {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string; success?: boolean } | null, formData: FormData) => saveGptApiKey(formData),
    null
  );
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isTesting, startTransition] = useTransition();

  const statusText = useMemo(() => {
    if (state?.success) return "API 키가 저장되었습니다.";
    if (hasKey) return "현재 OpenAI API 키가 등록되어 있습니다.";
    return "아직 OpenAI API 키가 등록되지 않았습니다.";
  }, [hasKey, state?.success]);

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testApiKey();
      setTestResult(result);
    });
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-gray-800">API 키 설정</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            이 페이지는 서비스 전체에서 쓰는 공용 OpenAI API 키 상태를 보여줍니다.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${hasKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {hasKey ? "등록됨" : "미등록"}
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <p className="text-sm font-semibold text-indigo-700">현재 상태</p>
        <p className="mt-1 text-sm text-indigo-900">{statusText}</p>
        <p className="mt-2 text-xs text-indigo-700">
          관리자 이메일: {adminEmail ?? "아직 지정되지 않음"}
        </p>
      </div>

      {isAdmin ? (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API 키</label>
            <input
              name="api_key"
              type="password"
              required
              autoComplete="off"
              placeholder="sk-로 시작하는 API 키를 입력하세요"
              className="w-full rounded-2xl border border-gray-200 px-5 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="mt-2 text-xs text-gray-400">
              키는 안전하게 저장되며, 서비스 전체의 AI 기능에서 공용으로 사용됩니다.
            </p>
          </div>

          {state?.error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
              API 키가 저장되었습니다.
            </div>
          )}

          {testResult && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${testResult.ok ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-600"}`}>
              {testResult.ok ? "API 키 테스트에 성공했습니다." : testResult.error ?? "API 키 테스트에 실패했습니다."}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-2xl bg-indigo-600 px-5 py-4 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "저장 중..." : "API 키 저장"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-base font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {isTesting ? "테스트 중..." : "저장된 키 테스트"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          공용 API 키는 서비스 관리자만 변경할 수 있습니다. 관리자 계정에서 <code className="rounded bg-white px-1.5 py-0.5 text-xs">/dashboard/admin</code> 페이지를 사용해 주세요.
        </div>
      )}
    </div>
  );
}
