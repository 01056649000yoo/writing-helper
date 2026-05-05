import type { ActivityDefinition, OutlineBuilderConfig, OutlineBuilderResult, OutlineBuilderSubmission } from "../types";

export const outlineBuilderDefinition: ActivityDefinition<
  OutlineBuilderConfig,
  OutlineBuilderSubmission,
  OutlineBuilderResult
> = {
  id: "outline_builder",
  label: "글 개요 짜기",
  description: "학생 답변을 바탕으로 GPT가 글쓰기 개요를 만들어주는 현재 활동입니다.",
  category: "writing",
  version: 1,
  usesAi: true,
  supportsRoomResult: false,
  createDefaultConfig: () => ({
    subjectType: "생활문",
    gradeLevel: "중학년",
    outlineDepth: "simple",
    questionSets: null,
    questionsGeneratedAt: null,
  }),
  validateConfig: (input) => {
    const value = { ...outlineBuilderDefinition.createDefaultConfig(), ...(isRecord(input) ? input : {}) };
    return { ok: true, value };
  },
  emptySubmission: () => ({
    level: null,
    answers: [],
  }),
  emptyResult: () => ({
    outline: null,
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

