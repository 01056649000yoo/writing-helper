"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser, getTeacherProfile } from "./auth-actions";
import { getApiKey } from "@/lib/vault";
import { generateQuestionSets } from "@/lib/gpt";
import { getTeacherQuestionCardSets } from "@/lib/question-card-sets";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";
import type {
  ActivityType,
  OutlineBuilderConfig,
  QuestionGeneratorConfig,
  QuestionVotingConfig,
} from "@/features/activities/types";
import type { SubjectType, GradeLevel, OutlineDepth, RoomStudent, QuestionSets } from "@/types";

/** 1단계: 질문 세트만 생성해서 반환 (세션 저장 안함) */
export async function generateQuestionsPreview(formData: FormData): Promise<{ questionSets?: QuestionSets; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const profile = await getTeacherProfile();
  if (!profile?.vault_secret_id) return { error: "GPT API 키를 먼저 설정해주세요." };

  const topic = String(formData.get("topic") ?? "").trim();
  const topicDescription = String(formData.get("topic_description") ?? "").trim();
  const subjectType = String(formData.get("subject_type")) as SubjectType;
  const gradeLevel = String(formData.get("grade_level")) as GradeLevel;
  const outlineDepth = (String(formData.get("outline_depth")) || "simple") as OutlineDepth;

  if (!topic) return { error: "주제를 입력해주세요." };

  const apiKey = await getApiKey(profile.vault_secret_id);
  if (!apiKey) return { error: "GPT API 키를 불러올 수 없습니다." };

  try {
    const questionSets = await generateQuestionSets(apiKey, topic, topicDescription, subjectType, gradeLevel, outlineDepth);
    return { questionSets };
  } catch {
    return { error: "질문 생성에 실패했습니다. API 키를 확인해주세요." };
  }
}

/** 2단계: 수정된 질문 세트로 활동 세션 저장 */
export async function createRoom(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const classId = String(formData.get("class_id") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const topicDescription = String(formData.get("topic_description") ?? "").trim();
  const activityType = parseActivityType(formData.get("activity_type"));
  const subjectType = String(formData.get("subject_type")) as SubjectType;
  const gradeLevel = String(formData.get("grade_level")) as GradeLevel;
  const outlineDepth = (String(formData.get("outline_depth")) || "simple") as OutlineDepth;
  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 4), 48);
  const questionSetsJson = String(formData.get("question_sets_json") ?? "").trim();

  if (!classId) return { error: "학급을 선택해주세요." };
  if (!topic) return { error: "주제를 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  const baseRoomPayload: {
    teacher_id: string;
    class_id: string;
    title: string;
    topic: string;
    topic_description: string;
    subject_type: SubjectType;
    grade_level: GradeLevel;
    outline_depth: OutlineDepth;
    question_sets: QuestionSets | null;
    questions_generated_at: string | null;
    expires_at: string;
    is_active: boolean;
  } = {
    teacher_id: user.id,
    class_id: classId,
    title: topic,
    topic,
    topic_description: topicDescription,
    subject_type: subjectType,
    grade_level: gradeLevel,
    outline_depth: outlineDepth,
    question_sets: null,
    questions_generated_at: null,
    expires_at: expiresAt,
    is_active: true,
  };

  let activityConfig: OutlineBuilderConfig | QuestionGeneratorConfig | QuestionVotingConfig;

  if (activityType === "outline_builder") {
    const profile = await getTeacherProfile();
    if (!profile?.vault_secret_id) return { error: "GPT API 키를 먼저 설정해주세요." };

    if (!questionSetsJson) return { error: "문항을 먼저 생성해주세요." };

    let questionSets: QuestionSets;
    try {
      questionSets = JSON.parse(questionSetsJson) as QuestionSets;
    } catch {
      return { error: "문항 데이터가 올바르지 않습니다." };
    }

    const questionsGeneratedAt = new Date().toISOString();
    activityConfig = {
      subjectType,
      gradeLevel,
      outlineDepth,
      questionSets,
      questionsGeneratedAt,
    };
    baseRoomPayload.question_sets = questionSets;
    baseRoomPayload.questions_generated_at = questionsGeneratedAt;
  } else if (activityType === "question_generator") {
    const teacherCardSets = await getTeacherQuestionCardSets(admin, user.id);
    const allowedIds = new Set(teacherCardSets.map((cardSet) => cardSet.id));
    const enabledCardSetIds = formData
      .getAll("enabled_card_set_ids")
      .map((value) => String(value))
      .filter((value): value is string => allowedIds.has(value));
    const guidance = String(formData.get("guidance") ?? "").trim()
      || "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.";

    if (enabledCardSetIds.length === 0) {
      return { error: "질문 카드 묶음을 1개 이상 선택해주세요." };
    }

    activityConfig = {
      enabledCardSetIds,
      cardSets: teacherCardSets.filter((cardSet) => enabledCardSetIds.includes(cardSet.id)),
      maxSelections: clampNumber(formData.get("max_selections"), 1, 4, 1),
      guidance,
      requireReason: formData.get("require_reason") !== null,
      allowCustomQuestion: formData.get("allow_custom_question") === "on",
    };
  } else {
    const candidateLines = String(formData.get("candidates") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (candidateLines.length === 0) {
      return { error: "질문 후보를 1개 이상 입력해주세요." };
    }

    const candidates = candidateLines.map((text, index) => ({
      id: `candidate-${index + 1}`,
      text,
    }));

    activityConfig = {
      maxSelections: clampNumber(formData.get("max_selections"), 1, candidates.length, 1),
      requireReason: formData.get("require_reason") !== "off",
      candidates,
    };
  }

  let { data: room, error: roomError } = await admin
    .schema("writing_helper")
    .from("rooms")
    .insert({
      ...baseRoomPayload,
      activity_type: activityType,
      activity_config: activityConfig,
      activity_state: {},
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id")
    .single();

  if (roomError && isMissingActivityColumnError(roomError.message)) {
    const fallback = await admin
      .schema("writing_helper")
      .from("rooms")
      .insert(baseRoomPayload)
      .select("id")
      .single();

    room = fallback.data;
    roomError = fallback.error;
  }

  if (roomError || !room) return { error: roomError?.message ?? "활동 세션 생성에 실패했습니다." };

  await ensureShortLinkForRoom(room.id, user.id, expiresAt);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/class/${classId}`);
  redirect(`/dashboard/room/${room.id}`);
}

function parseActivityType(value: FormDataEntryValue | null): ActivityType {
  return value === "question_generator" || value === "question_voting"
    ? value
    : "outline_builder";
}

function isMissingActivityColumnError(message: string) {
  return message.includes("activity_type")
    || message.includes("activity_config")
    || message.includes("activity_state");
}

function clampNumber(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

export async function deleteRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  // 종료된 활동 세션만 삭제 허용
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("is_active, class_id, teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "활동 세션을 찾을 수 없습니다." };
  if (room.teacher_id !== user.id) return { error: "권한이 없습니다." };
  if (room.is_active) return { error: "진행 중인 활동은 삭제할 수 없습니다. 먼저 종료해주세요." };

  const { error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .delete()
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  if (room.class_id) revalidatePath(`/dashboard/class/${room.class_id}`);
  return {};
}

export async function closeRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .update({ is_active: false })
    .eq("id", roomId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/room/${roomId}`);
  return {};
}

export async function getRooms() {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getRoom(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!data) return null;

  const shortCode = await getShortCodeForRoom(roomId, user.id);
  return {
    ...data,
    short_code: shortCode,
  };
}

export async function getRoomStudents(roomId: string): Promise<RoomStudent[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createSupabaseAdminClient();

  // 소유권 확인하면서 class_id도 함께 조회
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
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
    return (data ?? []).map(s => ({ ...s, room_id: roomId }));
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("room_students")
    .select("*")
    .eq("room_id", roomId)
    .order("student_number");
  return data ?? [];
}

export async function getRoomQuestions(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("topic, question_sets, teacher_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!data || data.teacher_id !== user.id) return null;
  const { teacher_id: _, ...rest } = data;
  return rest;
}

export async function getRoomSessions(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();

  // 요청한 교사가 해당 방의 소유자인지 확인
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) return [];

  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at");
  return data ?? [];
}

export type QuestionGeneratorRoomResultSummary = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  selections: Array<{
    id: string;
    method: "direct" | "card_remix";
    cardSetLabel: string;
    originalPrompt: string | null;
    remixedQuestion: string;
    reason?: string;
  }>;
};

