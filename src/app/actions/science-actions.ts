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
  InquiryTrack,
  SkillKey,
  SkillSettings,
  SkillData,
} from "@/types/science";
import type { RoomStudent } from "@/types";
import { SKILL_META, TRACK_META } from "@/types/science";

// ─────────────────────────────────────────
// 헬퍼: DB row → ScienceRoom
// ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScienceRoom(row: any): ScienceRoom {
  const inquiryTrack: InquiryTrack | null =
    row.inquiry_track === "basic" || row.inquiry_track === "integrated"
      ? row.inquiry_track
      : null;
  const enabledSkills: SkillKey[] = Array.isArray(row.enabled_skills)
    ? (row.enabled_skills as string[]).filter((s): s is SkillKey => s in SKILL_META)
    : [];

  return {
    id: row.id,
    teacher_id: row.teacher_id,
    class_id: row.class_id ?? null,
    title: row.title,
    topic: row.topic,
    instructions: row.instructions,
    inquiryTrack,
    enabledSkills,
    skillSettings: (row.skill_settings ?? {}) as SkillSettings,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToScienceSession(row: any): ScienceSession {
  const completedSkills: SkillKey[] = Array.isArray(row.completed_skills)
    ? (row.completed_skills as string[]).filter((s): s is SkillKey => s in SKILL_META)
    : [];

  return {
    id: row.id,
    room_id: row.room_id,
    student_number: row.student_number,
    student_name: row.student_name,
    skillData: (row.skill_data ?? {}) as SkillData,
    completedSkills,
    before_state: row.before_state ?? "",
    after_state: row.after_state ?? "",
    sense_tags: (row.sense_tags ?? []) as SenseTag[],
    measurements: (row.measurements ?? []) as MeasurementEntry[],
    drawing_data: row.drawing_data ?? "",
    inference_text: row.inference_text ?? "",
    counter_text: row.counter_text ?? "",
    question_type: row.question_type ?? "",
    question_text: row.question_text ?? "",
    ai_summary: row.ai_summary ?? "",
    current_step: row.current_step as ScienceStep,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────
// 교사: 방 생성
// ─────────────────────────────────────────
export async function createScienceRoom(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  const inquiryTrackRaw = String(formData.get("inquiry_track") ?? "");
  const inquiryTrack: InquiryTrack | null =
    inquiryTrackRaw === "basic" || inquiryTrackRaw === "integrated" ? inquiryTrackRaw : null;

  if (!inquiryTrack) return { error: "탐구 과정(기초/통합)을 선택해주세요." };

  const enabledSkillsRaw = formData.getAll("enabled_skills").map(String);
  const allowedSkillsForTrack = new Set<SkillKey>(TRACK_META[inquiryTrack].skills);
  const enabledSkills = enabledSkillsRaw.filter(
    (s): s is SkillKey => (s in SKILL_META) && allowedSkillsForTrack.has(s as SkillKey),
  );

  if (enabledSkills.length === 0) {
    return { error: "탐구 활동을 1개 이상 선택해주세요." };
  }

  let skillSettings: SkillSettings = {};
  const skillSettingsRaw = String(formData.get("skill_settings_json") ?? "").trim();
  if (skillSettingsRaw) {
    try {
      skillSettings = JSON.parse(skillSettingsRaw) as SkillSettings;
    } catch {
      return { error: "세부 설정 데이터가 올바르지 않습니다." };
    }
  }

  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 1), 48);

  // 호환을 위해 legacy 컬럼도 신규 설정에서 파생하여 채워준다.
  const obs = skillSettings.observation;
  const meas = skillSettings.measurement;
  const inf = skillSettings.inference;
  const vc = skillSettings.variable_control;
  const comm = skillSettings.communication;

  const { data, error } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .insert({
      teacher_id: user.id,
      class_id: formData.get("class_id") || null,
      title: String(formData.get("title") ?? "").trim(),
      topic: String(formData.get("topic") ?? "").trim(),
      instructions: String(formData.get("instructions") ?? "").trim(),
      inquiry_track: inquiryTrack,
      enabled_skills: enabledSkills,
      skill_settings: skillSettings,
      // legacy mirrors (있는 값만)
      use_before_after: obs?.useBeforeAfter ?? false,
      enabled_senses: obs?.enabledSenses ?? [],
      enabled_measurements: (meas?.enabledMeasurements ?? []).map((m) => `${m.label}|${m.unit}`),
      custom_measurement_label: "",
      use_drawing: obs?.useDrawing ?? false,
      use_inference_template: inf?.useTemplate ?? false,
      use_counter_argument: inf?.useCounterArgument ?? false,
      enabled_variable_cards: vc?.enabledVariableCards ?? [],
      use_peer_review: comm?.usePeerReview ?? false,
      use_ai_summary: comm?.useAiSummary ?? false,
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

export async function getScienceRoomStudents(roomId: string): Promise<RoomStudent[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("science_rooms")
    .select("class_id, teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) return [];

  if (room.class_id) {
    const { data } = await admin
      .schema("writing_helper")
      .from("class_students")
      .select("*")
      .eq("class_id", room.class_id)
      .order("student_number");
    return (data ?? []).map((student) => ({ ...student, room_id: roomId }));
  }

  return [];
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

  return data ? rowToScienceSession(data) : null;
}

// ─────────────────────────────────────────
// 학생: 스킬별 데이터 저장 (신규)
// ─────────────────────────────────────────
export async function saveScienceSkill<K extends SkillKey>(
  sessionId: string,
  skill: K,
  data: NonNullable<SkillData[K]>,
  options?: { markComplete?: boolean; finalizeSession?: boolean },
) {
  const admin = createSupabaseAdminClient();

  // 현재 skill_data 와 completed_skills 가져와서 머지
  const { data: row, error: readErr } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .select("skill_data, completed_skills")
    .eq("id", sessionId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: "세션을 찾을 수 없습니다." };

  const skillData = { ...((row.skill_data ?? {}) as SkillData), [skill]: data };
  let completedSkills = (row.completed_skills ?? []) as string[];
  if (options?.markComplete && !completedSkills.includes(skill)) {
    completedSkills = [...completedSkills, skill];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    skill_data: skillData,
    completed_skills: completedSkills,
  };
  if (options?.finalizeSession) {
    updatePayload.status = "done";
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .update(updatePayload)
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────
// 학생: 1단계(관찰) 저장 — legacy
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
// 학생: 2단계(추론) 저장 — legacy
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
// 학생: 3단계(질문) 저장 + 완료 — legacy
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

  return (data ?? []).map(rowToScienceSession);
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
