import type {
  ActivityDefinition,
  QuestionGeneratorConfig,
  QuestionGeneratorResult,
  QuestionGeneratorRoomResult,
  QuestionGeneratorSubmission,
} from "../types";
import { QUESTION_CARD_SETS } from "./question-card-sets";

export const questionGeneratorDefinition: ActivityDefinition<
  QuestionGeneratorConfig,
  QuestionGeneratorSubmission,
  QuestionGeneratorResult,
  QuestionGeneratorRoomResult
> = {
  id: "question_generator",
  label: "질문 만들기",
  description: "직접 질문을 만들거나 질문 카드를 참고해 주제에 맞는 나만의 질문을 만드는 활동입니다.",
  category: "questioning",
  version: 1,
  usesAi: false,
  supportsRoomResult: true,
  createDefaultConfig: () => ({
    enabledCardSetIds: QUESTION_CARD_SETS.map((set) => set.id),
    cardSets: QUESTION_CARD_SETS,
    maxSelections: 1,
    guidance: "직접 질문을 만들거나 질문 카드를 골라 오늘 주제에 어울리게 질문을 바꿔 봅시다.",
    requireReason: true,
    allowCustomQuestion: false,
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    const cardSets = normalizeCardSets(raw.cardSets);
    const allowedIds = new Set(cardSets.map((cardSet) => cardSet.id));
    const enabledCardSetIds = normalizeCardSetIds(raw.enabledCardSetIds, allowedIds);
    const guidance = typeof raw.guidance === "string" && raw.guidance.trim()
      ? raw.guidance.trim()
      : "직접 질문을 만들거나 질문 카드를 골라 오늘 주제에 어울리게 질문을 바꿔 봅시다.";

    return {
      ok: true,
      value: {
        enabledCardSetIds,
        cardSets,
        maxSelections: clampNumber(raw.maxSelections, 1, 4, 1),
        guidance,
        requireReason: raw.requireReason !== false,
        allowCustomQuestion: Boolean(raw.allowCustomQuestion),
      },
    };
  },
  emptySubmission: () => ({
    selections: [],
  }),
  emptyResult: () => ({
    submittedCount: 0,
  }),
  emptyRoomResult: () => ({
    questions: [],
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

function normalizeCardSets(value: unknown) {
  if (!Array.isArray(value)) return QUESTION_CARD_SETS;

  const cardSets = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `card-set-${index + 1}`,
      label: typeof item.label === "string" ? item.label.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
      prompts: Array.isArray(item.prompts)
        ? item.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0)
        : [],
    }))
    .filter((item) => item.label && item.prompts.length > 0);

  return cardSets.length > 0 ? cardSets : QUESTION_CARD_SETS;
}

function normalizeCardSetIds(value: unknown, allowed: Set<string>): string[] {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && allowed.has(item))
    : [];

  return ids.length > 0 ? ids : Array.from(allowed);
}
