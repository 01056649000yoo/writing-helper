import type {
  ActivityDefinition,
  QuestionGeneratorConfig,
  QuestionGeneratorResult,
  QuestionGeneratorRoomResult,
  QuestionGeneratorSubmission,
} from "../types";
import { QUESTION_CARD_SETS } from "./question-card-sets";
import {
  DEFAULT_QUESTION_GENERATOR_GUIDANCE,
  normalizeQuestionGeneratorConfig,
} from "./config";
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
  version: 2,
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
    mode: "card_remix",
    enabledCardSetIds: QUESTION_CARD_SETS.map((set) => set.id),
    cardSets: QUESTION_CARD_SETS,
    maxSelections: 1,
    guidance: DEFAULT_QUESTION_GENERATOR_GUIDANCE.card_remix,
  }),
  // 정규화의 원본은 `./config.ts` 하나다 — 화면·서버가 각자 읽으면 방식(mode)이 어긋난다.
  validateConfig: (input) => ({ ok: true, value: normalizeQuestionGeneratorConfig(input) }),
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
