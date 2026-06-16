import type { ActivityDefinition, OutlineBuilderConfig, OutlineBuilderResult, OutlineBuilderSubmission } from "../types";

export const outlineBuilderDefinition: ActivityDefinition<
  OutlineBuilderConfig,
  OutlineBuilderSubmission,
  OutlineBuilderResult
> = {
  id: "outline_builder",
  label: "글 개요 짜기",
  description: "처음·가운데·끝 구조로 내용을 입력하면 AI가 개요를 완성해주는 활동입니다.",
  category: "writing",
  version: 2,
  usesAi: true,
  supportsRoomResult: false,
  createDefaultConfig: () => ({
    subjectType: "생활문",
    gradeLevel: "중학년",
    outlineDepth: "simple",
    outlineTemplate: null,
    generateDraft: false,
  }),
  validateConfig: (input) => {
    const value = { ...outlineBuilderDefinition.createDefaultConfig(), ...(isRecord(input) ? input : {}) };
    return { ok: true, value };
  },
  emptySubmission: () => ({
    answers: [],
  }),
  emptyResult: () => ({
    outline: null,
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
