"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  ClassSpellingEntry,
  SpellingIssue,
  SpellingLookupEntry,
} from "@/components/student-spelling-textarea";

const MAX_QUERY_LENGTH = 180;
const MAX_RESULTS = 20;
const POPULAR_ENTRY_IDS = [
  "dwae-doe",
  "an-anh",
  "wen-waen",
  "eotteoke-eotteokhae",
  "hal-su-itda",
  "myeochil",
];
const NORMALIZE_PATTERN = /[\s/·,?!.'"’“”()_-]/g;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type SearchableEntry = SpellingLookupEntry & {
  kind: "common" | "class";
};

type StudentSpellingLookupDialogProps = {
  entries: SpellingLookupEntry[];
  classEntries: ClassSpellingEntry[];
  sourcesLoaded: boolean;
  initialQuery: string;
  initialEntryId?: string;
  correction?: SpellingIssue;
  onClose: () => void;
};

function normalize(value: string) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(NORMALIZE_PATTERN, "");
}

function toClassLookupEntry(entry: ClassSpellingEntry): SearchableEntry {
  return {
    id: `class:${entry.id}`,
    kind: "class",
    question: entry.wrong_expression,
    answer: entry.correct_expression,
    learningLabel: entry.label || "우리 반 맞춤법",
    category: "우리 반 맞춤법 수첩",
    subcategory: entry.label || "우리 반 자료",
    explanation: entry.explanation || "선생님이 우리 반 맞춤법 수첩에 등록한 표현이에요.",
    examples: Array.isArray(entry.examples) ? entry.examples : [],
    searchable: [entry.wrong_expression, entry.correct_expression, entry.label || ""],
    source: null,
  };
}

function scoreEntry(entry: SearchableEntry, query: string, preferredEntryId?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  if (entry.id === preferredEntryId) return 1000;

  const primary = [entry.question, entry.answer, entry.learningLabel].map(normalize);
  const supporting = [
    entry.category,
    entry.subcategory,
    ...entry.searchable,
    ...entry.examples,
  ].map(normalize);
  if (primary.some((candidate) => candidate === normalizedQuery)) return 100;
  if (primary.some((candidate) => candidate.startsWith(normalizedQuery))) return 80;
  if (primary.some((candidate) => candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate))) return 65;
  if (supporting.some((candidate) => candidate.includes(normalizedQuery))) return 45;
  if (normalize(entry.explanation).includes(normalizedQuery)) return 25;
  return 0;
}

function createOfficialDictionarySearchUrl(query: string) {
  return `https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=${encodeURIComponent(query.trim())}`;
}

