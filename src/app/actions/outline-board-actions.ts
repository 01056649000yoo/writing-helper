"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeTeacherOutlineBoard, type TeacherOutlineBoard } from "@/lib/outline-board";
import { getCurrentUser } from "./auth-actions";

// 친구 개요 모음 — 선생님 쪽(2026-10-10). 방 주인 확인은 DB 함수가 p_teacher_id 로 한다(migration 20261391).
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
