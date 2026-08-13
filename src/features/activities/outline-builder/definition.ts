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
    toPortableResult: ({ answers }) => {
      const chunks = Array.isArray(answers)
        ? answers
            .filter(isRecord)
            .map((answer, index) => {
              const text = typeof answer.answer === "string" ? answer.answer.trim() : "";
              const section: "처음" | "가운데" | "끝" = answer.section === "가운데" || answer.section === "끝"
                ? answer.section
                : "처음";
              return {
                id: typeof answer.itemId === "string" && answer.itemId.trim()
                  ? answer.itemId.trim()
                  : `outline-${index + 1}`,
                kind: "outline_item" as const,
                section,
                label: typeof answer.label === "string" ? answer.label.trim() : "",
                text,
              };
            })
            .filter((chunk) => chunk.text.length > 0)
        : [];

      return { chunks };
    },
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
