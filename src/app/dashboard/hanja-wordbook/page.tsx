import Link from "next/link";
import { getTeacherHanjaWordCards } from "@/app/actions/room-actions";
import { HanjaWordbookClient } from "./wordbook-client";

export default async function HanjaWordbookPage() {
  const result = await getTeacherHanjaWordCards();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <div className="print:hidden">
          <Link href="/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-amber-100 bg-white px-6 py-6 shadow-sm print:mt-0 print:border-none print:shadow-none md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Hanja Wordbook</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">한자 단어집</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              저장해 둔 한자 카드를 모아 보고, 필요한 카드만 골라 인쇄하거나 PDF로 정리할 수 있어요.
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {result.cards?.length ?? 0}장 저장됨
          </div>
        </div>

        <div className="mt-6">
          <HanjaWordbookClient initialCards={result.cards ?? []} initialError={result.error ?? ""} />
        </div>
      </div>
    </div>
  );
}
