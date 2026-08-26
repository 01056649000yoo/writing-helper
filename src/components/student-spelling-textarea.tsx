"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const SHARED_DETECTION_CATALOG_URL = "/spelling/elementary-detection-v1.json";
const SHARED_LOOKUP_CATALOG_URL = "/spelling/elementary-lookup-v1.json";
const SCAN_DELAY_MS = 350;
const MAX_ISSUES = 50;

type QuickRule = {
  id: string;
  entryId: string;
  label: string;
  wrong: string;
  right: string;
  lookup: string;
  source: string;
};

type ElementaryPattern = {
  text: string;
  target: string;
  targetOffset?: number;
  right: string;
  lookup: string;
};

type ElementaryRule = {
  id: string;
  entryId: string;
  label: string;
  patterns: ElementaryPattern[];
};

type SharedCatalog = {
  version: number;
  quickRules: QuickRule[];
  elementaryRules: ElementaryRule[];
};

type SharedLookupCatalog = {
  version: number;
  lookupEntries: SpellingLookupEntry[];
};

export type SpellingLookupEntry = {
  id: string;
  question: string;
  answer: string;
  learningLabel: string;
  category: string;
  subcategory: string;
  explanation: string;
  examples: string[];
  searchable: string[];
  source: { label: string; url: string } | null;
};

export type ClassSpellingEntry = {
  id: string;
  wrong_expression: string;
  correct_expression: string;
  label?: string;
  explanation?: string;
  examples?: string[];
};

type IndexedPattern = ElementaryPattern & {
  ruleId: string;
  entryId: string;
  label: string;
  targetOffset: number;
};

type CompiledCatalog = {
  quickRules: QuickRule[];
  quickPattern: RegExp | null;
  elementaryByFirstCharacter: Map<string, IndexedPattern[]>;
};

export type SpellingIssue = {
  id: string;
  entryId: string;
  start: number;
  end: number;
  text: string;
  right: string;
};

type SpellingSources = {
  catalog: CompiledCatalog | null;
  classEntries: ClassSpellingEntry[];
};

type LookupRequest = {
  key: number;
  query: string;
  entryId?: string;
  correction?: SpellingIssue;
};

type StudentSpellingTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

let spellingSourcesPromise: Promise<SpellingSources> | null = null;
let spellingLookupEntriesPromise: Promise<SpellingLookupEntry[]> | null = null;

const StudentSpellingLookupDialog = dynamic(
  () => import("@/components/student-spelling-lookup-dialog")
    .then((module) => module.StudentSpellingLookupDialog),
  {
    ssr: false,
    loading: () => (
      <div className="lab-spelling-lookup__loading" role="status">
        맞춤법 수첩을 여는 중이에요.
      </div>
    ),
  },
);

function compileCatalog(catalog: SharedCatalog): CompiledCatalog {
  const elementaryByFirstCharacter = new Map<string, IndexedPattern[]>();

  for (const rule of catalog.elementaryRules) {
    for (const pattern of rule.patterns) {
      const target = String(pattern.target || pattern.text).normalize("NFC");
      const text = String(pattern.text || "").normalize("NFC");
      if (!target || !text) continue;
      const targetOffset = Number.isInteger(pattern.targetOffset)
        ? Math.max(0, pattern.targetOffset ?? 0)
        : Math.max(0, text.indexOf(target));
      const indexedPattern: IndexedPattern = {
        ...pattern,
        text,
        target,
        targetOffset,
        ruleId: rule.id,
        entryId: rule.entryId,
        label: rule.label,
      };
      const firstCharacter = target.charAt(0);
      const current = elementaryByFirstCharacter.get(firstCharacter) ?? [];
      current.push(indexedPattern);
      elementaryByFirstCharacter.set(firstCharacter, current);
    }
  }

  const quickRules = Array.isArray(catalog.quickRules) ? catalog.quickRules : [];
  const quickPattern = quickRules.length > 0
    ? new RegExp(quickRules.map((rule) => `(${rule.source})`).join("|"), "g")
    : null;

  return {
    quickRules,
    quickPattern,
    elementaryByFirstCharacter,
  };
}

