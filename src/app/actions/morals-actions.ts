"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { revalidatePath } from "next/cache";
import type {
  MoralsRoom,
  MoralsSession,
  MoralsReactionRow,
  MoralsReaction,
  MoralsTrack,
  MoralsSkillKey,
  MoralsSkillSettings,
  MoralsSkillData,
} from "@/types/morals";
import { MORALS_SKILL_META, MORALS_TRACK_META } from "@/types/morals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMoralsRoom(row: any): MoralsRoom {
  const track: MoralsTrack = row.track === "judgement" ? "judgement" : "reflection";
  const enabledSkills: MoralsSkillKey[] = Array.isArray(row.enabled_skills)
    ? (row.enabled_skills as string[]).filter((s): s is MoralsSkillKey => s in MORALS_SKILL_META)
    : [];
  return {
    id: row.id,
    teacher_id: row.teacher_id,
    class_id: row.class_id ?? null,
    title: row.title,
    topic: row.topic,
    instructions: row.instructions,
    track,
    enabledSkills,
    skillSettings: (row.skill_settings ?? {}) as MoralsSkillSettings,
    is_active: row.is_active,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMoralsSession(row: any): MoralsSession {
  const completedSkills: MoralsSkillKey[] = Array.isArray(row.completed_skills)
    ? (row.completed_skills as string[]).filter((s): s is MoralsSkillKey => s in MORALS_SKILL_META)
    : [];
  return {
    id: row.id,
    room_id: row.room_id,
    student_number: row.student_number,
    student_name: row.student_name,
    skillData: (row.skill_data ?? {}) as MoralsSkillData,
    completedSkills,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── 교사: 방 생성 ──
export async function createMoralsRoom(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const trackRaw = String(formData.get("track") ?? "");
  const track: MoralsTrack | null =
    trackRaw === "reflection" || trackRaw === "judgement" ? trackRaw : null;
  if (!track) return { error: "트랙(감정 성찰/가치 판단)을 선택해주세요." };

  const enabledSkillsRaw = formData.getAll("enabled_skills").map(String);
  const allowedSkills = new Set<MoralsSkillKey>(MORALS_TRACK_META[track].skills);
  const enabledSkills = enabledSkillsRaw.filter(
    (s): s is MoralsSkillKey => (s in MORALS_SKILL_META) && allowedSkills.has(s as MoralsSkillKey),
  );
  if (enabledSkills.length === 0) return { error: "도덕 활동을 1개 이상 선택해주세요." };

  let skillSettings: MoralsSkillSettings = {};
  const settingsRaw = String(formData.get("skill_settings_json") ?? "").trim();
  if (settingsRaw) {
    try {
      skillSettings = JSON.parse(settingsRaw) as MoralsSkillSettings;
    } catch {
      return { error: "세부 설정 데이터가 올바르지 않습니다." };
    }
  }

  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 1), 24 * 30);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .insert({
      teacher_id: user.id,
      class_id: formData.get("class_id") || null,
      title: String(formData.get("title") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      instructions: String(formData.get("instructions") ?? "").trim(),
      track,
      enabled_skills: enabledSkills,
      skill_settings: skillSettings,
      is_active: true,
      expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { roomId: data.id };
}

export async function getMoralsRoom(roomId: string): Promise<MoralsRoom | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  return data ? rowToMoralsRoom(data) : null;
}

export async function getActiveMoralsRoom(roomId: string): Promise<MoralsRoom | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("*")
    .eq("id", roomId)
    .eq("is_active", true)
    .single();
  return data ? rowToMoralsRoom(data) : null;
}

export async function getClassMoralsRooms(classId: string): Promise<MoralsRoom[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("*")
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToMoralsRoom);
}

export async function closeMoralsRoom(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const admin = createSupabaseAdminClient();
  await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .update({ is_active: false })
    .eq("id", roomId)
    .eq("teacher_id", user.id);
  revalidatePath(`/dashboard/morals/${roomId}`);
}

export async function deleteMoralsRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("is_active, class_id, teacher_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return { error: "도덕 활동을 찾을 수 없습니다." };
  if (room.teacher_id !== user.id) return { error: "권한이 없습니다." };
  if (room.is_active) return { error: "진행 중인 활동은 삭제할 수 없습니다. 먼저 종료해주세요." };
  const { error } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .delete()
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  if (room.class_id) revalidatePath(`/dashboard/class/${room.class_id}`);
  return {};
}

// ── 학생: 입장 + 세션 ──
export async function verifyMoralsStudent(
  roomId: string,
  studentNumber: number,
  studentName: string,
): Promise<{ sessionId: string } | { error: string }> {
  if (!roomId || roomId.length > 100) return { error: "잘못된 요청입니다." };
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 100)
    return { error: "출석 번호는 1~100 사이여야 합니다." };
  if (!studentName || studentName.trim().length === 0 || studentName.length > 50)
    return { error: "이름을 올바르게 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("id, is_active, expires_at, class_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "활동 방을 찾을 수 없습니다." };
  if (!room.is_active) return { error: "이미 종료된 활동입니다." };
  if (room.expires_at && new Date(room.expires_at) < new Date())
    return { error: "활동 시간이 만료됐습니다." };

  if (room.class_id) {
    const { data: cs } = await admin
      .schema("writing_helper")
      .from("class_students")
      .select("id")
      .eq("class_id", room.class_id)
      .eq("student_number", studentNumber)
      .eq("student_name", studentName)
      .maybeSingle();
    if (!cs) return { error: "번호나 이름이 명단과 다릅니다.\n선생님께 확인 후 다시 입력해주세요." };
  }

  const { data: existing } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .select("id")
    .eq("room_id", roomId)
    .eq("student_number", studentNumber)
    .eq("student_name", studentName)
    .maybeSingle();
  if (existing) return { sessionId: existing.id };

  const { data, error } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .insert({ room_id: roomId, student_number: studentNumber, student_name: studentName })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { sessionId: data.id };
}

