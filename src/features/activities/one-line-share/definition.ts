import type {
  ActivityDefinition,
  OneLineShareConfig,
  OneLineShareResult,
  OneLineShareRoomResult,
  OneLineShareSubmission,
} from "../types";

export const oneLineShareDefinition: ActivityDefinition<
  OneLineShareConfig,
  OneLineShareSubmission,
  OneLineShareResult,
  OneLineShareRoomResult
> = {
  id: "one_line_share",
  label: "한줄모아",
  description: "핵심단어를 담아 한 문장으로 생각을 나누고, 친구 문장에 좋아요로 반응하는 활동입니다.",
  category: "reflection",
  version: 1,
  usesAi: false,
  supportsRoomResult: true,
  createDefaultConfig: () => ({
    promptTitle: "오늘 수업 한 줄 정리",
    promptDescription: "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.",
    keywords: [],
    maxReactionsPerStudent: 3,
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    const promptTitle = typeof raw.promptTitle === "string" && raw.promptTitle.trim()
      ? raw.promptTitle.trim()
      : "오늘 수업 한 줄 정리";
    const promptDescription = typeof raw.promptDescription === "string" && raw.promptDescription.trim()
      ? raw.promptDescription.trim()
      : "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.";
    const keywords = normalizeKeywords(raw.keywords);

    return {
      ok: true,
      value: {
        promptTitle,
        promptDescription,
        keywords,
        maxReactionsPerStudent: clampNumber(raw.maxReactionsPerStudent, 1, 10, 3),
      },
    };
  },
  emptySubmission: () => ({
    entryId: null,
    content: null,
  }),
  emptyResult: () => ({
    entryId: null,
    submitted: false,
    likeCount: 0,
  }),
  emptyRoomResult: () => ({
    entries: [],
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function normalizeKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((keyword): keyword is string => typeof keyword === "string")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return [];
}