async function loadSpellingSources(): Promise<SpellingSources> {
  if (!spellingSourcesPromise) {
    spellingSourcesPromise = Promise.all([
      fetch(SHARED_DETECTION_CATALOG_URL, { cache: "force-cache", credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`맞춤법 목록 응답 오류: ${response.status}`);
          const catalog = await response.json() as SharedCatalog;
          if (catalog.version !== 1 || !Array.isArray(catalog.elementaryRules)) {
            throw new Error("지원하지 않는 맞춤법 목록 형식입니다.");
          }
          return compileCatalog(catalog);
        })
        .catch(() => null),
      // `_v2` 는 배열이 아니라 `{ version, entries }` 를 준다. 같은 표현이 공통·학급 양쪽에 있으면
      // 공통 것 하나만 남겨 주므로 아지트 화면과 같은 목록을 본다.
      Promise.resolve(createSupabaseBrowserClient().rpc("get_student_spelling_entries_v2"))
        .then(({ data, error }) => {
          if (error) throw error;
          const entries = (data as { entries?: unknown } | null)?.entries;
          return Array.isArray(entries) ? entries as ClassSpellingEntry[] : [];
        })
        // 맞춤법 도움말은 있으면 좋은 것이라 실패해도 글쓰기를 막지 않는다.
        // 다만 조용히 비면 아무도 못 알아채므로 콘솔에는 남긴다.
        .catch((error: unknown) => {
          console.warn("학급 맞춤법 자료를 불러오지 못했습니다:", error);
          return [] as ClassSpellingEntry[];
        }),
    ]).then(([catalog, classEntries]) => ({ catalog, classEntries }));
  }
  return spellingSourcesPromise;
}

async function loadSpellingLookupEntries(): Promise<SpellingLookupEntry[]> {
  if (!spellingLookupEntriesPromise) {
    spellingLookupEntriesPromise = fetch(SHARED_LOOKUP_CATALOG_URL, {
      cache: "force-cache",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`맞춤법 검색 목록 응답 오류: ${response.status}`);
        const catalog = await response.json() as SharedLookupCatalog;
        if (catalog.version !== 1 || !Array.isArray(catalog.lookupEntries)) {
          throw new Error("지원하지 않는 맞춤법 검색 목록 형식입니다.");
        }
        return catalog.lookupEntries;
      })
      .catch(() => [] as SpellingLookupEntry[]);
  }
  return spellingLookupEntriesPromise;
}

function overlaps(existing: SpellingIssue[], candidate: SpellingIssue) {
  return existing.some((issue) => candidate.start < issue.end && candidate.end > issue.start);
}

function appendIssue(issues: SpellingIssue[], candidate: SpellingIssue) {
  if (issues.length >= MAX_ISSUES || overlaps(issues, candidate)) return;
  issues.push(candidate);
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left.charAt(index) === right.charAt(index)) index += 1;
  return index;
}

function findSpellingIssues(text: string, sources: SpellingSources): SpellingIssue[] {
  if (!text) return [];
  const issues: SpellingIssue[] = [];
  const { catalog, classEntries } = sources;

  if (catalog?.quickPattern) {
    catalog.quickPattern.lastIndex = 0;
    let match = catalog.quickPattern.exec(text);
    while (match && issues.length < MAX_ISSUES) {
      const ruleIndex = match.slice(1).findIndex((group) => group !== undefined);
      const rule = ruleIndex >= 0 ? catalog.quickRules.at(ruleIndex) : null;
      if (rule) {
        appendIssue(issues, {
          id: `quick:${rule.id}:${match.index}`,
          entryId: rule.entryId,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          right: rule.right,
        });
      }
      if (match.index === catalog.quickPattern.lastIndex) catalog.quickPattern.lastIndex += 1;
      match = catalog.quickPattern.exec(text);
    }
  }

  if (catalog && issues.length < MAX_ISSUES) {
    for (let targetStart = 0; targetStart < text.length && issues.length < MAX_ISSUES; targetStart += 1) {
      const candidates = catalog.elementaryByFirstCharacter.get(text.charAt(targetStart));
      if (!candidates) continue;
      for (const pattern of candidates) {
        if (!text.startsWith(pattern.target, targetStart)) continue;
        const matchStart = targetStart - pattern.targetOffset;
        if (matchStart < 0 || !text.startsWith(pattern.text, matchStart)) continue;
        appendIssue(issues, {
          id: `elementary:${pattern.ruleId}:${targetStart}`,
          entryId: pattern.entryId,
          start: targetStart,
          end: targetStart + pattern.target.length,
          text: pattern.target,
          right: pattern.right,
        });
        if (issues.length >= MAX_ISSUES) break;
      }
    }
  }

  if (issues.length < MAX_ISSUES) {
    for (const entry of classEntries) {
      const wrong = String(entry.wrong_expression || "").normalize("NFC");
      const right = String(entry.correct_expression || "").normalize("NFC");
      if (!wrong || wrong === right) continue;
      let start = text.indexOf(wrong);
      while (start >= 0 && issues.length < MAX_ISSUES) {
        appendIssue(issues, {
          id: `class:${entry.id}:${start}`,
          entryId: `class:${entry.id}`,
          start,
          end: start + wrong.length,
          text: wrong,
          right,
        });
        start = text.indexOf(wrong, start + wrong.length);
      }
      if (issues.length >= MAX_ISSUES) break;
    }
  }

  return issues.sort((left, right) => left.start - right.start).slice(0, MAX_ISSUES);
}

