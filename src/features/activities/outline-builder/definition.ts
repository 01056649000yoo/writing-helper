import type { ActivityDefinition, OutlineBuilderConfig, OutlineBuilderResult, OutlineBuilderSubmission } from "../types";

export const outlineBuilderDefinition: ActivityDefinition<
  OutlineBuilderConfig,
  OutlineBuilderSubmission,
  OutlineBuilderResult
> = {
  id: "outline_builder",
  label: "글 개요 짜기",
  description: "교사가 준비한 글 종류별 개요 틀에 학생이 내용을 채우면, AI가 개요와 초안을 자동으로 정리해주는 활동입니다.",
  category: "writing",
  version: 2,
  usesAi: true,
  supportsRoomResult: false,
  createDefaultConfig: () => ({
    subjectType: "생활문",
    gradeLevel: "중학년",
    outlineDepth: "simple",
    outlineTemplate: null,
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
