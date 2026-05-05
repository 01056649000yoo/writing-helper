"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "./auth-actions";
import { saveApiKey, hasApiKey, getApiKey } from "@/lib/vault";
import { createOpenAIClient } from "@/lib/gpt";
import {
  getTeacherQuestionCardSets,
  isMissingQuestionCardSetsTable,
  normalizeQuestionCardSetInput,
} from "@/lib/question-card-sets";
import type { QuestionCardSet } from "@/features/activities/types";

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

export async function getQuestionCardSettings(): Promise<{ cardSets: QuestionCardSet[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { cardSets: [], error: "로그인이 필요합니다." };

  try {
    const admin = createSupabaseAdminClient();
    const cardSets = await getTeacherQuestionCardSets(admin, user.id);
    return { cardSets };
  } catch (error) {
    const message = error instanceof Error ? error.message : "질문 카드 설정을 불러오지 못했습니다.";
    return { cardSets: [], error: message };
  }
}

export async function saveQuestionCardSetting(input: {
  id?: string;
  label: string;
  description: string;
  prompts: string[];
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
    sort_order: Number.isFinite(input.sortOrder) ? Math.max(0, Math.trunc(input.sortOrder)) : 0,
  };

  if (normalized.id) {
    const { data, error } = await admin
      .schema("writing_helper")
      .from("question_card_sets")
      .update(payload)
      .eq("id", normalized.id)
      .eq("teacher_id", user.id)
      .select("id, label, description, prompts")
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
          }
        : normalized,
    };
  }

  const { data, error } = await admin
    .schema("writing_helper")
    .from("question_card_sets")
    .insert(payload)
    .select("id, label, description, prompts")
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
    },
  };
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
