import type {
  ActivityDefinition,
  QuestionVotingConfig,
  QuestionVotingResult,
  QuestionVotingRoomResult,
  QuestionVotingSubmission,
} from "../types";

export const questionVotingDefinition: ActivityDefinition<
  QuestionVotingConfig,
  QuestionVotingSubmission,
  QuestionVotingResult,
  QuestionVotingRoomResult
> = {
  id: "question_voting",
  label: "좋은 질문 고르기",
  description: "질문 후보를 읽고 가장 생각을 넓혀주는 질문을 학생들이 선택하는 활동입니다.",
  category: "questioning",
  version: 1,
  usesAi: false,
  supportsRoomResult: true,
  createDefaultConfig: () => ({
    maxSelections: 1,
    requireReason: true,
    candidates: [],
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    const candidates = Array.isArray(raw.candidates)
      ? raw.candidates.filter(isCandidate)
      : [];

    if (candidates.length === 0) {
      return { ok: false, errors: ["질문 후보가 1개 이상 필요합니다."] };
    }

    return {
      ok: true,
      value: {
        maxSelections: clampNumber(raw.maxSelections, 1, Math.max(candidates.length, 1), 1),
        requireReason: raw.requireReason !== false,
        candidates,
      },
    };
  },
  emptySubmission: () => ({
    selectedQuestionIds: [],
    reason: "",
  }),
  emptyResult: () => ({
    selectedQuestionIds: [],
  }),
  emptyRoomResult: () => ({
    ranking: [],
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCandidate(value: unknown): value is { id: string; text: string } {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.trim().length > 0
    && typeof value.text === "string"
    && value.text.trim().length > 0;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

