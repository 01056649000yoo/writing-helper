import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const SERVICE_SETTINGS_ID = "singleton";

export type ServiceSettingsRow = {
  id: string;
  admin_email: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function getServiceSettings() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("service_settings")
    .select("id, admin_email, created_at, updated_at")
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
