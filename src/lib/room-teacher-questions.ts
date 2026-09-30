import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase-server";

/*
 * 질문 만들기 방에 선생님이 더한 질문 (2026-09-30).
 *
 * 학생 질문이 모자랄 때 선생님이 실시간 보기에서 질문을 더한다. 학생 제출(student_sessions)에 끼워 넣으면
 * `제출 N명`·학생별 결과가 어긋나므로 방에 딸린 표(`writing_helper.room_teacher_questions`)에 따로 둔다.
 * 이 질문은 `좋은 질문 고르기` 후보로 이어지고(미리 담긴 채로), 거기서 개요 짜기 `친구들과 만든 질문` 과
 * 아지트 `연구소 질문 불러오기` 로 간다. 투표 후보에는 누가 냈는지 남기지 않는다(익명 투표).
 */

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export const TEACHER_QUESTION_MAX_LENGTH = 300;
export const TEACHER_QUESTION_MAX_PER_ROOM = 30;
/** 투표 후보·원본 목록에서 선생님 질문을 가르는 머리말. 학생 질문 id 는 `세션::선택` 모양이라 겹치지 않는다. */
export const TEACHER_QUESTION_SOURCE_PREFIX = "teacher::";

export type RoomTeacherQuestion = { id: string; text: string; createdAt: string };

export function normalizeTeacherQuestionText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function teacherQuestionSourceId(questionId: string) {
  return `${TEACHER_QUESTION_SOURCE_PREFIX}${questionId}`;
}

export function parseTeacherQuestionSourceId(sourceId: string): string | null {
  return sourceId.startsWith(TEACHER_QUESTION_SOURCE_PREFIX)
    ? sourceId.slice(TEACHER_QUESTION_SOURCE_PREFIX.length) || null
    : null;
}

/** 방 여러 개의 선생님 질문을 한 번에 읽는다(방마다 부르지 않는다). */
export async function loadTeacherQuestionsByRoom(
  admin: AdminClient,
  roomIds: string[],
): Promise<Map<string, RoomTeacherQuestion[]>> {
  const byRoom = new Map<string, RoomTeacherQuestion[]>();
  if (roomIds.length === 0) return byRoom;
  const { data, error } = await admin
    .schema("writing_helper")
    .from("room_teacher_questions")
    .select("id, room_id, text, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: true });
  // 표를 못 읽어도 학생 질문은 그대로 보여야 한다 — 선생님 질문만 빠진다.
  if (error) return byRoom;
  for (const row of data ?? []) {
    const bucket = byRoom.get(row.room_id) ?? [];
    bucket.push({ id: row.id, text: row.text, createdAt: row.created_at });
    byRoom.set(row.room_id, bucket);
  }
  return byRoom;
}
