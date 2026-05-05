import { createHmac, timingSafeEqual } from "crypto";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function verifyGithubSignature(body: string, signature: string, secret: string) {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "github-deploy" });
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  const expectedRepo = process.env.GITHUB_WEBHOOK_REPO ?? "01056649000yoo/writing-helper";
  const expectedRef = process.env.GITHUB_WEBHOOK_REF ?? "refs/heads/main";

  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const event = request.headers.get("x-github-event") ?? "";
  const body = await request.text();

  if (!verifyGithubSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "ping") {
    return NextResponse.json({ ok: true, event: "ping" });
  }

  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: `event:${event}` });
  }

  const payload = JSON.parse(body) as {
    ref?: string;
    repository?: { full_name?: string };
  };

  if (payload.repository?.full_name !== expectedRepo) {
    return NextResponse.json({
      ok: true,
      ignored: `repo:${payload.repository?.full_name ?? "unknown"}`,
    });
  }

  if (payload.ref !== expectedRef) {
    return NextResponse.json({
      ok: true,
      ignored: `ref:${payload.ref ?? "unknown"}`,
    });
  }

  const child = spawn("bash", ["scripts/deploy-from-github.sh"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });

  child.unref();

  return NextResponse.json({
    ok: true,
    queued: true,
    repo: payload.repository?.full_name,
    ref: payload.ref,
  });
}
