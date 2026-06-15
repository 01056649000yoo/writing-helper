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
  const [selectedIds, setSelectedIds] = useState<string[]>(initialCards.map((card) => card.id));
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
    window.print();
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
        <p className="text-sm text-gray-500 md:text-right">목록은 최근 저장 순으로 정렬되며, 자세히 보기는 필요한 카드만 펼칠 수 있어요.</p>
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

          <div className="hidden print:block">
            <div className="mb-6 border-b border-gray-300 pb-4">
              <h2 className="text-2xl font-bold text-gray-900">한자 단어집</h2>
              <p className="mt-2 text-sm text-gray-600">
                선택한 카드 {selectedCards.length}장
              </p>
            </div>

            <div className="grid gap-6">
              {selectedCards.map((card) => (
                <div key={`print-${card.id}`} className="break-inside-avoid rounded-3xl border border-gray-300 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-3xl font-bold text-gray-900">{card.word}</h3>
                    <span className="text-sm font-semibold text-gray-500">초등 {card.grade}학년</span>
                  </div>
                  {card.definition && (
                    <p className="mt-3 text-sm leading-relaxed text-gray-700">{card.definition}</p>
                  )}

                  {card.hanja.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {card.hanja.map((entry, index) => (
                        <div key={`${card.id}-print-hanja-${index}`} className="rounded-2xl border border-gray-200 px-3 py-2">
                          <p className="text-2xl font-bold text-gray-900">{entry.char}</p>
                          <p className="mt-1 text-sm text-gray-700">{entry.meaning} {entry.reading}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {card.relatedWords.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-bold text-gray-800">관련 단어</p>
                      <div className="mt-2 grid gap-2">
                        {card.relatedWords.map((entry, index) => (
                          <div key={`${card.id}-print-related-${index}`} className="rounded-2xl border border-gray-200 px-3 py-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {entry.word} {entry.hanja ? `(${entry.hanja})` : ""}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-gray-600">{entry.meaning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {card.example && (
                    <div className="mt-4 rounded-2xl bg-gray-50 px-3 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">예시 문장</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-700">{card.example}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
