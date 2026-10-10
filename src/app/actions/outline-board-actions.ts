"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  normalizeStudentOutlineBoard,
  normalizeTeacherOutlineBoard,
  type StudentOutlineBoard,
  type TeacherOutlineBoard,
} from "@/lib/outline-board";
import { ownsIntegratedStudentSession } from "@/lib/lab-student-session";
import { getCurrentUser } from "./auth-actions";

// 친구 개요 모음(2026-10-10). 선생님 쪽은 DB 함수가 p_teacher_id 로 방 주인을 확인한다(migration 20261391),
// 학생 쪽 띠는 맨 아래 getStudentOutlineBoard(20261392).
type BoardResult = { board: TeacherOutlineBoard | null; error?: string };

const FRIENDLY_ERRORS: Array<[RegExp, string]> = [
  [/내 활동방에서만/, "내 활동방에서만 할 수 있어요."],
  [/개요짜기 활동에서만/, "개요짜기 활동에서만 친구 개요 모음을 만들 수 있어요."],
  [/열린 친구 개요 모음이 없어요/, "열린 친구 개요 모음이 없어요. 새 주소를 만들어 주세요."],
  [/샘링크에서 지웠거나 멈춘/, "샘링크에서 지웠거나 멈춘 주소예요. 새 주소를 만들어 주세요."],
  [/샘링크 주소를 만들지 못했어요/, "샘링크 주소를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요."],
];

function friendly(message: string | undefined) {
  const hit = FRIENDLY_ERRORS.find(([pattern]) => pattern.test(message ?? ""));
  return hit ? hit[1] : "친구 개요 모음을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

async function callBoard(fn: string, roomId: string): Promise<BoardResult> {
  if (!roomId || roomId.length > 100) return { board: null, error: "잘못된 요청입니다." };
  const user = await getCurrentUser();
  if (!user) return { board: null, error: "로그인이 필요합니다." };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .rpc(fn, { p_room_id: roomId, p_teacher_id: user.id });
  if (error) return { board: null, error: friendly(error.message) };
  return { board: normalizeTeacherOutlineBoard(data) };
}

export async function getOutlineBoard(roomId: string) {
  return callBoard("get_teacher_outline_board_v1", roomId);
}

/** 처음 켜기와 `새 주소 만들기` 모두 이것 — 열린 판이 있으면 닫고 새로 만든다(옛 주소는 곧바로 닫힘). */
export async function openOutlineBoard(roomId: string) {
  const result = await callBoard("open_outline_board_v1", roomId);
  revalidatePath(`/dashboard/room/${roomId}`);
  return result;
}

export async function extendOutlineBoard(roomId: string) {
  return callBoard("extend_outline_board_v1", roomId);
}

export async function closeOutlineBoard(roomId: string): Promise<BoardResult> {
  const result = await callBoard("close_outline_board_v1", roomId);
  revalidatePath(`/dashboard/room/${roomId}`);
  return result.error ? result : { board: null };
}

/**
 * 학생 개요 화면의 친구 개요 모음 띠(2026-10-10). 내 활동인지 먼저 확인하고, 열린 판·기간 지난 판만 준다.
 * 끈 판·없는 판은 null(띠 없음). 화면에 들어올 때와 모달을 닫을 때 한 번씩만 부른다(상시 폴링 없음).
 */
export async function getStudentOutlineBoard(sessionId: string, roomId: string): Promise<StudentOutlineBoard | null> {
  if (!sessionId || !roomId || sessionId.length > 100 || roomId.length > 100) return null;
  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) return null;
  const { data, error } = await admin
    .schema("writing_helper")
    .rpc("get_student_outline_board_v1", { p_room_id: roomId });
  if (error) return null;
  return normalizeStudentOutlineBoard(data);
}
