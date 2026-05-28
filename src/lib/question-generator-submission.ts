import type { QuestionGeneratorSubmission } from "@/features/activities/types";

export type QuestionGeneratorSelection = QuestionGeneratorSubmission["selections"][number];

export function normalizeQuestionGeneratorSubmission(value: unknown): QuestionGeneratorSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawSelections = Array.isArray((value as { selections?: unknown[] }).selections)
    ? (value as { selections: unknown[] }).selections
    : [];

  const selections: QuestionGeneratorSubmission["selections"] = rawSelections
    .filter((selection): selection is Record<string, unknown> => typeof selection === "object" && selection !== null && !Array.isArray(selection))
    .map((selection, index) => ({
      id: typeof selection.id === "string" && selection.id.trim()
        ? selection.id.trim()
        : `selection-${index + 1}`,
      method: (selection.method === "direct" ? "direct" : "card_remix") as "direct" | "card_remix",
      cardSetId: typeof selection.cardSetId === "string" && selection.cardSetId.trim()
        ? selection.cardSetId.trim()
        : "custom",
      cardSetLabel: typeof selection.cardSetLabel === "string" && selection.cardSetLabel.trim()
        ? selection.cardSetLabel.trim()
        : (selection.method === "direct" ? "직접 질문 만들기" : "질문 카드"),
      originalPrompt: typeof selection.originalPrompt === "string" && selection.originalPrompt.trim()
        ? selection.originalPrompt.trim()
        : null,
      remixedQuestion: typeof selection.remixedQuestion === "string" ? selection.remixedQuestion.trim() : "",
    }))
    .filter((selection) => selection.remixedQuestion.length > 0);

  return selections.length > 0 ? { selections } : null;
}
