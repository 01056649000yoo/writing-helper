import Link from "next/link";
import { getApiKeyAccessInfo } from "@/app/actions/settings-actions";
import { ApiKeyForm } from "./api-key-form";

export default async function ApiKeyPage() {
  const access = await getApiKeyAccessInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto pt-8 pb-16">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-indigo-500 text-base hover:underline">← 대시보드로</Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            질문 카드 설정으로 이동
          </Link>
        </div>

        <ApiKeyForm hasKey={access.hasKey} isAdmin={access.isAdmin} adminEmail={access.adminEmail} />
      </div>
    </div>
  );
}
