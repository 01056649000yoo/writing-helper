import { Suspense } from "react";
import HanjaWordbookPrintClient from "./print-client";

export default function HanjaWordbookPrintPage() {
  return (
    <Suspense fallback={<PrintLoadingFallback />}>
      <HanjaWordbookPrintClient />
    </Suspense>
  );
}

function PrintLoadingFallback() {
  return (
    <main className="min-h-screen bg-white px-6 py-10 text-gray-700">
      <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-gray-50 px-6 py-8 text-center">
        <h1 className="text-lg font-bold text-gray-800">인쇄 준비 중</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">선택한 카드를 불러오고 있습니다.</p>
      </div>
    </main>
  );
}
