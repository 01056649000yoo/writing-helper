"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { revalidatePath } from "next/cache";
import type {
  ScienceRoom,
  ScienceSession,
  ScienceReview,
  ScienceReaction,
  SenseTag,
  MeasurementEntry,
  VariableCardType,
  ScienceStep,
} from "@/types/science";

// ─────────────────────────────────────────
// 헬퍼: DB row → ScienceRoom
// ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScienceRoom(row: any): ScienceRoom {
  return {
    id: row.id,
    teacher_id: row.teacher_id,
    class_id: row.class_id ?? null,
    title: row.title,
    topic: row.topic,
    instructions: row.instructions,
    config: {
      useBeforeAfter: row.use_before_after,
      enabledSenses: row.enabled_senses ?? [],
      enabledMeasurements: (row.enabled_measurements ?? []).map((m: string) => {
        const [label, unit] = m.split("|");
        return { label, unit };
      }),
      customMeasurementLabel: row.custom_measurement_label ?? "",
      useDrawing: row.use_drawing,
      useInferenceTemplate: row.use_inference_template,
      useCounterArgument: row.use_counter_argument,
      enabledVariableCards: row.enabled_variable_cards ?? [],
      usePeerReview: row.use_peer_review,
      useAiSummary: row.use_ai_summary,
    },
    is_active: row.is_active,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at,
  };
}

// ─────────────────────────────────────────
// 교사: 방 생성
// ─────────────────────────────────────────
export async function createScienceRoom(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  const enabledMeasurements = formData.getAll("enabled_measurements") as string[];
  const enabledSenses = formData.getAll("enabled_senses") as string[];
  const enabledVariableCards = formData.getAll("enabled_variable_cards") as string[];
  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 1), 48);

  const { data, error } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .insert({
      teacher_id: user.id,
      class_id: formData.get("class_id") || null,
      title: String(formData.get("title") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      instructions: String(formData.get("instructions") ?? "").trim(),
      use_before_after: formData.get("use_before_after") === "on",
      enabled_senses: enabledSenses,
      enabled_measurements: enabledMeasurements,
      custom_measurement_label: String(formData.get("custom_measurement_label") ?? "").trim(),
      use_drawing: formData.get("use_drawing") === "on",
      use_inference_template: formData.get("use_inference_template") === "on",
      use_counter_argument: formData.get("use_counter_argument") === "on",
      enabled_variable_cards: enabledVariableCards,
      use_peer_review: formData.get("use_peer_review") === "on",
      use_ai_summary: formData.get("use_ai_summary") === "on",
      is_active: true,
      expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { roomId: data.id };
}

// ─────────────────────────────────────────
// 교사: 방 목록 조회
// ─────────────────────────────────────────
export async function getScienceRooms(): Promise<ScienceRoom[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map(rowToScienceRoom);
}

// ─────────────────────────────────────────
// 교사: 방 상세 조회
// ─────────────────────────────────────────
export async function getScienceRoom(roomId: string): Promise<ScienceRoom | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  return data ? rowToScienceRoom(data) : null;
}

// ─────────────────────────────────────────
// 교사: 방 종료
// ─────────────────────────────────────────
export async function closeScienceRoom(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  await admin
    .schema("writing_helper")
    .from("science_rooms")
    .update({ is_active: false })
    .eq("id", roomId)
    .eq("teacher_id", user.id);

  revalidatePath(`/dashboard/science/${roomId}`);
}

// ─────────────────────────────────────────
// 학생: 방 정보 조회 (활성 방만)
// ─────────────────────────────────────────
export async function getActiveScienceRoom(roomId: string): Promise<ScienceRoom | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("writing_helper")
    .from("science_rooms")
    .select("*")
    .eq("id", roomId)
    .eq("is_active", true)
    .single();

  return data ? rowToScienceRoom(data) : null;
}

