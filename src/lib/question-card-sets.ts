import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTION_CARD_SETS } from "@/features/activities/question-generator/question-card-sets";
import type { QuestionCardSet } from "@/features/activities/types";

type AdminClient = SupabaseClient;

type QuestionCardSetRow = {
  id: string;
  teacher_id: string;
  label: string;
  description: string;
  prompts: unknown;
  sort_order: number;
  created_at?: string;
};

export async function getTeacherQuestionCardSets(
  admin: AdminClient,
  teacherId: string
): Promise<QuestionCardSet[]> {
  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .select("id, teacher_id, label, description, prompts, sort_order, created_at")
    .eq("teacher_id", teacherId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingQuestionCardSetsTable(error.message)) {
      return QUESTION_CARD_SETS;
    }
    throw new Error(error.message);
  }

  if (data.length > 0) {
    return data.map(normalizeQuestionCardSetRow);
  }

  const seedRows = QUESTION_CARD_SETS.map((cardSet, index) => ({
    teacher_id: teacherId,
    label: cardSet.label,
    description: cardSet.description,
    prompts: cardSet.prompts,
    sort_order: index,
  }));

  const { data: inserted, error: insertError } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .insert(seedRows)
    .select("id, teacher_id, label, description, prompts, sort_order, created_at");

  if (insertError) {
    if (isMissingQuestionCardSetsTable(insertError.message)) {
      return QUESTION_CARD_SETS;
    }
    throw new Error(insertError.message);
  }

  return (inserted ?? []).map(normalizeQuestionCardSetRow);
}

export function normalizeQuestionCardSetInput(input: {
  id?: string;
  label?: string;
  description?: string;
  prompts?: string[];
}): QuestionCardSet {
  return {
    id: typeof input.id === "string" ? input.id : "",
    label: typeof input.label === "string" ? input.label.trim() : "",
    description: typeof input.description === "string" ? input.description.trim() : "",
    prompts: Array.isArray(input.prompts)
      ? input.prompts.map((prompt) => prompt.trim()).filter(Boolean)
      : [],
  };
}

export function isMissingQuestionCardSetsTable(message: string) {
  return message.includes("question_card_sets");
}

function normalizeQuestionCardSetRow(row: QuestionCardSetRow): QuestionCardSet {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    prompts: Array.isArray(row.prompts)
      ? row.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0)
      : [],
  };
}
