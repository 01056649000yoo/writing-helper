"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "./auth-actions";
import { saveApiKey, hasApiKey, getApiKey } from "@/lib/vault";
import { createOpenAIClient, generateAiRolesAndQuestions, type GeneratedRoleData } from "@/lib/gpt";
import {
  getTeacherQuestionCardSettingsTree,
  getTeacherQuestionCardSets,
  isMissingQuestionCardRolesTable,
  isMissingQuestionCardSetsTable,
  normalizeQuestionCardSetInput,
} from "@/lib/question-card-sets";
import type { QuestionCardRole, QuestionCardSet, QuestionSet, QuestionSetItem } from "@/features/activities/types";
import { normalizeQuestionCardLabel } from "@/features/activities/question-generator/question-card-roles";

export async function saveGptApiKey(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!apiKey.startsWith("sk-")) return { error: "올바른 OpenAI API 키 형식이 아닙니다." };

  try {
    const secretId = await saveApiKey(user.id, apiKey);

    const admin = createSupabaseAdminClient();
    const { error: updateError } = await admin
      .schema("writing_helper")
      .from("teacher_profiles")
      .update({ vault_secret_id: secretId })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[saveGptApiKey] profile update error:", updateError);
      return { error: `프로필 업데이트 실패: ${updateError.message}` };
    }

    revalidatePath("/dashboard/api-key");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (e) {
    console.error("[saveGptApiKey] error:", e);
    return { error: `API 키 저장에 실패했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function checkHasApiKey(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return hasApiKey(user.id);
}

export async function testApiKey(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .schema("writing_helper")
    .from("teacher_profiles")
    .select("vault_secret_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.vault_secret_id) return { ok: false, error: "저장된 API 키가 없습니다." };

  const apiKey = await getApiKey(profile.vault_secret_id);
  if (!apiKey) return { ok: false, error: "API 키를 불러올 수 없습니다." };

  try {
    const client = createOpenAIClient(apiKey);
    await client.models.list();
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, error: msg };
  }
}

export async function getQuestionCardSettings(): Promise<{ roles: QuestionCardRole[]; cardSets: QuestionCardSet[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { roles: [], cardSets: [], error: "로그인이 필요합니다." };

  try {
    const admin = createSupabaseAdminClient();
    const settings = await getTeacherQuestionCardSettingsTree(admin, user.id);
    return settings;
  } catch (error) {
    const message = error instanceof Error ? error.message : "질문 카드 설정을 불러오지 못했습니다.";
    return { roles: [], cardSets: [], error: message };
  }
}

export async function saveQuestionCardSetting(input: {
  id?: string;
  label: string;
  description: string;
  prompts: string[];
  roleId?: string | null;
  sortOrder: number;
}): Promise<{ cardSet?: QuestionCardSet; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const normalized = normalizeQuestionCardSetInput(input);
  if (!normalized.label) return { error: "카드 묶음 이름을 입력해주세요." };
  if (normalized.prompts.length === 0) return { error: "질문 카드를 한 줄에 하나씩 1개 이상 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const payload = {
    teacher_id: user.id,
    label: normalized.label,
    description: normalized.description,
    prompts: normalized.prompts,
    role_id: normalized.roleId ?? null,
    sort_order: Number.isFinite(input.sortOrder) ? Math.max(0, Math.trunc(input.sortOrder)) : 0,
  };

  if (normalized.id) {
    const { data, error } = await admin
      .schema("writing_helper")
      .from("question_card_sets")
      .update(payload)
      .eq("id", normalized.id)
      .eq("teacher_id", user.id)
      .select("id, label, description, prompts, role_id")
      .maybeSingle();

    if (error) {
      if (isMissingQuestionCardSetsTable(error.message)) {
        return { error: "질문 카드 설정 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/room/new");
    return {
      cardSet: data
        ? {
            id: data.id,
            label: data.label,
            description: data.description,
            prompts: Array.isArray(data.prompts) ? data.prompts.filter((prompt): prompt is string => typeof prompt === "string") : [],
            roleId: data.role_id ?? null,
          }
        : normalized,
    };
  }

  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .insert(payload)
    .select("id, label, description, prompts, role_id")
    .single();

  if (error) {
    if (isMissingQuestionCardSetsTable(error.message)) {
      return { error: "질문 카드 설정 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return {
    cardSet: {
      id: data.id,
      label: data.label,
      description: data.description,
      prompts: Array.isArray(data.prompts) ? data.prompts.filter((prompt): prompt is string => typeof prompt === "string") : [],
      roleId: data.role_id ?? null,
    },
  };
}

export async function saveQuestionCardRole(input: {
  id?: string;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  sortOrder: number;
}): Promise<{ role?: QuestionCardRole; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const label = String(input.label ?? "").trim();
  if (!label) return { error: "역할 이름을 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const payload = {
    teacher_id: user.id,
    label,
    subtitle: String(input.subtitle ?? "").trim(),
    description: String(input.description ?? "").trim(),
    icon: String(input.icon ?? "").trim() || "🃏",
    sort_order: Number.isFinite(input.sortOrder) ? Math.max(0, Math.trunc(input.sortOrder)) : 0,
  };

  if (input.id) {
    const { data, error } = await admin
      .schema("writing_helper")
      .from("question_card_roles")
      .update(payload)
      .eq("id", input.id)
      .eq("teacher_id", user.id)
      .select("id, label, subtitle, description, icon")
      .maybeSingle();

    if (error) {
      if (isMissingQuestionCardRolesTable(error.message)) {
        return { error: "질문 카드 역할 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/room/new");
    return {
      role: data
        ? { id: data.id, label: data.label, subtitle: data.subtitle, description: data.description, icon: data.icon, cardSetIds: [] }
        : undefined,
    };
  }

  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_card_roles")
    .insert(payload)
    .select("id, label, subtitle, description, icon")
    .single();

  if (error) {
    if (isMissingQuestionCardRolesTable(error.message)) {
      return { error: "질문 카드 역할 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return {
    role: { id: data.id, label: data.label, subtitle: data.subtitle, description: data.description, icon: data.icon, cardSetIds: [] },
  };
}

// ──────────────────────────────────────────
// 질문 세트 (교사 큐레이션 컬렉션) CRUD
// ──────────────────────────────────────────

function normalizeQuestionSetItems(input: unknown): QuestionSetItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row): QuestionSetItem | null => {
      if (typeof row === "string") {
        const text = row.trim();
        return text ? { text } : null;
      }
      if (row && typeof row === "object") {
        const r = row as Record<string, unknown>;
        const text = typeof r.text === "string" ? r.text.trim() : "";
        if (!text) return null;
        const source = typeof r.source_label === "string" && r.source_label.trim()
          ? r.source_label.trim() : undefined;
        return source ? { text, source_label: source } : { text };
      }
      return null;
    })
    .filter((row): row is QuestionSetItem => row !== null);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToQuestionSet(row: any): QuestionSet {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    items: normalizeQuestionSetItems(row.items),
  };
}

function isMissingQuestionSetsTable(message: string) {
  return message.includes("question_sets");
}

export async function getTeacherQuestionSets(): Promise<{ sets: QuestionSet[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { sets: [], error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_sets")
    .select("id, name, description, items, sort_order, created_at")
    .eq("teacher_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingQuestionSetsTable(error.message)) {
      return { sets: [], error: "질문 세트 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { sets: [], error: error.message };
  }
  return { sets: (data ?? []).map(rowToQuestionSet) };
}

export async function getTeacherQuestionSet(id: string): Promise<{ set?: QuestionSet; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!id) return { error: "잘못된 요청입니다." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_sets")
    .select("id, name, description, items, sort_order, created_at, teacher_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingQuestionSetsTable(error.message)) {
      return { error: "질문 세트 테이블이 아직 준비되지 않았습니다." };
    }
    return { error: error.message };
  }
  if (!data) return { error: "질문 세트를 찾을 수 없습니다." };
  return { set: rowToQuestionSet(data) };
}

export async function saveQuestionSet(input: {
  id?: string;
  name: string;
  description: string;
  items: QuestionSetItem[];
}): Promise<{ set?: QuestionSet; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  const items = normalizeQuestionSetItems(input.items);

  if (!name) return { error: "세트 이름을 입력해주세요." };
  if (items.length === 0) return { error: "질문을 1개 이상 골라주세요." };

  const admin = createSupabaseAdminClient();
  const payload = {
    teacher_id: user.id,
    name,
    description,
    items,
  };

  if (input.id) {
    const { data, error } = await admin
      .schema("writing_helper")
      .from("question_sets")
      .update(payload)
      .eq("id", input.id)
      .eq("teacher_id", user.id)
      .select("id, name, description, items, sort_order, created_at")
      .maybeSingle();
    if (error) {
      if (isMissingQuestionSetsTable(error.message)) return { error: "질문 세트 테이블이 준비되지 않았습니다." };
      return { error: error.message };
    }
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/room/new");
    return { set: data ? rowToQuestionSet(data) : undefined };
  }

  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_sets")
    .insert(payload)
    .select("id, name, description, items, sort_order, created_at")
    .single();
  if (error) {
    if (isMissingQuestionSetsTable(error.message)) return { error: "질문 세트 테이블이 준비되지 않았습니다." };
    return { error: error.message };
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return { set: rowToQuestionSet(data) };
}

export async function deleteQuestionSet(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!id) return { error: "삭제할 세트를 찾지 못했습니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("question_sets")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return {};
}

export async function deleteQuestionCardSetting(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!id) return { error: "삭제할 카드 묶음을 찾지 못했습니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    if (isMissingQuestionCardSetsTable(error.message)) {
      return { error: "질문 카드 설정 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return {};
}

export async function deleteQuestionCardRole(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!id) return { error: "삭제할 역할을 찾지 못했습니다." };

  const admin = createSupabaseAdminClient();

  // 1. Delete associated card sets first to prevent orphaned datasets in the database
  const { error: deleteSetsError } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .delete()
    .eq("teacher_id", user.id)
    .eq("role_id", id);

  if (deleteSetsError) {
    if (isMissingQuestionCardSetsTable(deleteSetsError.message)) {
      return { error: "질문 카드 설정 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: deleteSetsError.message };
  }

  // 2. Delete the role itself
  const { error } = await admin
    .schema("writing_helper")
    .from("question_card_roles")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    if (isMissingQuestionCardRolesTable(error.message)) {
      return { error: "질문 카드 역할 테이블이 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/room/new");
  return {};
}

export async function generateAiRolesAndCardsAction(
  topic: string,
  gradeLevel: string,
  roleCount: number
): Promise<{ roles?: GeneratedRoleData[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .schema("writing_helper")
    .from("teacher_profiles")
    .select("vault_secret_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.vault_secret_id) {
    return { error: "저장된 API 키가 없습니다. OpenAI API 키를 먼저 등록해주세요." };
  }

  const apiKey = await getApiKey(profile.vault_secret_id);
  if (!apiKey) {
    return { error: "API 키를 불러올 수 없습니다." };
  }

  try {
    const roles = await generateAiRolesAndQuestions(apiKey, topic, gradeLevel, roleCount);
    return { roles };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return { error: msg };
  }
}

export async function saveBulkQuestionRolesAndCards(
  rolesData: GeneratedRoleData[]
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  try {
    for (const roleData of rolesData) {
      const { data: roleResult, error: roleError } = await admin
        .schema("writing_helper")
        .from("question_card_roles")
        .insert({
          teacher_id: user.id,
          label: roleData.label.trim(),
          subtitle: roleData.subtitle.trim(),
          description: roleData.description.trim(),
          icon: roleData.icon.trim() || "🃏",
          sort_order: 0,
        })
        .select("id")
        .single();

      if (roleError) {
        throw new Error(`역할 '${roleData.label}' 저장 실패: ${roleError.message}`);
      }

      for (const cardSet of roleData.cardSets) {
        const { error: cardError } = await admin
          .schema("writing_helper")
          .from("question_card_sets")
          .insert({
            teacher_id: user.id,
            label: cardSet.label.trim(),
            description: cardSet.description.trim(),
            prompts: cardSet.prompts.map((p) => p.trim()).filter(Boolean),
            role_id: roleResult.id,
            sort_order: 0,
          });

        if (cardError) {
          throw new Error(`카드 묶음 '${cardSet.label}' 저장 실패: ${cardError.message}`);
        }
      }
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/room/new");
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "일괄 저장 중 알 수 없는 오류가 발생했습니다.";
    return { error: msg };
  }
}

export async function resetDefaultQuestionCardSettings(): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  try {
    // 1. Delete ALL card sets belonging to this teacher
    const { error: deleteSetsError } = await admin
      .schema("writing_helper")
      .from("question_card_sets")
      .delete()
      .eq("teacher_id", user.id);

    if (deleteSetsError) {
      if (isMissingQuestionCardSetsTable(deleteSetsError.message)) {
        return { error: "질문 카드 설정 테이블이 아직 준비되지 않았습니다." };
      }
      return { error: `카드 세트 삭제 실패: ${deleteSetsError.message}` };
    }

    // 2. Delete ALL roles belonging to this teacher
    const { error: deleteRolesError } = await admin
      .schema("writing_helper")
      .from("question_card_roles")
      .delete()
      .eq("teacher_id", user.id);

    if (deleteRolesError) {
      if (isMissingQuestionCardRolesTable(deleteRolesError.message)) {
        return { error: "질문 카드 역할 테이블이 아직 준비되지 않았습니다." };
      }
      return { error: `역할 삭제 실패: ${deleteRolesError.message}` };
    }

    // 3. Force recreate pristine defaults from factory presets!
    await getTeacherQuestionCardSettingsTree(admin, user.id);

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/room/new");
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "초기화 중 알 수 없는 오류가 발생했습니다.";
    return { error: msg };
  }
}

