"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "./auth-actions";
import type { ActivityType } from "@/features/activities/types";

export type ActivitySettingPreset = {
  id: string;
  activityType: ActivityType;
  title: string;
  config: Record<string, unknown>;
  createdAt: string;
};

export async function getActivitySettingPresets(activityType: ActivityType): Promise<{
  presets: ActivitySettingPreset[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { presets: [], error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("activity_setting_presets")
    .select("id, activity_type, title, config, created_at")
    .eq("teacher_id", user.id)
    .eq("activity_type", activityType)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("activity_setting_presets")) {
      return { presets: [], error: "활동 설정 저장소가 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { presets: [], error: error.message };
  }

  return {
    presets: (data ?? []).map((preset) => ({
      id: preset.id,
      activityType: normalizeActivityType(preset.activity_type),
      title: preset.title,
      config: isRecord(preset.config) ? preset.config : {},
      createdAt: preset.created_at,
    })),
  };
}

export async function saveActivitySettingPreset(input: {
  activityType: ActivityType;
  title?: string;
  config: Record<string, unknown>;
}): Promise<{ preset?: ActivitySettingPreset; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = (input.title ?? "").trim() || buildPresetTitle(input.activityType, input.config);
  const config = isRecord(input.config) ? input.config : {};
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .schema("writing_helper")
    .from("activity_setting_presets")
    .insert({
      teacher_id: user.id,
      activity_type: input.activityType,
      title,
      config,
    })
    .select("id, activity_type, title, config, created_at")
    .single();

  if (error) {
    if (error.message.includes("activity_setting_presets")) {
      return { error: "활동 설정 저장소가 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/room/new");
  return {
    preset: {
      id: data.id,
      activityType: normalizeActivityType(data.activity_type),
      title: data.title,
      config: isRecord(data.config) ? data.config : {},
      createdAt: data.created_at,
    },
  };
}

export async function deleteActivitySettingPreset(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!id) return { error: "삭제할 설정 카드를 찾을 수 없습니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("activity_setting_presets")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) {
    if (error.message.includes("activity_setting_presets")) {
      return { error: "활동 설정 저장소가 아직 준비되지 않았습니다. 마이그레이션을 먼저 적용해주세요." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/room/new");
  return {};
}

function buildPresetTitle(activityType: ActivityType, config: Record<string, unknown>) {
  const topic = typeof config.topic === "string" ? config.topic.trim() : "";
  if (topic) return topic;

  switch (activityType) {
    case "outline_builder":
      return "글 개요 짜기 설정";
    case "question_generator":
      return "질문 카드 활동 설정";
    case "question_voting":
      return "좋은 질문 고르기 설정";
    default:
      return "활동 설정";
  }
}

function normalizeActivityType(value: string): ActivityType {
  return value === "question_generator" || value === "question_voting"
    ? value
    : "outline_builder";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
