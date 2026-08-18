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
  description: "핵심단어를 이용한 문장 만들기 활동입니다.",
  category: "reflection",
  version: 1,
  usesAi: false,
  supportsRoomResult: true,
  integration: {
    schemaVersion: 1,
    resultKind: "one_line",
    toPortableResult: ({ submission }) => {
      const raw = isRecord(submission) ? submission : {};
      const text = typeof raw.content === "string" ? raw.content.trim() : "";
      return {
        chunks: text
          ? [{
              id: typeof raw.entryId === "string" && raw.entryId.trim()
                ? raw.entryId.trim()
                : "one-line",
              kind: "sentence" as const,
              label: "한줄모아",
              text,
            }]
          : [],
      };
    },
  },
  createDefaultConfig: () => ({
    promptTitle: "오늘 수업 한 줄 정리",
    promptDescription: "핵심단어를 이용해 멋진 한 문장을 완성해 보세요.",
    coreKeywords: [],
    auxiliaryKeywords: [],
    maxReactionsPerStudent: 3,
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    const promptTitle = typeof raw.promptTitle === "string" && raw.promptTitle.trim()
      ? raw.promptTitle.trim()
      : "오늘 수업 한 줄 정리";
    const promptDescription = typeof raw.promptDescription === "string" && raw.promptDescription.trim()
      ? raw.promptDescription.trim()
      : "핵심단어를 이용해 멋진 한 문장을 완성해 보세요.";
    const coreFromNew = normalizeKeywords(raw.coreKeywords);
    const legacy = normalizeKeywords(raw.keywords);
    const coreKeywords = coreFromNew.length > 0 ? coreFromNew : legacy;
    const auxiliaryKeywords = normalizeKeywords(raw.auxiliaryKeywords)
      .filter((keyword) => !coreKeywords.includes(keyword));

    return {
      ok: true,
      value: {
        promptTitle,
        promptDescription,
        coreKeywords,
        auxiliaryKeywords,
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
