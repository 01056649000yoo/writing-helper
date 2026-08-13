"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { getServiceAdminState, logServiceAudit, requireServiceAdmin } from "@/lib/service-admin";

export type ServiceAdminUserSummary = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  classCount: number;
  roomCount: number;
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
  stats: {
    teacherCount: number;
    classCount: number;
    roomCount: number;
    activeRoomCount: number;
    studentSessionCount: number;
    completedSessionCount: number;
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

    const [usersResult, profilesResult, classesResult, roomsResult, sessionsResult, auditResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      admin.schema("writing_helper").from("teacher_profiles").select("user_id, name, created_at"),
      admin.schema("writing_helper").from("classes").select("teacher_id"),
      admin.schema("writing_helper").from("rooms").select("teacher_id, is_active"),
      admin.schema("writing_helper").from("student_sessions").select("status"),
      admin.schema("writing_helper").from("service_audit_logs").select("id, action, actor_email, target_email, metadata, created_at").not("action", "ilike", "%api%").order("created_at", { ascending: false }).limit(20),
    ]);

    if (usersResult.error) return { error: usersResult.error.message };
    if (profilesResult.error) return { error: profilesResult.error.message };
    if (classesResult.error) return { error: classesResult.error.message };
    if (roomsResult.error) return { error: roomsResult.error.message };
    if (sessionsResult.error) return { error: sessionsResult.error.message };
    if (auditResult.error) return { error: auditResult.error.message };

    const profileByUserId = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile] as const));
    const classCountByTeacher = new Map<string, number>();
    const roomCountByTeacher = new Map<string, number>();

    for (const row of classesResult.data ?? []) {
      classCountByTeacher.set(row.teacher_id, (classCountByTeacher.get(row.teacher_id) ?? 0) + 1);
    }
    for (const row of roomsResult.data ?? []) {
      roomCountByTeacher.set(row.teacher_id, (roomCountByTeacher.get(row.teacher_id) ?? 0) + 1);
    }
    const users: ServiceAdminUserSummary[] = (usersResult.data.users ?? []).map((authUser) => {
      const profile = profileByUserId.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email ?? "",
        name: profile?.name ?? (String(authUser.user_metadata?.name ?? "").trim() || "-"),
        createdAt: profile?.created_at ?? authUser.created_at,
        classCount: classCountByTeacher.get(authUser.id) ?? 0,
        roomCount: roomCountByTeacher.get(authUser.id) ?? 0,
      };
    }).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const roomRows = roomsResult.data ?? [];
    const sessionRows = sessionsResult.data ?? [];

    await logServiceAudit({
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      action: "service_admin_dashboard_viewed",
      metadata: { userCount: users.length },
    });

    return {
      data: {
        adminEmail: state.adminEmail ?? null,
        stats: {
          teacherCount: (profilesResult.data ?? []).length,
          classCount: (classesResult.data ?? []).length,
          roomCount: roomRows.length,
          activeRoomCount: roomRows.filter((room) => room.is_active).length,
          studentSessionCount: sessionRows.length,
          completedSessionCount: sessionRows.filter((session) => session.status === "done").length,
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