export async function getMoralsSession(sessionId: string): Promise<MoralsSession | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  return data ? rowToMoralsSession(data) : null;
}

export async function saveMoralsSkill<K extends MoralsSkillKey>(
  sessionId: string,
  skill: K,
  data: NonNullable<MoralsSkillData[K]>,
  options?: { markComplete?: boolean; finalizeSession?: boolean },
) {
  const admin = createSupabaseAdminClient();
  const { data: row, error: readErr } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .select("skill_data, completed_skills")
    .eq("id", sessionId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: "세션을 찾을 수 없습니다." };

  const skillData = { ...((row.skill_data ?? {}) as MoralsSkillData), [skill]: data };
  let completedSkills = (row.completed_skills ?? []) as string[];
  if (options?.markComplete && !completedSkills.includes(skill)) {
    completedSkills = [...completedSkills, skill];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = { skill_data: skillData, completed_skills: completedSkills };
  if (options?.finalizeSession) updatePayload.status = "done";

  const { error } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .update(updatePayload)
    .eq("id", sessionId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function toggleMoralsReaction(
  roomId: string,
  reviewerSessionId: string,
  targetSessionId: string,
  reaction: MoralsReaction,
): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .schema("writing_helper")
    .from("morals_reactions")
    .select("id")
    .eq("reviewer_session_id", reviewerSessionId)
    .eq("target_session_id", targetSessionId)
    .eq("reaction", reaction)
    .single();
  if (existing) {
    await admin.schema("writing_helper").from("morals_reactions").delete().eq("id", existing.id);
  } else {
    await admin.schema("writing_helper").from("morals_reactions").insert({
      room_id: roomId,
      reviewer_session_id: reviewerSessionId,
      target_session_id: targetSessionId,
      reaction,
    });
  }
  return { ok: true };
}

export async function getMoralsRoomSessions(roomId: string): Promise<MoralsSession[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToMoralsSession);
}

export async function getMoralsRoomReactions(roomId: string): Promise<MoralsReactionRow[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("morals_reactions")
    .select("*")
    .eq("room_id", roomId);
  return (data ?? []) as MoralsReactionRow[];
}
