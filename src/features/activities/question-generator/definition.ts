import type {
  ActivityDefinition,
  QuestionCardRole,
  QuestionGeneratorConfig,
  QuestionGeneratorResult,
  QuestionGeneratorRoomResult,
  QuestionGeneratorSubmission,
} from "../types";
import { QUESTION_CARD_SETS } from "./question-card-sets";
import { QUESTION_CARD_ROLE_PRESETS, normalizeQuestionCardLabel } from "./question-card-roles";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";

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
  integration: {
    schemaVersion: 1,
    resultKind: "questions",
    toPortableResult: ({ submission }) => {
      const normalized = normalizeQuestionGeneratorSubmission(submission);
      return {
        chunks: (normalized?.selections ?? []).map((selection) => ({
          id: selection.id,
          kind: "question" as const,
          label: selection.cardSetLabel,
          text: selection.remixedQuestion,
        })),
      };
    },
  },
  createDefaultConfig: () => ({
    enabledCardSetIds: QUESTION_CARD_SETS.map((set) => set.id),
    cardSets: QUESTION_CARD_SETS,
    roles: buildDefaultRoles(QUESTION_CARD_SETS),
    maxSelections: 1,
    guidance: "직접 질문을 만들거나 질문 카드를 골라 오늘 주제에 어울리게 질문을 바꿔 봅시다.",
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
        roles: normalizeRoles(raw.roles, cardSets),
        maxSelections: clampNumber(raw.maxSelections, 1, 4, 1),
        guidance,
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

function buildDefaultRoles(cardSets: QuestionGeneratorConfig["cardSets"]): QuestionCardRole[] {
  return QUESTION_CARD_ROLE_PRESETS.map((preset, index) => ({
    id: `default-role-${index + 1}`,
    label: preset.label,
    subtitle: preset.subtitle,
    description: preset.description,
    icon: preset.icon,
    cardSetIds: cardSets
      .filter((cardSet) => preset.cardSetLabels.includes(cardSet.label) || preset.cardSetLabels.includes(normalizeQuestionCardLabel(cardSet.label)))
      .map((cardSet) => cardSet.id),
  })).filter((role) => role.cardSetIds.length > 0);
}

function normalizeRoles(value: unknown, cardSets: QuestionGeneratorConfig["cardSets"]): QuestionCardRole[] {
  const allowedCardSetIds = new Set(cardSets.map((cardSet) => cardSet.id));

  if (!Array.isArray(value)) {
    return buildDefaultRoles(cardSets);
  }

  const roles = value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item, index): QuestionCardRole => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `role-${index + 1}`,
      label: typeof item.label === "string" ? item.label.trim() : "",
      subtitle: typeof item.subtitle === "string" ? item.subtitle.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
      icon: typeof item.icon === "string" && item.icon.trim() ? item.icon.trim() : "🃏",
      cardSetIds: Array.isArray(item.cardSetIds)
        ? item.cardSetIds.filter((cardSetId): cardSetId is string => typeof cardSetId === "string" && allowedCardSetIds.has(cardSetId))
        : [],
    }))
    .filter((role) => role.label && role.cardSetIds.length > 0);

  return roles.length > 0 ? roles : buildDefaultRoles(cardSets);
}
