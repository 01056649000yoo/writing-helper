import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  authConfig,
  serverClient,
  browserClient,
  proxy,
  callback,
  authActions,
  loginPage,
  loginClient,
  dashboardLayout,
  labCompose,
  dockerfile,
] = await Promise.all([
  readFile("src/lib/auth-config.ts", "utf8"),
  readFile("src/lib/supabase-server.ts", "utf8"),
  readFile("src/lib/supabase-client.ts", "utf8"),
  readFile("src/proxy.ts", "utf8"),
  readFile("src/app/auth/callback/route.ts", "utf8"),
  readFile("src/app/actions/auth-actions.ts", "utf8"),
  readFile("src/app/login/page.tsx", "utf8"),
  readFile("src/app/login/page-client.tsx", "utf8"),
  readFile("src/app/dashboard/layout.tsx", "utf8"),
  readFile("docker-compose.lab.yml", "utf8"),
  readFile("Dockerfile", "utf8"),
]);

test("브라우저·서버·proxy·인증 콜백은 같은 루트 쿠키 이름을 쓴다", () => {
  assert.match(authConfig, /SHARED_AUTH_COOKIE_NAME = "sb-agit-auth-token"/);
  assert.match(authConfig, /path: "\/"/);
  assert.match(authConfig, /sameSite: "lax"/);
  assert.doesNotMatch(authConfig, /domain:/i);
  assert.match(authConfig, /process\.env\.LAB_SSO_ENABLED === "true" \? SHARED_AUTH_COOKIE_OPTIONS : undefined/);
  assert.match(authConfig, /process\.env\.NEXT_PUBLIC_LAB_SSO_ENABLED === "true" \? SHARED_AUTH_COOKIE_OPTIONS : undefined/);
  for (const source of [serverClient, proxy, callback]) {
    assert.match(source, /getServerAuthCookieOptions/);
    assert.match(source, /cookieOptions: getServerAuthCookieOptions\(\)/);
  }
  assert.match(browserClient, /BROWSER_AUTH_COOKIE_OPTIONS/);
  assert.match(browserClient, /cookieOptions: BROWSER_AUTH_COOKIE_OPTIONS/);
});

test("통합 /lab만 SSO 모드를 켜고 구 helper 로그인은 롤백용으로 유지한다", () => {
  assert.match(labCompose, /NEXT_PUBLIC_LAB_SSO_ENABLED: "true"/);
  assert.match(labCompose, /LAB_SSO_ENABLED: "true"/);
  assert.match(dockerfile, /ARG NEXT_PUBLIC_LAB_SSO_ENABLED="false"/);
  assert.match(dockerfile, /ENV NEXT_PUBLIC_LAB_SSO_ENABLED=\$\{NEXT_PUBLIC_LAB_SSO_ENABLED\}/);
});

test("통합 모드는 별도 비밀번호 인증을 막고 DB 승인 교사 RPC를 통과시킨다", () => {
  assert.match(authActions, /isSsoEnabled/);
  assert.match(authActions, /ensure_lab_teacher_profile_v1/);
  assert.match(authActions, /access\?\.allowed !== true/);
  assert.match(authActions, /통합 연구소는 끄적끄적 아지트에서 로그인한 승인 교사/);
  assert.match(loginPage, /await getCurrentUser\(\)/);
  assert.match(loginPage, /redirect\("\/dashboard"\)/);
  assert.doesNotMatch(loginPage, /redirect\(withBasePath\(/);
  assert.match(loginClient, /ssoEnabled \? \"아지트 교사 계정으로 바로 이어집니다/);
  assert.match(loginClient, /별도 가입이나 비밀번호 입력은 필요하지 않습니다/);
});

test("승인 실패는 연구소 전용 안내로 보내고 아지트 복귀 동선을 제공한다", () => {
  assert.match(proxy, /"\/access-denied"/);
  assert.match(dashboardLayout, /if \(!profile\) redirect\("\/access-denied"\)/);
  assert.doesNotMatch(dashboardLayout, /redirect\(withBasePath\(/);
  assert.match(dashboardLayout, /아지트로 돌아가기/);
});
