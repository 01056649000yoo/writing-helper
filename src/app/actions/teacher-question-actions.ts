"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "./auth-actions";
import {
  loadTeacherQuestionsByRoom,
  normalizeTeacherQuestionText,
  TEACHER_QUESTION_MAX_LENGTH,
  TEACHER_QUESTION_MAX_PER_ROOM,
  type RoomTeacherQuestion,
} from "@/lib/room-teacher-questions";

/*
 * 질문 만들기 실시간 보기의 `+ 선생님 질문 추가` (2026-09-30).
 * 방을 만든 선생님만, 질문 만들기 방에서만 쓴다. 규칙은 lib/room-teacher-questions.ts 에 있다.
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function ownsQuestionGeneratorRoom(admin: AdminClient, roomId: string, teacherId: string) {
  if (!roomId || roomId.length > 100) return false;
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();
  return Boolean(room && room.teacher_id === teacherId && room.activity_type === "question_generator");
}

function checkText(text: string): string | null {
  if (!text) return "질문 내용을 적어 주세요.";
  if (text.length > TEACHER_QUESTION_MAX_LENGTH) return `질문은 ${TEACHER_QUESTION_MAX_LENGTH}자까지 쓸 수 있어요.`;
  return null;
}

export async function getRoomTeacherQuestions(roomId: string): Promise<{ questions: RoomTeacherQuestion[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { questions: [], error: "로그인이 필요합니다." };
  const admin = createSupabaseAdminClient();
  if (!await ownsQuestionGeneratorRoom(admin, roomId, user.id)) return { questions: [], error: "볼 권한이 없습니다." };
  const byRoom = await loadTeacherQuestionsByRoom(admin, [roomId]);
  return { questions: byRoom.get(roomId) ?? [] };
}

export async function addRoomTeacherQuestion(roomId: string, rawText: string): Promise<{ question?: RoomTeacherQuestion; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const text = normalizeTeacherQuestionText(rawText);
  const invalid = checkText(text);
  if (invalid) return { error: invalid };

  const admin = createSupabaseAdminClient();
  if (!await ownsQuestionGeneratorRoom(admin, roomId, user.id)) return { error: "질문을 더할 권한이 없습니다." };
  const { count } = await admin
    .schema("writing_helper")
    .from("room_teacher_questions")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if ((count ?? 0) >= TEACHER_QUESTION_MAX_PER_ROOM) {
    return { error: `선생님 질문은 한 활동에 ${TEACHER_QUESTION_MAX_PER_ROOM}개까지 더할 수 있어요.` };
  }

  const { data, error } = await admin
    .schema("writing_helper")
    .from("room_teacher_questions")
    .insert({ room_id: roomId, teacher_id: user.id, text })
    .select("id, text, created_at")
    .single();
  if (error || !data) return { error: "질문을 저장하지 못했습니다." };
  return { question: { id: data.id, text: data.text, createdAt: data.created_at } };
}

export async function updateRoomTeacherQuestion(roomId: string, questionId: string, rawText: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const text = normalizeTeacherQuestionText(rawText);
  const invalid = checkText(text);
  if (invalid) return { error: invalid };

  const admin = createSupabaseAdminClient();
  if (!await ownsQuestionGeneratorRoom(admin, roomId, user.id)) return { error: "고칠 권한이 없습니다." };
  const { data, error } = await admin
    .schema("writing_helper")
    .from("room_teacher_questions")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("room_id", roomId)
    .select("id");
  if (error) return { error: "질문을 저장하지 못했습니다." };
  if (!data || data.length === 0) return { error: "고칠 질문을 찾지 못했습니다." };
  return {};
}

export async function deleteRoomTeacherQuestion(roomId: string, questionId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const admin = createSupabaseAdminClient();
  if (!await ownsQuestionGeneratorRoom(admin, roomId, user.id)) return { error: "지울 권한이 없습니다." };
  const { error } = await admin
    .schema("writing_helper")
    .from("room_teacher_questions")
    .delete()
    .eq("id", questionId)
    .eq("room_id", roomId);
  if (error) return { error: "질문을 지우지 못했습니다." };
  return {};
}
