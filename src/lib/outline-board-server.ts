import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  OUTLINE_BOARD_SERVER_CACHE_MS,
  OUTLINE_BOARD_TOKEN_PATTERN,
  normalizeOutlineBoardPayload,
  type OutlineBoardPayload,
} from "@/lib/outline-board";

// 친구 개요 모음 공개 읽기. 한 반이 동시에 새로 고쳐도 DB 는 판마다 5초에 한 번만 읽는다.
const cache = new Map<string, { at: number; payload: OutlineBoardPayload }>();
const MAX_CACHED_BOARDS = 200;

export async function loadOutlineBoard(token: string): Promise<OutlineBoardPayload> {
  if (!OUTLINE_BOARD_TOKEN_PATTERN.test(token)) return { state: "missing" };

  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < OUTLINE_BOARD_SERVER_CACHE_MS) return hit.payload;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.schema("writing_helper").rpc("get_outline_board_v1", { p_token: token });
  if (error) {
    // 잠깐 DB 가 안 되면 직전 화면을 그대로 둔다(없으면 없는 판).
    if (hit) return hit.payload;
    throw new Error("outline board unavailable");
  }

  const payload = normalizeOutlineBoardPayload(data);
  if (cache.size >= MAX_CACHED_BOARDS) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(token, { at: Date.now(), payload });
  return payload;
}
