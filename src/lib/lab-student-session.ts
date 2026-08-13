import "server-only";

import { isIntegratedLab } from "@/lib/lab-roster";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type IntegratedStudent = {
  id: string;
  class_id: string;
  name: string;
};

export type IntegratedStudentEntry = {
  error?: string;
  studentId?: string;
  sessionId?: string;
  status?: string;
};

async function getAuthenticatedIntegratedStudent(
  admin: AdminClient,
): Promise<IntegratedStudent | null> {
  if (!isIntegratedLab()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: student, error } = await admin
    .from("students")
    .select("id, class_id, name")
    .eq("auth_id", authData.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  return error ? null : student;
}

async function getStudentDisplayNumber(
  admin: AdminClient,
  student: IntegratedStudent,
) {
  const { data, error } = await admin
    .from("students")
    .select("id")
    .eq("class_id", student.class_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")
    .order("id")
    .limit(100);

  if (error) return null;
  const index = (data ?? []).findIndex((row) => row.id === student.id);
  return index >= 0 ? index + 1 : null;
}

export async function ensureIntegratedStudentRoomSession(
  roomId: string,
): Promise<IntegratedStudentEntry> {
  if (!isIntegratedLab()) {
    return { error: "통합 연구소에서만 사용할 수 있습니다." };
  }
  if (!roomId || roomId.length > 100) {
    return { error: "잘못된 활동 주소입니다." };
  }

  const admin = createSupabaseAdminClient();
  const student = await getAuthenticatedIntegratedStudent(admin);
  if (!student) {
    return { error: "끄적끄적 아지트 학생 계정으로 먼저 로그인해주세요." };
  }

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, agit_class_id, is_active, expires_at")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "활동을 찾을 수 없습니다." };
  if (room.agit_class_id !== student.class_id) {
    return { error: "내 학급의 활동이 아닙니다." };
  }
  if (!room.is_active) return { error: "이미 종료된 활동입니다." };
  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return { error: "활동 시간이 만료됐습니다." };
  }

  const { data: existing } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, status")
    .eq("room_id", roomId)
    .eq("agit_student_id", student.id)
    .maybeSingle();

  if (existing) {
    return {
      studentId: student.id,
      sessionId: existing.id,
      status: existing.status,
    };
  }

  const studentNumber = await getStudentDisplayNumber(admin, student);
  if (!studentNumber) {
    return { error: "학급 명단에서 학생 정보를 확인하지 못했습니다." };
  }

  const { data: session, error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .insert({
      room_id: roomId,
      room_student_id: null,
      agit_student_id: student.id,
      student_number: studentNumber,
      student_name: student.name,
    })
    .select("id, status")
    .single();

  if (error?.code === "23505") {
    const { data: racedSession } = await admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, status")
      .eq("room_id", roomId)
      .eq("agit_student_id", student.id)
      .maybeSingle();

    if (racedSession) {
      return {
        studentId: student.id,
        sessionId: racedSession.id,
        status: racedSession.status,
      };
    }
  }

  if (error || !session) {
    return { error: "학생 활동을 준비하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  return {
    studentId: student.id,
    sessionId: session.id,
    status: session.status,
  };
}

export async function ownsIntegratedStudentSession(
  admin: AdminClient,
  sessionId: string,
  roomId?: string,
) {
  if (!isIntegratedLab()) return true;
  if (!sessionId) return false;

  const student = await getAuthenticatedIntegratedStudent(admin);
  if (!student) return false;

  let query = admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("agit_student_id", student.id);

  if (roomId) {
    query = query.eq("room_id", roomId);
  }

  const { data, error } = await query.maybeSingle();
  return !error && Boolean(data);
}