export function StudentSpellingLookupDialog({
  entries,
  classEntries,
  sourcesLoaded,
  initialQuery,
  initialEntryId,
  correction,
  onClose,
}: StudentSpellingLookupDialogProps) {
  const titleId = useId();
  const queryInputId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery.slice(0, MAX_QUERY_LENGTH));
  const [searchedQuery, setSearchedQuery] = useState(initialQuery.slice(0, MAX_QUERY_LENGTH).trim());
  const [preferredEntryId, setPreferredEntryId] = useState(initialEntryId);
  const deferredQuery = useDeferredValue(searchedQuery);
  const closeDialog = useCallback(() => onClose(), [onClose]);

  const commonEntries = useMemo<SearchableEntry[]>(
    () => entries.map((entry) => ({ ...entry, kind: "common" })),
    [entries],
  );
  const searchableEntries = useMemo(
    () => [...classEntries.map(toClassLookupEntry), ...commonEntries],
    [classEntries, commonEntries],
  );
  const popularEntries = useMemo(() => (
    POPULAR_ENTRY_IDS
      .map((entryId) => commonEntries.find((entry) => entry.id === entryId))
      .filter((entry): entry is SearchableEntry => Boolean(entry))
  ), [commonEntries]);
  const results = useMemo(() => {
    if (!deferredQuery) return [];
    return searchableEntries
      .map((entry) => ({ entry, score: scoreEntry(entry, deferredQuery, preferredEntryId) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RESULTS)
      .map(({ entry }) => entry);
  }, [deferredQuery, preferredEntryId, searchableEntries]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog]);

  function runSearch(nextQuery = query, entryId?: string) {
    const trimmed = nextQuery.trim();
    setQuery(trimmed.slice(0, MAX_QUERY_LENGTH));
    setPreferredEntryId(entryId);
    setSearchedQuery(trimmed.slice(0, MAX_QUERY_LENGTH));
    inputRef.current?.focus();
  }

  return (
    <div
      className="lab-spelling-lookup__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <section
        ref={panelRef}
        className="lab-spelling-lookup__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="lab-spelling-lookup__header">
          <div className="lab-spelling-lookup__heading">
            <span aria-hidden="true">📖</span>
            <div>
              <small>나의 맞춤법 수첩</small>
              <h2 id={titleId}>맞춤법 찾아보기</h2>
            </div>
          </div>
          <button type="button" onClick={closeDialog} aria-label="맞춤법 찾아보기 닫기">×</button>
        </header>

        <div className="lab-spelling-lookup__body">
          {correction?.right ? (
            <div className="lab-spelling-lookup__correction">
              <small>이렇게 고쳐 써요</small>
              <p><del>{correction.text}</del><span aria-hidden="true">→</span><strong>{correction.right}</strong></p>
            </div>
          ) : null}

          <p className="lab-spelling-lookup__promise">
            아지트 맞춤법 수첩의 설명과 예문을 찾아봐요. 글은 자동으로 바꾸지 않으니 설명을 읽고 직접 고쳐 써요.
          </p>

          <form
            className="lab-spelling-lookup__search"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <label htmlFor={queryInputId}>궁금한 낱말이나 문장을 적어 보세요.</label>
            <div>
              <input
                ref={inputRef}
                id={queryInputId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))}
                placeholder="예: 오늘은 웬지 기분이 좋아요."
                lang="ko"
                spellCheck={false}
                autoCorrect="off"
                enterKeyHint="search"
              />
              <button type="submit" disabled={!query.trim()}>🔎 찾기</button>
            </div>
          </form>

          {!searchedQuery && popularEntries.length > 0 ? (
            <div className="lab-spelling-lookup__popular">
              <strong>많이 헷갈리는 표현</strong>
              <div>
                {popularEntries.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => runSearch(entry.question, entry.id)}
                  >
                    {entry.question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="lab-spelling-lookup__results" aria-live="polite">
            {!sourcesLoaded ? (
              <div className="lab-spelling-lookup__message" role="status">맞춤법 수첩 자료를 불러오고 있어요.</div>
            ) : null}

            {sourcesLoaded && searchableEntries.length === 0 ? (
              <div className="lab-spelling-lookup__message" role="status">
                맞춤법 수첩을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
              </div>
            ) : null}

            {sourcesLoaded && searchedQuery && results.length > 0 ? (
              <>
                <p className="lab-spelling-lookup__count">
                  <strong>‘{searchedQuery}’</strong>와 관련된 설명 {results.length}개를 찾았어요.
                </p>
                {results.map((entry) => (
                  <article className="lab-spelling-lookup__card" key={entry.id}>
                    <div className="lab-spelling-lookup__answer">
                      <span>{entry.question}</span>
                      <strong>{entry.answer}</strong>
                    </div>
                    <div className="lab-spelling-lookup__meta">
                      <span>{entry.kind === "class" ? "우리 반 자료" : entry.category}</span>
                      <span>{entry.subcategory}</span>
                    </div>
                    <p>{entry.explanation}</p>
                    {entry.examples.length > 0 ? (
                      <div className="lab-spelling-lookup__examples">
                        <strong>이렇게 써요</strong>
                        {entry.examples.map((example) => <span key={example}>{example}</span>)}
                      </div>
                    ) : null}
                    {entry.source?.url ? (
                      <a href={entry.source.url} target="_blank" rel="noreferrer">
                        {entry.source.label}에서 더 보기 ↗
                      </a>
                    ) : null}
                  </article>
                ))}
              </>
            ) : null}

            {sourcesLoaded && searchedQuery && results.length === 0 ? (
              <div className="lab-spelling-lookup__empty">
                <span aria-hidden="true">🔎</span>
                <strong>수첩에서 관련 규칙을 찾지 못했어요.</strong>
                <p>낱말이나 짧은 표현으로 다시 찾거나 국립국어원 사전에서 확인해 보세요.</p>
                <a href={createOfficialDictionarySearchUrl(searchedQuery)} target="_blank" rel="noreferrer">
                  국립국어원 사전에서 ‘{searchedQuery}’ 찾기 ↗
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
