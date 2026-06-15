"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { getServiceAdminState, logServiceAudit, requireServiceAdmin, getSharedOpenAiKey } from "@/lib/service-admin";

export type ServiceAdminUserSummary = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  hasApiKey: boolean;
  useSharedApiKey: boolean;
  classCount: number;
  roomCount: number;
  apiCallCount: number;
  sharedApiCallCount: number;
};

export type ServiceAuditLogSummary = {
  id: string;
  action: string;
  actorEmail: string;
  targetEmail: string;
  createdAt: string;
  metadata: string;
};

export type ServiceAdminDashboardData = {
  adminEmail: string | null;
  hasGlobalApiKey: boolean;
  stats: {
    teacherCount: number;
    classCount: number;
    roomCount: number;
    activeRoomCount: number;
    studentSessionCount: number;
    completedSessionCount: number;
    totalApiCallCount: number;
    sharedApiCallCount: number;
  };
  users: ServiceAdminUserSummary[];
  auditLogs: ServiceAuditLogSummary[];
};

export async function getServiceAdminDashboardData(): Promise<{ data?: ServiceAdminDashboardData; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  try {
    const state = await requireServiceAdmin(user);
    const admin = createSupabaseAdminClient();

    const [usersResult, profilesResult, classesResult, roomsResult, sessionsResult, usageResult, auditResult, sharedKeyResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      admin.schema("writing_helper").from("teacher_profiles").select("user_id, name, vault_secret_id, created_at, use_shared_api_key"),
      admin.schema("writing_helper").from("classes").select("teacher_id"),
      admin.schema("writing_helper").from("rooms").select("teacher_id, is_active"),
      admin.schema("writing_helper").from("student_sessions").select("status"),
      admin.schema("writing_helper").from("api_usage_logs").select("teacher_id, request_count, used_shared_api"),
      admin.schema("writing_helper").from("service_audit_logs").select("id, action, actor_email, target_email, metadata, created_at").order("created_at", { ascending: false }).limit(20),
      getSharedOpenAiKey(),
    ]);

    if (usersResult.error) return { error: usersResult.error.message };
    if (profilesResult.error) return { error: profilesResult.error.message };
    if (classesResult.error) return { error: classesResult.error.message };
    if (roomsResult.error) return { error: roomsResult.error.message };
    if (sessionsResult.error) return { error: sessionsResult.error.message };
    if (usageResult.error) return { error: usageResult.error.message };
    if (auditResult.error) return { error: auditResult.error.message };

    const profileByUserId = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile] as const));
    const classCountByTeacher = new Map<string, number>();
    const roomCountByTeacher = new Map<string, number>();
    const apiCountByTeacher = new Map<string, { total: number; shared: number }>();

    for (const row of classesResult.data ?? []) {
      classCountByTeacher.set(row.teacher_id, (classCountByTeacher.get(row.teacher_id) ?? 0) + 1);
    }
    for (const row of roomsResult.data ?? []) {
      roomCountByTeacher.set(row.teacher_id, (roomCountByTeacher.get(row.teacher_id) ?? 0) + 1);
    }
    for (const row of usageResult.data ?? []) {
      const current = apiCountByTeacher.get(row.teacher_id) ?? { total: 0, shared: 0 };
      const nextTotal = current.total + (row.request_count ?? 1);
      const nextShared = current.shared + (row.used_shared_api ? (row.request_count ?? 1) : 0);
      apiCountByTeacher.set(row.teacher_id, { total: nextTotal, shared: nextShared });
    }

    const users: ServiceAdminUserSummary[] = (usersResult.data.users ?? []).map((authUser) => {
      const profile = profileByUserId.get(authUser.id);
      const usage = apiCountByTeacher.get(authUser.id) ?? { total: 0, shared: 0 };
      return {
        id: authUser.id,
        email: authUser.email ?? "",
        name: profile?.name ?? (String(authUser.user_metadata?.name ?? "").trim() || "-"),
        createdAt: profile?.created_at ?? authUser.created_at,
        hasApiKey: Boolean(profile?.vault_secret_id),
        useSharedApiKey: profile?.use_shared_api_key !== false,
        classCount: classCountByTeacher.get(authUser.id) ?? 0,
        roomCount: roomCountByTeacher.get(authUser.id) ?? 0,
        apiCallCount: usage.total,
        sharedApiCallCount: usage.shared,
      };
    }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const roomRows = roomsResult.data ?? [];
    const sessionRows = sessionsResult.data ?? [];
    const usageRows = usageResult.data ?? [];

    await logServiceAudit({
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      action: "service_admin_dashboard_viewed",
      metadata: { userCount: users.length },
    });

    return {
      data: {
        adminEmail: state.adminEmail ?? null,
        hasGlobalApiKey: Boolean(sharedKeyResult.apiKey),
        stats: {
          teacherCount: (profilesResult.data ?? []).length,
          classCount: (classesResult.data ?? []).length,
          roomCount: roomRows.length,
          activeRoomCount: roomRows.filter((room) => room.is_active).length,
          studentSessionCount: sessionRows.length,
          completedSessionCount: sessionRows.filter((session) => session.status === "done").length,
          totalApiCallCount: usageRows.reduce((sum, row) => sum + (row.request_count ?? 1), 0),
          sharedApiCallCount: usageRows.reduce((sum, row) => sum + (row.used_shared_api ? (row.request_count ?? 1) : 0), 0),
        },
        users,
        auditLogs: (auditResult.data ?? []).map((log) => ({
          id: log.id,
          action: log.action,
          actorEmail: log.actor_email ?? "-",
          targetEmail: log.target_email ?? "-",
          createdAt: log.created_at,
          metadata: JSON.stringify(log.metadata ?? {}),
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리자 대시보드 정보를 불러오지 못했습니다.";
    return { error: message };
  }
}

export async function isCurrentUserServiceAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;
  const state = await getServiceAdminState(user);
  return state.isAdmin;
}

export async function redirectIfNotServiceAdmin() {
  const user = await getCurrentUser();
  const state = await getServiceAdminState(user);
  if (!user || !state.isAdmin) {
    redirect("/dashboard");
  }
}

export async function updateTeacherSharedApiAccess(
  teacherId: string,
  enabled: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  try {
    await requireServiceAdmin(user);
    const admin = createSupabaseAdminClient();

    const { data: targetProfile, error: targetError } = await admin
      .schema("writing_helper")
      .from("teacher_profiles")
      .select("user_id, name")
      .eq("user_id", teacherId)
      .maybeSingle();
    if (targetError) return { error: targetError.message };
    if (!targetProfile) return { error: "대상 교사를 찾지 못했습니다." };

    const { data: authUserResult } = await admin.auth.admin.getUserById(teacherId);

    const { error } = await admin
      .schema("writing_helper")
      .from("teacher_profiles")
      .update({ use_shared_api_key: enabled })
      .eq("user_id", teacherId);
    if (error) return { error: error.message };

    await logServiceAudit({
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      action: "teacher_shared_api_access_updated",
      targetUserId: teacherId,
      targetEmail: authUserResult.user?.email ?? null,
      metadata: { enabled },
    });

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "교사별 공용 API 설정을 변경하지 못했습니다." };
  }
}
