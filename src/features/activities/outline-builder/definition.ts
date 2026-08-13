import type { ActivityDefinition, OutlineBuilderConfig, OutlineBuilderResult, OutlineBuilderSubmission } from "../types";

export const outlineBuilderDefinition: ActivityDefinition<
  OutlineBuilderConfig,
  OutlineBuilderSubmission,
  OutlineBuilderResult
> = {
  id: "outline_builder",
  label: "글 개요 짜기",
  description: "교사가 준비한 글 종류별 개요 틀에 학생이 처음·가운데·끝 내용을 채우며 글의 구조를 잡는 활동입니다.",
  category: "writing",
  version: 2,
  usesAi: false,
  supportsRoomResult: false,
  integration: {
    schemaVersion: 1,
    resultKind: "outline",
  },
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
