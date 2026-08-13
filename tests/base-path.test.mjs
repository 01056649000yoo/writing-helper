import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  nextConfig,
  dockerfile,
  currentCompose,
  labCompose,
  workflow,
  appPath,
  proxy,
  authActions,
  classActions,
  roomActions,
  authCallback,
  authConfirm,
  shortLink,
  roomPage,
  loginPage,
  signupPage,
  rootPage,
  dashboardLayout,
] = await Promise.all([
  readFile("next.config.ts", "utf8"),
  readFile("Dockerfile", "utf8"),
  readFile("docker-compose.yml", "utf8"),
  readFile("docker-compose.lab.yml", "utf8"),
  readFile(".github/workflows/deploy.yml", "utf8"),
  readFile("src/lib/app-path.ts", "utf8"),
  readFile("src/proxy.ts", "utf8"),
  readFile("src/app/actions/auth-actions.ts", "utf8"),
  readFile("src/app/actions/class-actions.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/auth/callback/route.ts", "utf8"),
  readFile("src/app/auth/confirm/route.ts", "utf8"),
  readFile("src/app/s/[code]/route.ts", "utf8"),
  readFile("src/app/dashboard/room/[id]/page.tsx", "utf8"),
  readFile("src/app/login/page-client.tsx", "utf8"),
  readFile("src/app/signup/page.tsx", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/app/dashboard/layout.tsx", "utf8"),
]);

test("/lab basePath는 빌드 인자로 고정하고 기존 루트 빌드도 유지한다", () => {
  assert.match(nextConfig, /NEXT_PUBLIC_BASE_PATH/);
  assert.match(nextConfig, /basePath,/);
  assert.match(dockerfile, /ARG NEXT_PUBLIC_BASE_PATH=""/);
  assert.match(dockerfile, /ENV NEXT_PUBLIC_BASE_PATH=\$\{NEXT_PUBLIC_BASE_PATH\}/);
  assert.match(currentCompose, /NEXT_PUBLIC_BASE_PATH: \$\{NEXT_PUBLIC_BASE_PATH:-\}/);
  assert.match(labCompose, /NEXT_PUBLIC_BASE_PATH: \/lab/);
});

test("통합 연구소는 별도 프로젝트·로컬 포트·agit 네트워크만 사용한다", () => {
  assert.match(labCompose, /name: writing-helper-lab/);
  assert.match(labCompose, /container_name: writing-helper-lab-app/);
  assert.match(labCompose, /127\.0\.0\.1:3001:3000/);
  assert.match(labCompose, /SUPABASE_INTERNAL_URL: http:\/\/agit-kong:8000/);
  assert.match(labCompose, /NEXT_PUBLIC_SUPABASE_URL: https:\/\/api\.xn--vz0ba242ncqcba79xhwx\.site/);
  assert.match(labCompose, /name: agit_default/);
  assert.doesNotMatch(labCompose, /host\.docker\.internal|supabase-db|0\.0\.0\.0:3001/);
});

test("Next 서버 리다이렉트는 basePath를 중복하지 않고 외부 URL은 basePath를 보존한다", () => {
  assert.match(appPath, /export function withBasePath/);
  assert.match(appPath, /export function withoutBasePath/);
  assert.match(proxy, /withoutBasePath\(request\.nextUrl\.pathname\)/);
  assert.match(proxy, /loginUrl\.pathname = "\/login"/);
  assert.doesNotMatch(proxy, /loginUrl\.pathname = withBasePath/);
  for (const source of [authActions, classActions, roomActions, rootPage, dashboardLayout]) {
    assert.doesNotMatch(source, /redirect\(withBasePath\(/);
  }
  assert.match(authActions, /redirect\("\/dashboard"\)/);
  assert.match(classActions, /redirect\(`\/dashboard\/class\/\$\{cls\.id\}`\)/);
  assert.match(roomActions, /redirect\(`\/dashboard\/room\/\$\{room\.id\}`\)/);
  assert.match(authCallback, /withBasePath\(next\)/);
  assert.match(authConfirm, /withBasePath\(next\)/);
  assert.match(shortLink, /withBasePath\(link\.target_path\)/);
  assert.match(roomPage, /withBasePath\(`\/room\/\$\{id\}`\)/);
  assert.match(roomPage, /withBasePath\(`\/s\/\$\{room\.short_code\}`\)/);
});

test("통합 병행 환경은 별도 회원가입을 화면과 서버 양쪽에서 차단한다", () => {
  assert.match(labCompose, /NEXT_PUBLIC_LAB_SIGNUP_ENABLED: "false"/);
  assert.match(labCompose, /LAB_ALLOW_SIGNUP: "false"/);
  assert.match(authActions, /process\.env\.LAB_ALLOW_SIGNUP === "false"/);
  assert.match(loginPage, /NEXT_PUBLIC_LAB_SIGNUP_ENABLED !== "false"/);
  assert.match(signupPage, /별도 회원가입은 받지 않습니다/);
  assert.match(labCompose, /NEXT_PUBLIC_LAB_SSO_ENABLED: "true"/);
  assert.match(labCompose, /LAB_SSO_ENABLED: "true"/);
});

test("main 배포는 기존 연구소와 통합 /lab 컨테이너를 각각 검증한다", () => {
  assert.match(workflow, /INTEGRATED_ENV_FILE: \/Users\/seunghyeonmaegmini\/agit-supabase\/\.env/);
  assert.match(workflow, /docker compose --env-file "\$INTEGRATED_ENV_FILE" -f docker-compose\.lab\.yml build/);
  assert.doesNotMatch(workflow, /build --no-cache/);
  assert.match(workflow, /-f docker-compose\.lab\.yml up -d --remove-orphans/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:3001\/lab\/login/);
});
