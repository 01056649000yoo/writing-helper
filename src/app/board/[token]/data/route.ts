import { NextResponse, type NextRequest } from "next/server";
import { loadOutlineBoard } from "@/lib/outline-board-server";

// 친구 개요 모음 새로 고침(1분 자동·단추). 로그인 없이 긴 번호로 읽는다 — 검색·캐시에 남기지 않는다.
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(_request: NextRequest, ctx: RouteContext<"/board/[token]/data">) {
  const { token } = await ctx.params;
  try {
    const payload = await loadOutlineBoard(token);
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 503, headers: NO_STORE });
  }
}
