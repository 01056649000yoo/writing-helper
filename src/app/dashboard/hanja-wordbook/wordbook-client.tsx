"use client";

import { useMemo, useState } from "react";
import { deleteTeacherHanjaWordCard, type SavedHanjaWordCard } from "@/app/actions/room-actions";

type GradeFilter = "all" | "3" | "4" | "5" | "6";
type PageSize = 12 | 24 | 48;

export function HanjaWordbookClient({
  initialCards,
  initialError,
}: {
  initialCards: SavedHanjaWordCard[];
  initialError: string;
}) {
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...cards]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter((card) => {
        if (gradeFilter !== "all" && String(card.grade) !== gradeFilter) return false;
        if (!normalizedQuery) return true;
        return [
          card.word,
          card.definition,
          card.category,
          card.example,
          ...card.hanja.map((entry) => `${entry.char} ${entry.meaning} ${entry.reading}`),
          ...card.relatedWords.map((entry) => `${entry.word} ${entry.hanja} ${entry.meaning}`),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [cards, gradeFilter, query]);

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedIds.includes(card.id)),
    [cards, selectedIds],
  );

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleCards = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredCards.slice(startIndex, startIndex + pageSize);
  }, [filteredCards, pageSize, safeCurrentPage]);

  function toggleSelection(cardId: string) {
    setSelectedIds((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ));
  }

  function toggleExpanded(cardId: string) {
    setExpandedIds((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ));
  }

  function selectFiltered() {
    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleCards.map((card) => card.id)])));
  }

  function selectAllCards() {
    setSelectedIds(cards.map((card) => card.id));
  }

  function clearAllSelections() {
    setSelectedIds([]);
  }

  function clearFiltered() {
    const filteredIds = new Set(visibleCards.map((card) => card.id));
    setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
  }

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  async function handleDelete(cardId: string) {
    if (!confirm("이 한자 카드를 단어집에서 삭제할까요?")) return;
    setDeletingId(cardId);
    setError("");
    const result = await deleteTeacherHanjaWordCard(cardId);
    setDeletingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCards((prev) => prev.filter((card) => card.id !== cardId));
    setSelectedIds((prev) => prev.filter((id) => id !== cardId));
    setExpandedIds((prev) => prev.filter((id) => id !== cardId));
  }

  function handlePrint() {
    if (selectedCards.length === 0) {
      setError("인쇄할 카드를 1장 이상 선택해 주세요.");
      return;
    }
    setError("");
    const payload = selectedCards.map((card) => ({
      id: card.id,
      word: card.word,
      hanja: card.hanja.length > 0 ? card.hanja.map((entry) => entry.char).join(" ") : "한자 정보 없음",
      definition: card.definition || "뜻 정보 없음",
      example: card.example || "예시 문장 없음",
    }));

    const jsonBlob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const htmlBlob = new Blob([buildPrintHtmlDocument(jsonUrl, payload.length)], { type: "text/html" });
    const htmlUrl = URL.createObjectURL(htmlBlob);

    const printWindow = window.open(htmlUrl, "_blank");
    if (!printWindow) {
      setError("인쇄 창을 열지 못했습니다. 팝업 차단을 확인해 주세요.");
      URL.revokeObjectURL(jsonUrl);
      URL.revokeObjectURL(htmlUrl);
      return;
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm print:hidden xl:grid-cols-[minmax(0,1fr)_160px_140px_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">검색</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetToFirstPage();
            }}
            placeholder="단어, 한자, 뜻풀이, 예문 검색"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">학년</span>
          <select
            value={gradeFilter}
            onChange={(event) => {
              setGradeFilter(event.target.value as GradeFilter);
              resetToFirstPage();
            }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="all">전체 학년</option>
            <option value="3">초등 3학년</option>
            <option value="4">초등 4학년</option>
            <option value="5">초등 5학년</option>
            <option value="6">초등 6학년</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-700">한 화면 수</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as PageSize);
              resetToFirstPage();
            }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="12">12개</option>
            <option value="24">24개</option>
            <option value="48">48개</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={selectAllCards}
            className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-50"
          >
            전체 카드 선택
          </button>
          <button
            type="button"
            onClick={clearAllSelections}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            전체 선택 해제
          </button>
          <button
            type="button"
            onClick={selectFiltered}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            현재 화면 모두 선택
          </button>
          <button
            type="button"
            onClick={clearFiltered}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            현재 화면 선택 해제
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            선택 카드 인쇄
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 print:hidden">
          {error}
        </div>
      )}

      <div className="print:hidden grid gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm md:grid-cols-[auto_auto_auto_1fr] md:items-center">
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          전체 {cards.length}장
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          검색 결과 {filteredCards.length}장
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          선택 {selectedCards.length}장
        </div>
        <p className="text-sm text-gray-500 md:text-right">기본은 미선택 상태이며, 필요한 카드만 골라 빠르게 인쇄할 수 있어요.</p>
      </div>

      {filteredCards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-white px-6 py-16 text-center text-gray-500">
          조건에 맞는 저장 카드가 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="print:hidden overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-[minmax(0,1.6fr)_110px_110px_120px] gap-3 border-b border-gray-100 px-4 py-3 text-xs font-semibold text-gray-500 md:px-5">
              <div>단어</div>
              <div>학년</div>
              <div>선택</div>
              <div className="text-right">관리</div>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleCards.map((card) => {
              const selected = selectedIds.includes(card.id);
              const expanded = expandedIds.includes(card.id);
              return (
                <div key={card.id} className={selected ? "bg-amber-50/50" : "bg-white"}>
                  <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_110px_110px_120px] md:items-start md:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900">{card.word}</h2>
                        {card.category && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {card.category}
                          </span>
                        )}
                        {card.hanja.length > 0 && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {card.hanja.map((entry) => entry.char).join(" ")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>관련 단어 {card.relatedWords.length}개</span>
                        <span>{new Date(card.updatedAt).toLocaleDateString("ko-KR")} 저장</span>
                      </div>
                      {card.definition && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">{card.definition}</p>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-gray-700">
                      초등 {card.grade}학년
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => toggleSelection(card.id)}
                        className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                          selected ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {selected ? "선택됨" : "선택"}
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(card.id)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        {expanded ? "접기" : "자세히"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card.id)}
                        disabled={deletingId === card.id}
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-500 ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        {deletingId === card.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-4 md:px-5">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                        <div className="space-y-4">
                          {card.definition && (
                            <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-gray-100">
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">뜻풀이</p>
                              <p className="mt-2 text-sm leading-relaxed text-gray-700">{card.definition}</p>
                            </div>
                          )}

                          {card.relatedWords.length > 0 && (
                            <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-gray-100">
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">관련 단어</p>
                              <div className="mt-3 grid gap-2">
                                {card.relatedWords.slice(0, 4).map((entry, index) => (
                                  <div key={`${card.id}-related-${index}`} className="rounded-2xl bg-gray-50 px-3 py-3">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <p className="text-sm font-bold text-gray-800">{entry.word}</p>
                                      {entry.hanja && <span className="text-xs text-amber-700">{entry.hanja}</span>}
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed text-gray-600">{entry.meaning}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {card.example && (
                            <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-gray-100">
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">예시 문장</p>
                              <p className="mt-2 text-sm leading-relaxed text-gray-700">{card.example}</p>
                            </div>
                          )}
                        </div>

                        {card.hanja.length > 0 && (
                          <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-amber-100">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">구성 한자</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {card.hanja.map((entry, index) => (
                                <div key={`${card.id}-hanja-${index}`} className="rounded-2xl bg-amber-50 px-3 py-3">
                                  <p className="text-2xl font-bold text-amber-700">{entry.char}</p>
                                  <p className="mt-1 text-sm font-semibold text-gray-800">{entry.meaning} {entry.reading}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>

          <div className="print:hidden flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-600">
              {safeCurrentPage} / {totalPages} 페이지
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPrintHtmlDocument(jsonUrl: string, totalCount: number) {
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>한자 단어집 인쇄</title>
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #111827;
            font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
          }

          .loading {
            align-items: center;
            display: flex;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }

          .loading-box {
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            max-width: 320px;
            padding: 24px 28px;
            text-align: center;
          }

          .loading-box h1 {
            font-size: 18px;
            margin: 0;
          }

          .loading-box p {
            color: #6b7280;
            font-size: 13px;
            line-height: 1.5;
            margin: 10px 0 0;
          }

          .sheet {
            display: none;
          }

          .page {
            break-after: page;
            min-height: calc(297mm - 20mm);
          }

          .page:last-child {
            break-after: auto;
          }

          .header {
            border-bottom: 1px solid #d1d5db;
            margin-bottom: 8px;
            padding-bottom: 8px;
          }

          .header h1 {
            font-size: 18px;
            margin: 0;
          }

          .header p {
            color: #6b7280;
            font-size: 11px;
            margin: 4px 0 0;
          }

          table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
          }

          th, td {
            border: 1px solid #d1d5db;
            font-size: 10px;
            line-height: 1.35;
            padding: 6px 7px;
            text-align: left;
            vertical-align: top;
          }

          thead th {
            background: #f9fafb;
            font-weight: 700;
          }

          tbody tr {
            height: 12.2mm;
          }

          .num {
            text-align: center;
            width: 6%;
          }

          .word {
            font-size: 11px;
            font-weight: 700;
            width: 10%;
          }
        </style>
      </head>
      <body>
        <main class="loading" id="loading">
          <div class="loading-box">
            <h1>인쇄 준비 중</h1>
            <p>선택한 카드 ${totalCount}장을 정리하고 있습니다.</p>
          </div>
        </main>
        <main class="sheet" id="sheet"></main>
        <script>
          const jsonUrl = ${JSON.stringify(jsonUrl)};
          const CARDS_PER_PAGE = 20;

          function escapeHtml(value) {
            return String(value)
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;")
              .replaceAll("'", "&#39;");
          }

          function chunk(items, size) {
            const result = [];
            for (let index = 0; index < items.length; index += size) {
              result.push(items.slice(index, index + size));
            }
            return result;
          }

          fetch(jsonUrl)
            .then((response) => response.json())
            .then((cards) => {
              const pages = chunk(cards, CARDS_PER_PAGE).map((pageCards, pageIndex) => {
                const rows = pageCards.map((card, itemIndex) => \`
                  <tr>
                    <td class="num">\${pageIndex * CARDS_PER_PAGE + itemIndex + 1}</td>
                    <td class="word">\${escapeHtml(card.word)}</td>
                    <td>\${escapeHtml(card.hanja)}</td>
                    <td>\${escapeHtml(card.definition)}</td>
                    <td>\${escapeHtml(card.example)}</td>
                  </tr>
                \`).join("");

                return \`
                  <section class="page">
                    <header class="header">
                      <h1>한자 단어집</h1>
                      <p>선택한 카드 \${cards.length}장 · 페이지당 20개 정리</p>
                    </header>
                    <table>
                      <thead>
                        <tr>
                          <th class="num">번호</th>
                          <th class="word">단어</th>
                          <th style="width: 10%;">한자</th>
                          <th style="width: 30%;">뜻</th>
                          <th>예시 문장</th>
                        </tr>
                      </thead>
                      <tbody>\${rows}</tbody>
                    </table>
                  </section>
                \`;
              }).join("");

              document.getElementById("sheet").innerHTML = pages;
              document.getElementById("loading").style.display = "none";
              document.getElementById("sheet").style.display = "block";

              setTimeout(() => {
                window.print();
              }, 120);
            })
            .catch(() => {
              document.getElementById("loading").innerHTML = '<div class="loading-box"><h1>인쇄 오류</h1><p>인쇄 데이터를 불러오지 못했습니다.</p></div>';
            })
            .finally(() => {
              setTimeout(() => URL.revokeObjectURL(jsonUrl), 1000);
            });

          window.addEventListener("afterprint", () => {
            window.close();
          });
        </script>
      </body>
    </html>
  `;
}
