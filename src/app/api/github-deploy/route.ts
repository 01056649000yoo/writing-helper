import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: false,
    route: "github-deploy",
    message: "In-app deploy webhook is disabled. Use the host deploy webhook service instead.",
  }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({
    ok: false,
    route: "github-deploy",
    message: "In-app deploy webhook is disabled. Use the host deploy webhook service instead.",
  }, { status: 410 });
}
