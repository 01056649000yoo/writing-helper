import type {
  OneLineShareBoardEntry,
  OneLineShareConfig,
} from "@/features/activities/types";

type RawEntry = {
  id: string;
  session_id: string;
  student_number: number;
  student_name: string;
  content: string;
  contains_keywords: boolean;
  created_at: string;
  updated_at: string;
};

type RawReaction = {
  entry_id: string;
  session_id: string;
};

export function normalizeOneLineShareConfig(value: unknown): OneLineShareConfig | null {
  if (!isRecord(value)) return null;

  const coreFromNew = normalizeKeywords(value.coreKeywords);
  const legacyKeywords = normalizeKeywords(value.keywords);
  const coreKeywords = coreFromNew.length > 0 ? coreFromNew : legacyKeywords;
  const auxiliaryKeywords = normalizeKeywords(value.auxiliaryKeywords)
    .filter((keyword) => !coreKeywords.includes(keyword));

  return {
    promptTitle: typeof value.promptTitle === "string" && value.promptTitle.trim()
      ? value.promptTitle.trim()
      : "오늘 수업 한 줄 정리",
    promptDescription: typeof value.promptDescription === "string" && value.promptDescription.trim()
      ? value.promptDescription.trim()
      : "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.",
    coreKeywords,
    auxiliaryKeywords,
    maxReactionsPerStudent: clampNumber(value.maxReactionsPerStudent, 1, 10, 3),
  };
}

export function normalizeKeywordText(value: string) {
  return value
    .split(/\n|,/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export function includesConfiguredKeyword(content: string, keywords: string[]) {
  return getMatchingConfiguredKeywords(content, keywords).length > 0 || keywords.length === 0;
}

export function includesAllConfiguredKeywords(content: string, keywords: string[]) {
  if (keywords.length === 0) return true;
  return getMatchingConfiguredKeywords(content, keywords).length === keywords.length;
}

export function getMatchingConfiguredKeywords(content: string, keywords: string[]) {
  return keywords.filter((keyword) => keywordMatchesContent(content, keyword));
}

export function buildOneLineShareBoard(
  entries: RawEntry[],
  reactions: RawReaction[],
  currentSessionId?: string | null,
): OneLineShareBoardEntry[] {
  const likeCountByEntry = new Map<string, number>();
  const likedEntryIds = new Set<string>();

  reactions.forEach((reaction) => {
    likeCountByEntry.set(
      reaction.entry_id,
      (likeCountByEntry.get(reaction.entry_id) ?? 0) + 1,
    );

    if (currentSessionId && reaction.session_id === currentSessionId) {
      likedEntryIds.add(reaction.entry_id);
    }
  });

  return [...entries]
    .map((entry) => ({
      entryId: entry.id,
      sessionId: entry.session_id,
      studentNumber: entry.student_number,
      studentName: entry.student_name,
      content: entry.content,
      likeCount: likeCountByEntry.get(entry.id) ?? 0,
      likedByCurrentSession: likedEntryIds.has(entry.id),
      isMine: currentSessionId ? entry.session_id === currentSessionId : false,
      containsKeywords: entry.contains_keywords,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }))
    .sort((left, right) => {
      if (right.likeCount !== left.likeCount) {
        return right.likeCount - left.likeCount;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
}

function normalizeKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((keyword): keyword is string => typeof keyword === "string")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return normalizeKeywordText(value);
  }

  return [];
}

const KOREAN_PARTICLE_SUFFIXES = [
  "은", "는", "이", "가", "을", "를", "와", "과", "도", "만",
  "에", "에서", "에게", "께", "한테", "으로", "로", "보다", "처럼",
  "만큼", "부터", "까지", "랑", "이나", "나", "의",
];

function keywordMatchesContent(content: string, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return false;

  const normalizedContent = normalizeSearchText(content);
  if (!normalizedContent) return false;

  if (normalizedKeyword.includes(" ")) {
    return normalizedContent.includes(normalizedKeyword);
  }

  const tokens = content
    .split(/[\s,.;:!?()[\]{}"'“”‘’/\\|<>]+/u)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);

  return tokens.some((token) => {
    if (token === normalizedKeyword) return true;
    return KOREAN_PARTICLE_SUFFIXES.some((suffix) => token === `${normalizedKeyword}${suffix}`);
  });
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
