import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processOutlineQueue } from "@/app/actions/student-actions";

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// 대기열 처리 엔드포인트 — 서버에서 2초마다 호출
export async function POST(request: Request) {
  const secret = request.headers.get("x-queue-secret") ?? "";
  const expected = process.env.QUEUE_SECRET ?? "";
  if (!safeCompare(secret, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processOutlineQueue();
  return NextResponse.json(result);
}

export async function GET() {
  // 헬스체크
  return NextResponse.json({ ok: true });
}