export async function getQuestionGeneratorRoomResults(roomId: string): Promise<QuestionGeneratorRoomResultSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "question_generator") {
    return [];
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, student_number, student_name, submission")
    .eq("room_id", roomId)
    .eq("status", "done")
    .order("student_number");

  const results: QuestionGeneratorRoomResultSummary[] = (data ?? []).flatMap((session) => {
      const submission = normalizeQuestionGeneratorSubmission(session.submission);
      if (!submission) return [];

      return [{
        sessionId: session.id,
        studentNumber: session.student_number,
        studentName: session.student_name,
        selections: submission.selections.map((selection) => ({
          id: selection.id,
          method: selection.method,
          cardSetLabel: selection.cardSetLabel,
          originalPrompt: selection.originalPrompt,
          remixedQuestion: selection.remixedQuestion,
          reason: selection.reason,
        })),
      }];
    });

  return results;
}

async function getShortCodeForRoom(roomId: string, teacherId: string) {
  const admin = createSupabaseAdminClient();

  const { data: existing, error } = await admin
    .schema("writing_helper")
    .from("short_links")
    .select("code")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error && !isMissingShortLinksTableError(error.message)) {
    return null;
  }

  if (existing?.code) {
    return existing.code;
  }

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, teacher_id, expires_at")
    .eq("id", roomId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!room) return null;
  return ensureShortLinkForRoom(room.id, teacherId, room.expires_at ?? null);
}

async function ensureShortLinkForRoom(roomId: string, teacherId: string, expiresAt: string | null) {
  const admin = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode();
    const { data, error } = await admin
      .schema("writing_helper")
      .from("short_links")
      .insert({
        room_id: roomId,
        code,
        target_path: `/room/${roomId}`,
        expires_at: expiresAt,
      })
      .select("code")
      .single();

    if (!error && data?.code) {
      return data.code;
    }

    if (error && isMissingShortLinksTableError(error.message)) {
      return null;
    }

    if (error?.message.includes("short_links_room_id_key")) {
      const { data: existing } = await admin
        .schema("writing_helper")
        .from("short_links")
        .select("code")
        .eq("room_id", roomId)
        .maybeSingle();

      return existing?.code ?? null;
    }

    if (!error?.message.includes("duplicate")) {
      return null;
    }
  }

  return null;
}

function generateShortCode() {
  return randomBytes(4)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toLowerCase();
}

function isMissingShortLinksTableError(message: string) {
  return message.includes("short_links");
}
