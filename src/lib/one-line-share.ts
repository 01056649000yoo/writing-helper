import { pickPodium, rankByScore, type Ranked } from "@/lib/ranking";
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

      // 좋아요가 같으면 순서를 정할 근거가 없다. 먼저 낸 순으로 두어 목록이 흔들리지 않게만 하고,
      // 등수는 `rankOneLineShare` 가 같은 좋아요에 같은 등수를 준다.
      return left.createdAt.localeCompare(right.createdAt);
    });
}

/**
 * 등수·시상대 규칙은 활동 공용이다. 좋은 질문 고르기와 같은 규칙을 쓴다.
 * 여기서는 "점수가 무엇인지"(좋아요 수)만 알려 준다.
 */
export type RankedOneLineShareEntry = Ranked<OneLineShareBoardEntry>;

const likesOf = (entry: { likeCount: number }) => entry.likeCount;

export function rankOneLineShare(entries: OneLineShareBoardEntry[]): RankedOneLineShareEntry[] {
  return rankByScore(entries, likesOf);
}

export function pickOneLineSharePodium(
  ranked: RankedOneLineShareEntry[],
): RankedOneLineShareEntry[] {
  return pickPodium(ranked, likesOf);
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

/*
 * 핵심단어가 글 안에 쓰였는지 본다.
 *
 * ⚠️ 예전에는 **띄어쓰기로 자른 낱말이 핵심단어와 정확히 같거나, 정해 둔 조사 하나가 붙은 경우**만
 *    인정했다. 그래서 이런 것들이 모두 실패했다(2026-08-25 확인):
 *      `온난화가심각하다`   — 아이들이 띄어쓰기를 자주 빠뜨린다
 *      `지구온난화가 …`     — 핵심단어가 다른 말과 붙은 합성어
 *      `온난화때문에`       — 목록에 없는 조사·어미
 *    조사 목록을 늘려도 끝이 없다. 한국어는 붙는 말이 너무 많고 아이 글은 띄어쓰기가 고르지 않다.
 *
 * 그래서 **글 안에 그 낱말이 들어 있으면 인정**한다. 교사가 묻는 것은 "이 낱말을 썼는가"이지
 * "문법에 맞게 썼는가"가 아니다. 다른 말에 우연히 섞여 통과하는 경우가 생길 수 있지만,
 * **쓴 아이를 못 썼다고 하는 쪽이 훨씬 나쁘다.**
 */
function keywordMatchesContent(content: string, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return false;

  const normalizedContent = normalizeSearchText(content);
  if (!normalizedContent) return false;

  return normalizedContent.includes(normalizedKeyword);
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
