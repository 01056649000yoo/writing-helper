import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getApiKey } from "@/lib/vault";

const SERVICE_SETTINGS_ID = "singleton";
const GLOBAL_API_KEY_OWNER = "service_global";

export type ServiceSettingsRow = {
  id: string;
  admin_email: string | null;
  global_vault_secret_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TeacherApiAccess = {
  apiKey: string;
  usedSharedApi: boolean;
  ownerEmail: string | null;
};

export type ServiceAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export type ApiUsageLogInput = {
  teacherId: string;
  feature: string;
  model?: string | null;
  requestCount?: number;
  usedSharedApi: boolean;
  roomId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getGlobalApiKeySecretOwner() {
  return GLOBAL_API_KEY_OWNER;
}

export async function getServiceSettings() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("service_settings")
    .select("id, admin_email, global_vault_secret_id, created_at, updated_at")
    .eq("id", SERVICE_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (error.message.includes("service_settings")) return null;
    throw new Error(error.message);
  }
  return data as ServiceSettingsRow | null;
}

export async function ensureServiceSettingsRow() {
  const admin = createSupabaseAdminClient();
  await admin
    .schema("writing_helper")
    .from("service_settings")
    .upsert({ id: SERVICE_SETTINGS_ID }, { onConflict: "id" });
}

export async function claimServiceAdmin(email: string) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  await ensureServiceSettingsRow();

  const current = await getServiceSettings();
  if (current?.admin_email && normalizeEmail(current.admin_email) !== normalizedEmail) {
    throw new Error("서비스 관리자만 공용 설정을 변경할 수 있습니다.");
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("service_settings")
    .update({
      admin_email: normalizedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", SERVICE_SETTINGS_ID);

  if (error) throw new Error(error.message);
}

export async function getServiceAdminState(user: User | null) {
  const configuredSettings = await getServiceSettings();
  const configuredAdminEmail = normalizeEmail(process.env.SERVICE_ADMIN_EMAIL) || normalizeEmail(configuredSettings?.admin_email);
  const currentUserEmail = normalizeEmail(user?.email);
  const hasAdmin = configuredAdminEmail.length > 0;

  return {
    adminEmail: configuredAdminEmail || null,
    hasAdmin,
    isAdmin: currentUserEmail.length > 0 && (!hasAdmin || currentUserEmail === configuredAdminEmail),
    hasGlobalApiKey: Boolean(configuredSettings?.global_vault_secret_id),
  };
}

export async function requireServiceAdmin(user: User | null) {
  const state = await getServiceAdminState(user);
  if (!user || !user.email) {
    throw new Error("로그인이 필요합니다.");
  }
  if (!state.isAdmin) {
    throw new Error("서비스 관리자만 접근할 수 있습니다.");
  }
  if (!state.hasAdmin) {
    await claimServiceAdmin(user.email);
    return {
      adminEmail: normalizeEmail(user.email),
      isAdmin: true,
    };
  }
  return state;
}

export async function getSharedOpenAiKey(): Promise<{ apiKey?: string; error?: string; ownerEmail?: string | null }> {
  const settings = await getServiceSettings();
  const ownerEmail = normalizeEmail(process.env.SERVICE_ADMIN_EMAIL) || normalizeEmail(settings?.admin_email) || null;

  if (settings?.global_vault_secret_id) {
    const apiKey = await getApiKey(settings.global_vault_secret_id);
    if (apiKey) return { apiKey, ownerEmail };
    return { error: "공용 OpenAI API 키를 불러올 수 없습니다.", ownerEmail };
  }

  return { error: "공용 OpenAI API 키가 등록되어 있지 않습니다. 서비스 관리자 대시보드에서 먼저 등록해 주세요.", ownerEmail };
}

export async function getTeacherOpenAiAccess(teacherId: string): Promise<{ access?: TeacherApiAccess; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .schema("writing_helper")
    .from("teacher_profiles")
    .select("vault_secret_id, use_shared_api_key")
    .eq("user_id", teacherId)
    .maybeSingle();

  if (error) return { error: error.message };

  if (profile?.use_shared_api_key !== false) {
    const shared = await getSharedOpenAiKey();
    if (shared.error || !shared.apiKey) return { error: shared.error ?? "공용 OpenAI API 키를 불러올 수 없습니다." };
    return {
      access: {
        apiKey: shared.apiKey,
        usedSharedApi: true,
        ownerEmail: shared.ownerEmail ?? null,
      },
    };
  }

  if (!profile?.vault_secret_id) {
    return { error: "이 교사는 공용 API 사용이 꺼져 있고 개인 OpenAI API 키도 등록되어 있지 않습니다." };
  }

  const apiKey = await getApiKey(profile.vault_secret_id);
  if (!apiKey) return { error: "교사의 개인 OpenAI API 키를 불러올 수 없습니다." };

  return {
    access: {
      apiKey,
      usedSharedApi: false,
      ownerEmail: null,
    },
  };
}

export async function logServiceAudit(input: ServiceAuditLogInput) {
  const admin = createSupabaseAdminClient();
  await admin
    .schema("writing_helper")
    .from("service_audit_logs")
    .insert({
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      target_user_id: input.targetUserId ?? null,
      target_email: input.targetEmail ?? null,
      metadata: input.metadata ?? {},
    });
}

export async function logApiUsage(input: ApiUsageLogInput) {
  const admin = createSupabaseAdminClient();
  await admin
    .schema("writing_helper")
    .from("api_usage_logs")
    .insert({
      teacher_id: input.teacherId,
      feature: input.feature,
      model: input.model ?? null,
      request_count: input.requestCount ?? 1,
      used_shared_api: input.usedSharedApi,
      room_id: input.roomId ?? null,
      session_id: input.sessionId ?? null,
      metadata: input.metadata ?? {},
    });
}