// ─────────────────────────────────────────
// 학생: 입장 검증 + 세션 생성 (기존 있으면 재사용)
// ─────────────────────────────────────────
export async function verifyScienceStudent(
  roomId: string,
  studentNumber: number,
  studentName: string,
): Promise<{ sessionId: string; currentStep: number } | { error: string }> {
  if (!roomId || roomId.length > 100) return { error: "잘못된 요청입니다." };
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 100)
    return { error: "출석 번호는 1~100 사이여야 합니다." };
  if (!studentName || studentName.trim().length === 0 || studentName.length > 50)
    return { error: "이름을 올바르게 입력해주세요." };

  const admin = createSupabaseAdminClient();

  // 방 확인
  const { data: room } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .select("id, is_active, expires_at, class_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "활동 방을 찾을 수 없습니다." };
  if (!room.is_active) return { error: "이미 종료된 활동입니다." };
  if (room.expires_at && new Date(room.expires_at) < new Date())
    return { error: "활동 시간이 만료됐습니다." };

  // 학생 명단 검증 (class_students)
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

  // 기존 세션 재사용
  const { data: existing } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .select("id, current_step")
    .eq("room_id", roomId)
    .eq("student_number", studentNumber)
    .eq("student_name", studentName)
    .maybeSingle();

  if (existing) return { sessionId: existing.id, currentStep: existing.current_step };

  // 새 세션 생성
  const { data, error } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .insert({ room_id: roomId, student_number: studentNumber, student_name: studentName })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { sessionId: data.id, currentStep: 1 };
}

// ─────────────────────────────────────────
// 교사: 학급별 과학 활동 목록
// ─────────────────────────────────────────
export async function getClassScienceRooms(classId: string): Promise<ScienceRoom[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .select("*")
    .eq("class_id", classId)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map(rowToScienceRoom);
}

// ─────────────────────────────────────────
// 학생: 세션 조회
// ─────────────────────────────────────────
export async function getScienceSession(sessionId: string): Promise<ScienceSession | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!data) return null;
  return {
    ...data,
    sense_tags: (data.sense_tags ?? []) as SenseTag[],
    measurements: (data.measurements ?? []) as MeasurementEntry[],
    current_step: data.current_step as ScienceStep,
  };
}

// ─────────────────────────────────────────
// 학생: 1단계(관찰) 저장
// ─────────────────────────────────────────
export async function saveScienceStep1(
  sessionId: string,
  payload: {
    beforeState: string;
    afterState: string;
    senseTags: SenseTag[];
    measurements: MeasurementEntry[];
    drawingData: string;
  },
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .update({
      before_state: payload.beforeState,
      after_state: payload.afterState,
      sense_tags: payload.senseTags,
      measurements: payload.measurements,
      drawing_data: payload.drawingData,
      current_step: 2,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────
// 학생: 2단계(추론) 저장
// ─────────────────────────────────────────
export async function saveScienceStep2(
  sessionId: string,
  payload: { inferenceText: string; counterText: string },
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .update({
      inference_text: payload.inferenceText,
      counter_text: payload.counterText,
      current_step: 3,
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────
// 학생: 3단계(질문) 저장 + 완료
// ─────────────────────────────────────────
export async function saveScienceStep3(
  sessionId: string,
  payload: { questionType: VariableCardType | string; questionText: string },
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .update({
      question_type: payload.questionType,
      question_text: payload.questionText,
      current_step: 4,
      status: "done",
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────
// 동료 리뷰: 반응 토글
// ─────────────────────────────────────────
export async function toggleScienceReview(
  roomId: string,
  reviewerSessionId: string,
  targetSessionId: string,
  reaction: ScienceReaction,
): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .schema("writing_helper")
    .from("science_reviews")
    .select("id")
    .eq("reviewer_session_id", reviewerSessionId)
    .eq("target_session_id", targetSessionId)
    .eq("reaction", reaction)
    .single();

  if (existing) {
    await admin.schema("writing_helper").from("science_reviews").delete().eq("id", existing.id);
  } else {
    await admin.schema("writing_helper").from("science_reviews").insert({
      room_id: roomId,
      reviewer_session_id: reviewerSessionId,
      target_session_id: targetSessionId,
      reaction,
    });
  }
  return { ok: true };
}

// ─────────────────────────────────────────
// 교사 모니터링: 전체 세션 + 리뷰 조회
// ─────────────────────────────────────────
export async function getScienceRoomSessions(roomId: string): Promise<ScienceSession[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    ...row,
    sense_tags: (row.sense_tags ?? []) as SenseTag[],
    measurements: (row.measurements ?? []) as MeasurementEntry[],
    current_step: row.current_step as ScienceStep,
  }));
}

export async function getScienceRoomReviews(roomId: string): Promise<ScienceReview[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("science_reviews")
    .select("*")
    .eq("room_id", roomId);

  return (data ?? []) as ScienceReview[];
}
