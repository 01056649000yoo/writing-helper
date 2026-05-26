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

  const existing = (data ?? []) as QuestionCardSetRow[];

  // 코드에 정의된 기본 묶음 중 교사 DB에 라벨이 없는 것만 자동 보충.
  // 신규 교사: existing이 비어 있어 모든 기본 묶음이 시드됨.
  // 기존 교사: 새 기본 묶음이 추가되면 다음 방문 시 누락분만 추가됨.
  // 트레이드오프: 교사가 기본 묶음을 삭제해도 같은 라벨이 다시 채워질 수 있음.
  const existingLabels = new Set(existing.map((row) => row.label));
  const missingDefaults = QUESTION_CARD_SETS.filter((d) => !existingLabels.has(d.label));

  if (missingDefaults.length === 0) {
    return existing.map(normalizeQuestionCardSetRow);
  }

  const maxOrder = existing.reduce<number>((max, row) => Math.max(max, row.sort_order ?? 0), -1);
  const seedRows = missingDefaults.map((cardSet, index) => ({
    teacher_id: teacherId,
    label: cardSet.label,
    description: cardSet.description,
    prompts: cardSet.prompts,
    sort_order: maxOrder + 1 + index,
  }));

  const { data: inserted, error: insertError } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .insert(seedRows)
    .select("id, teacher_id, label, description, prompts, sort_order, created_at");

  if (insertError) {
    if (isMissingQuestionCardSetsTable(insertError.message)) {
      // 테이블이 사라진 극단적 경우에도 화면이 깨지지 않도록 기본 묶음만 반환.
      return QUESTION_CARD_SETS;
    }
    throw new Error(insertError.message);
  }

  return [
    ...existing.map(normalizeQuestionCardSetRow),
    ...(inserted ?? []).map(normalizeQuestionCardSetRow),
  ];
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
