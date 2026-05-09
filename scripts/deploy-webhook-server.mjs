import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const envPath = resolve(projectRoot, ".env.local");

loadEnvFile(envPath);

const PORT = Number(process.env.DEPLOY_WEBHOOK_PORT ?? "4010");
const HOST = process.env.DEPLOY_WEBHOOK_HOST ?? "127.0.0.1";
const SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "";
const EXPECTED_REPO = process.env.GITHUB_WEBHOOK_REPO ?? "01056649000yoo/writing-helper";
const EXPECTED_REF = process.env.GITHUB_WEBHOOK_REF ?? "refs/heads/main";
const DEPLOY_SCRIPT = resolve(projectRoot, "scripts/deploy-from-github.sh");
const DEPLOY_PATHS = new Set([
  "/github-deploy",
  "/api/github-deploy",
  "/__deploy/github/github-deploy",
]);

if (!SECRET) {
  console.error("GITHUB_WEBHOOK_SECRET is not configured");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return respondJson(res, 200, { ok: true, service: "deploy-webhook", host: HOST, port: PORT });
    }

    if (req.method !== "POST" || !DEPLOY_PATHS.has(req.url ?? "")) {
      return respondJson(res, 404, { error: "Not found" });
    }

    const body = await readBody(req);
    const signature = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];

    if (typeof signature !== "string" || !verifyGithubSignature(body, signature, SECRET)) {
      return respondJson(res, 401, { error: "Invalid signature" });
    }

    if (event === "ping") {
      return respondJson(res, 200, { ok: true, event: "ping" });
    }

    if (event !== "push") {
      return respondJson(res, 200, { ok: true, ignored: `event:${String(event)}` });
    }

    const payload = JSON.parse(body);

    if (payload?.repository?.full_name !== EXPECTED_REPO) {
      return respondJson(res, 200, {
        ok: true,
        ignored: `repo:${payload?.repository?.full_name ?? "unknown"}`,
      });
    }

    if (payload?.ref !== EXPECTED_REF) {
      return respondJson(res, 200, {
        ok: true,
        ignored: `ref:${payload?.ref ?? "unknown"}`,
      });
    }

    const child = spawn("bash", [DEPLOY_SCRIPT], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });

    child.unref();

    return respondJson(res, 200, {
      ok: true,
      queued: true,
      repo: payload?.repository?.full_name,
      ref: payload?.ref,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return respondJson(res, 500, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`deploy-webhook listening on http://${HOST}:${PORT}`);
});

function respondJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectPromise);
  });
}

function verifyGithubSignature(body, signature, secret) {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) continue;

    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}
