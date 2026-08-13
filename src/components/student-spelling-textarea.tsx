"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const SHARED_CATALOG_URL = "/spelling/elementary-detection-v1.json";
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

type ClassEntry = {
  id: string;
  wrong_expression: string;
  correct_expression: string;
  label?: string;
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

type SpellingIssue = {
  id: string;
  entryId: string;
  start: number;
  end: number;
  text: string;
  right: string;
};

type SpellingSources = {
  catalog: CompiledCatalog | null;
  classEntries: ClassEntry[];
};

type StudentSpellingTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

let spellingSourcesPromise: Promise<SpellingSources> | null = null;

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

  return { quickRules, quickPattern, elementaryByFirstCharacter };
}

async function loadSpellingSources(): Promise<SpellingSources> {
  if (!spellingSourcesPromise) {
    spellingSourcesPromise = Promise.all([
      fetch(SHARED_CATALOG_URL, { cache: "force-cache", credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`맞춤법 목록 응답 오류: ${response.status}`);
          const catalog = await response.json() as SharedCatalog;
          if (catalog.version !== 1 || !Array.isArray(catalog.elementaryRules)) {
            throw new Error("지원하지 않는 맞춤법 목록 형식입니다.");
          }
          return compileCatalog(catalog);
        })
        .catch(() => null),
      Promise.resolve(createSupabaseBrowserClient().rpc("get_student_spelling_entries_v1"))
        .then(({ data, error }) => {
          if (error) throw error;
          return Array.isArray(data) ? data as ClassEntry[] : [];
        })
        .catch(() => [] as ClassEntry[]),
    ]).then(([catalog, classEntries]) => ({ catalog, classEntries }));
  }
  return spellingSourcesPromise;
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
  const normalizedValue = useMemo(() => String(value || "").normalize("NFC"), [value]);
  const [scannedValue, setScannedValue] = useState(normalizedValue);
  const [sources, setSources] = useState<SpellingSources>({ catalog: null, classEntries: [] });

  useEffect(() => {
    let active = true;
    loadSpellingSources().then((loaded) => {
      if (active) setSources(loaded);
    });
    return () => { active = false; };
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

      {suggestions.length > 0 && (
        <div className="lab-spelling__notice" role="status">
          <strong>
            <span aria-hidden="true">〰️</span> 맞춤법 수첩에서 확인해 볼 표현 {issues.length >= MAX_ISSUES ? `${MAX_ISSUES}개 이상` : `${issues.length}개`}
          </strong>
          <div>
            {suggestions.slice(0, 4).map((issue) => (
              <span className="lab-spelling__suggestion" key={issue.entryId}>
                {issue.text} <span aria-hidden="true">→</span> {issue.right}
              </span>
            ))}
            {suggestions.length > 4 && <small>외 {suggestions.length - 4}개</small>}
          </div>
        </div>
      )}
    </div>
  );
}
