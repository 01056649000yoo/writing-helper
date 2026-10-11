import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  OUTLINE_BOARD_SERVER_CACHE_MS,
  OUTLINE_BOARD_TOKEN_PATTERN,
  normalizeOutlineBoardPayload,
  type OutlineBoardPayload,
} from "@/lib/outline-board";

// 친구 개요 모음 공개 읽기. 한 반이 동시에 새로 고쳐도 DB 는 판마다 5초에 한 번만 읽는다.
//
// 2026-10-11 Codex 독립 검토를 재현해 고친 것:
//  · DB 오류 때 옛 자료를 나이와 상관없이 돌려주던 것을 없앴다(끈 판의 실명이 무기한 나갈 수 있었다). 화면은 오류가 나도
//    직전 자료를 그대로 두므로 잃는 것이 없다.
//  · 공유를 끄거나 새 주소를 만들거나 늘린 직후에는 캐시를 비운다(`clearOutlineBoardCache`) — 끈 뒤 5초 동안 옛 자료가 나가지 않게.
//  · 같은 판을 동시에 읽는 요청은 진행 중인 조회 하나를 함께 기다린다(학생 30명이 한꺼번에 눌러도 DB 한 번).
// 서버 기능(끄기 등)과 공개 읽기 경로가 같은 캐시를 보도록 globalThis 에 둔다 — 번들이 달라 모듈 변수가 둘로 갈릴 수 있다.
type Cached = { at: number; payload: OutlineBoardPayload };
type Store = { cache: Map<string, Cached>; inflight: Map<string, Promise<OutlineBoardPayload>>; generation: number };
const globalStore = globalThis as typeof globalThis & { __outlineBoardStore?: Store };
const store: Store = (globalStore.__outlineBoardStore ??= { cache: new Map(), inflight: new Map(), generation: 0 });
const MAX_CACHED_BOARDS = 200;

export function clearOutlineBoardCache() {
  store.cache.clear();
  store.inflight.clear();
  // 비우기 전에 시작한 조회가 비운 뒤에 끝나 옛 자료를 다시 저장하지 않게 번호를 올린다.
  store.generation += 1;
}

async function fetchBoard(token: string): Promise<OutlineBoardPayload> {
  const generation = store.generation;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.schema("writing_helper").rpc("get_outline_board_v1", { p_token: token });
  if (error) throw new Error("outline board unavailable");

  const payload = normalizeOutlineBoardPayload(data);
  if (generation !== store.generation) return payload; // 읽는 동안 끄기·새 주소가 있었다 — 이 자료는 저장하지 않는다
  if (store.cache.size >= MAX_CACHED_BOARDS) {
    const oldest = store.cache.keys().next().value;
    if (oldest) store.cache.delete(oldest);
  }
  store.cache.set(token, { at: Date.now(), payload });
  return payload;
}

export async function loadOutlineBoard(token: string): Promise<OutlineBoardPayload> {
  if (!OUTLINE_BOARD_TOKEN_PATTERN.test(token)) return { state: "missing" };

  const hit = store.cache.get(token);
  if (hit && Date.now() - hit.at < OUTLINE_BOARD_SERVER_CACHE_MS) return hit.payload;

  const running = store.inflight.get(token);
  if (running) return running;

  const request = fetchBoard(token).finally(() => {
    if (store.inflight.get(token) === request) store.inflight.delete(token);
  });
  store.inflight.set(token, request);
  return request;
}
