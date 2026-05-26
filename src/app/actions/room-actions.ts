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
import { buildQuestionVotingRanking, normalizeQuestionVotingSubmission, normalizeQuestionVotingConfig } from "@/lib/question-voting";
import { buildOneLineShareBoard, includesConfiguredKeyword, normalizeKeywordText, normalizeOneLineShareConfig } from "@/lib/one-line-share";
import { serializeOutlineResult } from "@/lib/result-format";
import type {
  ActivityType,
  OutlineBuilderConfig,
  OneLineShareConfig,
  OneLineShareRoomResult,
  QuestionGeneratorConfig,
  QuestionVotingConfig,
  QuestionVotingRoomResult,
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
  let topic = String(formData.get("topic") ?? "").trim();
  let topicDescription = String(formData.get("topic_description") ?? "").trim();
  const activityType = parseActivityType(formData.get("activity_type"));
  const subjectType = String(formData.get("subject_type")) as SubjectType;
  const gradeLevel = String(formData.get("grade_level")) as GradeLevel;
  const outlineDepth = (String(formData.get("outline_depth")) || "simple") as OutlineDepth;
  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 4), 48);
  const questionSetsJson = String(formData.get("question_sets_json") ?? "").trim();

  if (!classId) return { error: "학급을 선택해주세요." };

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

  let activityConfig: OutlineBuilderConfig | QuestionGeneratorConfig | QuestionVotingConfig | OneLineShareConfig;

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
    const generateDraft = formData.get("generate_draft") === "on";
    activityConfig = {
      subjectType,
      gradeLevel,
      outlineDepth,
      questionSets,
      questionsGeneratedAt,
      generateDraft,
    };
    baseRoomPayload.question_sets = questionSets;
    baseRoomPayload.questions_generated_at = questionsGeneratedAt;
  } else if (activityType === "question_generator") {
    const guidance = String(formData.get("guidance") ?? "").trim()
      || "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.";
    const questionSetId = String(formData.get("question_set_id") ?? "").trim();

    if (questionSetId) {
      // 세트 모드: 저장된 질문 세트 1개를 가상의 단일 카드 묶음으로 변환해 활동에 넣는다.
      const { data: setRow } = await admin
        .schema("writing_helper")
        .from("question_sets")
        .select("id, name, description, items")
        .eq("id", questionSetId)
        .eq("teacher_id", user.id)
        .maybeSingle();
      if (!setRow) return { error: "선택한 질문 세트를 찾을 수 없습니다." };
      const items = Array.isArray(setRow.items) ? setRow.items : [];
      const prompts = items
        .map((row: unknown) => {
          if (typeof row === "string") return row.trim();
          if (row && typeof row === "object") {
            const text = (row as { text?: unknown }).text;
            return typeof text === "string" ? text.trim() : "";
          }
          return "";
        })
        .filter((text: string) => text.length > 0);
      if (prompts.length === 0) return { error: "선택한 질문 세트에 질문이 비어 있습니다." };

      const virtualCardSetId = `set:${setRow.id}`;
      activityConfig = {
        enabledCardSetIds: [virtualCardSetId],
        cardSets: [{
          id: virtualCardSetId,
          label: setRow.name,
          description: setRow.description ?? "",
          prompts,
        }],
        maxSelections: clampNumber(formData.get("max_selections"), 1, 4, 1),
        guidance,
        requireReason: formData.get("require_reason") !== null,
      };
    } else {
      const teacherCardSets = await getTeacherQuestionCardSets(admin, user.id);
      const allowedIds = new Set(teacherCardSets.map((cardSet) => cardSet.id));
      const enabledCardSetIds = formData
        .getAll("enabled_card_set_ids")
        .map((value) => String(value))
        .filter((value): value is string => allowedIds.has(value));

      if (enabledCardSetIds.length === 0) {
        return { error: "질문 카드 묶음을 1개 이상 선택해주세요." };
      }

      activityConfig = {
        enabledCardSetIds,
        cardSets: teacherCardSets.filter((cardSet) => enabledCardSetIds.includes(cardSet.id)),
        maxSelections: clampNumber(formData.get("max_selections"), 1, 4, 1),
        guidance,
        requireReason: formData.get("require_reason") !== null,
      };
    }
  } else if (activityType === "question_voting") {
    const sourceRoomId = String(formData.get("source_room_id") ?? "").trim();
    const evaluationCriteria = String(formData.get("evaluation_criteria") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!sourceRoomId) {
      return { error: "질문을 가져올 질문 만들기 활동을 선택해주세요." };
    }

    const sourceRoom = await getQuestionGeneratorSourceRoomSummary(admin, user.id, sourceRoomId);
    if (!sourceRoom) {
      return { error: "질문 만들기 결과를 불러오지 못했습니다. 다시 선택해주세요." };
    }

    topic = sourceRoom.title || sourceRoom.topic || "좋은 질문 고르기";
    topicDescription = sourceRoom.topic || sourceRoom.title || "";

    activityConfig = {
      sourceRoomId: sourceRoom.roomId,
      sourceRoomTitle: sourceRoom.title,
      sourceQuestions: sourceRoom.questions,
      evaluationCriteria,
      maxSelections: clampNumber(formData.get("max_selections"), 1, sourceRoom.questions.length, 1),
      requireReason: formData.get("require_reason") !== "off",
    };
  } else {
    const promptTitle = String(formData.get("prompt_title") ?? "").trim() || "오늘 수업 한 줄 정리";
    const promptDescription = String(formData.get("prompt_description") ?? "").trim()
      || "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.";
    const keywords = normalizeKeywordText(String(formData.get("keywords") ?? ""));

    topic = promptTitle;
    topicDescription = promptDescription;

    activityConfig = {
      promptTitle,
      promptDescription,
      keywords,
      maxReactionsPerStudent: clampNumber(formData.get("max_reactions_per_student"), 1, 10, 3),
    };
  }

  if (!topic) return { error: "주제를 입력해주세요." };

  let { data: room, error: roomError } = await admin
    .schema("writing_helper")
    .from("rooms")
    .insert({
      ...baseRoomPayload,
      title: activityType === "one_line_share" ? "한줄모아" : topic,
      topic,
      topic_description: topicDescription,
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
      .insert({
        ...baseRoomPayload,
        title: topic,
        topic,
        topic_description: topicDescription,
      })
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
  return value === "question_generator" || value === "question_voting" || value === "one_line_share"
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

export async function updateStudentResult(
  roomId: string,
  sessionId: string,
  outline: string,
  draft: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const trimmedOutline = outline.trim();
  const trimmedDraft = draft.trim();
  if (!trimmedOutline && !trimmedDraft) {
    return { error: "개요와 초고를 모두 비울 수는 없습니다." };
  }

  const admin = createSupabaseAdminClient();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return { error: "활동 세션을 찾을 수 없습니다." };
  if (room.teacher_id !== user.id) return { error: "권한이 없습니다." };

  const { data: queue } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .select("id")
    .eq("session_id", sessionId)
    .eq("room_id", roomId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!queue) return { error: "수정할 결과를 찾을 수 없습니다." };

  const result = serializeOutlineResult({
    outline: trimmedOutline ? trimmedOutline : null,
    draft: trimmedDraft ? trimmedDraft : null,
  });

  const { error } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .update({ result })
    .eq("id", queue.id);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/room/${roomId}/result/${sessionId}`);
  return {};
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

export type QuestionGeneratorSourceRoomSummary = {
  roomId: string;
  title: string;
  topic: string;
  createdAt: string;
  questionCount: number;
  questions: Array<{
    id: string;
    text: string;
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

export async function getQuestionGeneratorSourceRooms(classId?: string): Promise<QuestionGeneratorSourceRoomSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  let query = admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, title, topic, created_at")
    .eq("teacher_id", user.id)
    .eq("activity_type", "question_generator")
    .order("created_at", { ascending: false });

  if (classId) {
    query = query.eq("class_id", classId);
  }

  const { data: rooms } = await query;
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((room) => room.id);
  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, room_id, submission")
    .in("room_id", roomIds)
    .eq("status", "done");

  const questionsByRoom = new Map<string, Array<{ id: string; text: string }>>();

  for (const session of sessions ?? []) {
    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) continue;

    const current = questionsByRoom.get(session.room_id) ?? [];
    submission.selections.forEach((selection) => {
      current.push({
        id: `${session.id}-${selection.id}`,
        text: selection.remixedQuestion,
      });
    });
    questionsByRoom.set(session.room_id, current);
  }

  return rooms.flatMap((room) => {
    const questions = questionsByRoom.get(room.id) ?? [];
    if (questions.length === 0) return [];

    return [{
      roomId: room.id,
      title: room.title ?? room.topic ?? "질문 만들기 활동",
      topic: room.topic ?? room.title ?? "",
      createdAt: room.created_at,
      questionCount: questions.length,
      questions,
    }];
  });
}

export async function getQuestionVotingRoomResults(roomId: string): Promise<QuestionVotingRoomResult["ranking"]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type, activity_config")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "question_voting") {
    return [];
  }

  const config = normalizeQuestionVotingConfig(room.activity_config);
  if (!config?.sourceQuestions?.length) return [];

  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("submission")
    .eq("room_id", roomId)
    .eq("status", "done");

  const submissions = (sessions ?? [])
    .map((session) => normalizeQuestionVotingSubmission(session.submission))
    .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission));

  return buildQuestionVotingRanking(config, submissions);
}

export async function getOneLineShareRoomResults(roomId: string): Promise<OneLineShareRoomResult["entries"]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "one_line_share") {
    return [];
  }

  const [entriesRes, reactionsRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("one_line_entries")
      .select("id, session_id, student_number, student_name, content, contains_keywords, created_at, updated_at")
      .eq("room_id", roomId),
    admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .select("entry_id, session_id")
      .eq("room_id", roomId)
      .eq("reaction_type", "like"),
  ]);

  return buildOneLineShareBoard(entriesRes.data ?? [], reactionsRes.data ?? [], null);
}

async function getQuestionGeneratorSourceRoomSummary(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teacherId: string,
  roomId: string,
): Promise<QuestionGeneratorSourceRoomSummary | null> {
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, title, topic, created_at, teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== teacherId || room.activity_type !== "question_generator") {
    return null;
  }

  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, room_id, submission")
    .eq("room_id", roomId)
    .eq("status", "done");

  const questions = (sessions ?? []).flatMap((session) => {
    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) return [];

    return submission.selections.map((selection) => ({
      id: `${session.id}-${selection.id}`,
      text: selection.remixedQuestion,
    }));
  });

  return questions.length > 0
    ? {
        roomId: room.id,
        title: room.title ?? room.topic ?? "질문 만들기 활동",
        topic: room.topic ?? room.title ?? "",
        createdAt: room.created_at,
        questionCount: questions.length,
        questions,
      }
    : null;
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
