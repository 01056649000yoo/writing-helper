"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type PrintCard = {
  id: string;
  word: string;
  hanja: string;
  definition: string;
  example: string;
};

const CARDS_PER_PAGE = 10;

export default function HanjaWordbookPrintClient() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job") ?? "";
  const [cards, setCards] = useState<PrintCard[]>([]);
  const [error, setError] = useState("");
  const didPrintRef = useRef(false);

  useEffect(() => {
    if (!jobId) {
      setError("인쇄 작업 정보를 찾을 수 없습니다.");
      return;
    }

    const storageKey = `hanja-wordbook-print:${jobId}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setError("인쇄할 카드 데이터가 없습니다.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setError("인쇄 데이터 형식이 올바르지 않습니다.");
        return;
      }

      const nextCards = parsed
        .filter((entry): entry is PrintCard => (
          typeof entry === "object"
          && entry !== null
          && typeof (entry as PrintCard).id === "string"
          && typeof (entry as PrintCard).word === "string"
          && typeof (entry as PrintCard).hanja === "string"
          && typeof (entry as PrintCard).definition === "string"
          && typeof (entry as PrintCard).example === "string"
        ));

      if (nextCards.length === 0) {
        setError("인쇄할 카드가 없습니다.");
        return;
      }

      setCards(nextCards);
      window.localStorage.removeItem(storageKey);
    } catch {
      setError("인쇄 데이터를 읽는 중 오류가 발생했습니다.");
    }
  }, [jobId]);

  useEffect(() => {
    if (cards.length === 0 || didPrintRef.current) return;
    didPrintRef.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 150);

    const handleAfterPrint = () => window.close();
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [cards]);

  const pages = useMemo(() => chunk(cards, CARDS_PER_PAGE), [cards]);

  if (error) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-gray-700">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-red-50 px-6 py-8 text-center">
          <h1 className="text-lg font-bold text-red-700">인쇄를 준비할 수 없어요</h1>
          <p className="mt-3 text-sm leading-relaxed text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-gray-700">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-200 bg-gray-50 px-6 py-8 text-center">
          <h1 className="text-lg font-bold text-gray-800">인쇄 준비 중</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">선택한 카드를 불러오고 있습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-white text-gray-900">
      {pages.map((pageCards, pageIndex) => (
        <section
          key={`page-${pageIndex}`}
          className={`mx-auto w-[190mm] min-h-[277mm] px-0 py-0 ${pageIndex < pages.length - 1 ? "break-after-page" : ""}`}
        >
          <header className="mb-3 border-b border-gray-300 pb-2">
            <h1 className="text-lg font-bold">한자 단어집</h1>
            <p className="mt-1 text-[11px] text-gray-500">
              선택한 카드 {cards.length}장 · 페이지당 10개 정리
            </p>
          </header>

          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-[7%] border border-gray-300 px-2 py-2 text-left text-[10px] font-bold">번호</th>
                <th className="w-[14%] border border-gray-300 px-2 py-2 text-left text-[10px] font-bold">단어</th>
                <th className="w-[13%] border border-gray-300 px-2 py-2 text-left text-[10px] font-bold">한자</th>
                <th className="w-[22%] border border-gray-300 px-2 py-2 text-left text-[10px] font-bold">뜻</th>
                <th className="border border-gray-300 px-2 py-2 text-left text-[10px] font-bold">예시 문장</th>
              </tr>
            </thead>
            <tbody>
              {pageCards.map((card, index) => (
                <tr key={card.id} className="h-[24.8mm] align-top">
                  <td className="border border-gray-300 px-2 py-2 text-[10px]">{pageIndex * CARDS_PER_PAGE + index + 1}</td>
                  <td className="border border-gray-300 px-2 py-2 text-[11px] font-bold">{card.word}</td>
                  <td className="border border-gray-300 px-2 py-2 text-[10px] font-semibold">{card.hanja}</td>
                  <td className="border border-gray-300 px-2 py-2 text-[10px] leading-[1.35]">{card.definition}</td>
                  <td className="border border-gray-300 px-2 py-2 text-[10px] leading-[1.4]">{card.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}