function buildHighlightedContent(text: string, issues: SpellingIssue[]): ReactNode[] {
  if (!text) return ["\u200b"];
  const content: ReactNode[] = [];
  let cursor = 0;

  for (const issue of issues) {
    if (issue.start > cursor) content.push(text.slice(cursor, issue.start));
    content.push(
      <span className="lab-spelling__mark" key={issue.id}>
        {text.slice(issue.start, issue.end)}
      </span>,
    );
    cursor = issue.end;
  }
  if (cursor < text.length) content.push(text.slice(cursor));
  content.push("\u200b");
  return content;
}

export function StudentSpellingTextarea({
  value,
  onValueChange,
  className = "",
  onScroll,
  ...props
}: StudentSpellingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlighterRef = useRef<HTMLDivElement>(null);
  const lookupReturnFocusRef = useRef<HTMLElement | null>(null);
  const lookupRequestSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const normalizedValue = useMemo(() => String(value || "").normalize("NFC"), [value]);
  const [scannedValue, setScannedValue] = useState(normalizedValue);
  const [sources, setSources] = useState<SpellingSources>({ catalog: null, classEntries: [] });
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [lookupEntries, setLookupEntries] = useState<SpellingLookupEntry[]>([]);
  const [lookupEntriesLoaded, setLookupEntriesLoaded] = useState(false);
  const [lookupRequest, setLookupRequest] = useState<LookupRequest | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    loadSpellingSources().then((loaded) => {
      if (active) {
        setSources(loaded);
        setSourcesLoaded(true);
      }
    });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (normalizedValue === scannedValue) return;
    const timer = window.setTimeout(() => setScannedValue(normalizedValue), SCAN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedValue, scannedValue]);

  const issues = useMemo(() => {
    const found = findSpellingIssues(scannedValue, sources);
    if (scannedValue === normalizedValue) return found;
    const safeLength = commonPrefixLength(scannedValue, normalizedValue);
    return found.filter((issue) => issue.end <= safeLength);
  }, [normalizedValue, scannedValue, sources]);
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      if (seen.has(issue.entryId)) return false;
      seen.add(issue.entryId);
      return true;
    });
  }, [issues]);

  function syncScroll() {
    if (!textareaRef.current || !highlighterRef.current) return;
    highlighterRef.current.scrollTop = textareaRef.current.scrollTop;
    highlighterRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  function openLookup(trigger: HTMLElement, issue?: SpellingIssue) {
    lookupReturnFocusRef.current = trigger;
    lookupRequestSequenceRef.current += 1;
    setLookupRequest({
      key: lookupRequestSequenceRef.current,
      query: issue?.text || "",
      entryId: issue?.entryId,
      correction: issue,
    });
    if (!lookupEntriesLoaded) {
      loadSpellingLookupEntries().then((entries) => {
        if (!mountedRef.current) return;
        setLookupEntries(entries);
        setLookupEntriesLoaded(true);
      });
    }
  }

  function closeLookup() {
    setLookupRequest(null);
    window.requestAnimationFrame(() => lookupReturnFocusRef.current?.focus());
  }

  return (
    <div className="lab-spelling">
      <div className="lab-spelling__field">
        <div
          ref={highlighterRef}
          className={`${className} lab-spelling__overlay`}
          aria-hidden="true"
        >
          {buildHighlightedContent(normalizedValue, issues)}
        </div>
        <textarea
          {...props}
          ref={textareaRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onScroll={(event) => {
            syncScroll();
            onScroll?.(event);
          }}
          className={`${className} lab-spelling__control`}
          lang="ko"
          spellCheck={false}
          autoCorrect="off"
        />
      </div>

      <div className="lab-spelling__toolbar">
        <button
          type="button"
          onClick={(event) => openLookup(event.currentTarget)}
          aria-haspopup="dialog"
        >
          <span aria-hidden="true">🔎</span> 맞춤법 찾아보기
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="lab-spelling__notice" role="status">
          <strong>
            <span aria-hidden="true">〰️</span> 맞춤법 수첩에서 확인해 볼 표현 {issues.length >= MAX_ISSUES ? `${MAX_ISSUES}개 이상` : `${issues.length}개`}
          </strong>
          <div>
            {suggestions.slice(0, 4).map((issue) => (
              <button
                type="button"
                className="lab-spelling__suggestion"
                key={issue.entryId}
                onClick={(event) => openLookup(event.currentTarget, issue)}
                aria-haspopup="dialog"
              >
                {issue.text} <span aria-hidden="true">→</span> {issue.right}
              </button>
            ))}
            {suggestions.length > 4 && <small>외 {suggestions.length - 4}개</small>}
          </div>
        </div>
      )}

      {lookupRequest ? (
        <StudentSpellingLookupDialog
          key={lookupRequest.key}
          entries={lookupEntries}
          classEntries={sources.classEntries}
          sourcesLoaded={sourcesLoaded && lookupEntriesLoaded}
          initialQuery={lookupRequest.query}
          initialEntryId={lookupRequest.entryId}
          correction={lookupRequest.correction}
          onClose={closeLookup}
        />
      ) : null}
    </div>
  );
}
