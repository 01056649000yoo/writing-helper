import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [bridge, gpt, roomActions, settingsActions, compose, packageJson] = await Promise.all([
  readFile("src/lib/agit-ai.ts", "utf8"),
  readFile("src/lib/gpt.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/actions/settings-actions.ts", "utf8"),
  readFile("docker-compose.yml", "utf8"),
  readFile("package.json", "utf8"),
]);

test("연구소 AI는 로그인 세션을 비공개 Docker 네트워크로 아지트에 전달한다", () => {
  assert.match(bridge, /supabase\.auth\.getUser\(\)/);
  assert.match(bridge, /supabase\.auth\.getSession\(\)/);
  assert.match(bridge, /userData\.user\.id !== labActorId/);
  assert.match(bridge, /"X-Lab-Auth"/);
  assert.match(bridge, /"X-Lab-Anon-Key"/);
  assert.match(compose, /AGIT_AI_INTERNAL_URL: http:\/\/agit-edge-functions:9000\/vibe-ai/);
  assert.match(compose, /name: agit_default/);
});

test("연구소에는 OpenAI 키 저장과 직접 SDK 호출이 남지 않는다", () => {
  const combined = `${bridge}\n${gpt}\n${roomActions}\n${settingsActions}`;
  assert.doesNotMatch(combined, /OPENAI_API_KEY|createOpenAIClient|chat\.completions|getTeacherOpenAiAccess|logApiUsage/);
  assert.doesNotMatch(packageJson, /"openai"/);
  assert.match(gpt, /callAgitAi/);
});

test("개인·공용 API 키 설정 화면은 제거됐다", async () => {
  await assert.rejects(access("src/app/dashboard/api-key/page.tsx"));
  await assert.rejects(access("src/app/dashboard/api-key/api-key-form.tsx"));
  await assert.rejects(access("src/app/dashboard/admin/api-key-card.tsx"));
  await assert.rejects(access("src/lib/vault.ts"));
});

test("AI 요청은 로그인 확인과 입력 상한을 거친다", () => {
  assert.match(bridge, /MAX_PROMPT_LENGTH = 10_000/);
  assert.match(settingsActions, /if \(!user\) return \{ error: "로그인이 필요합니다\." \}/);
  assert.match(settingsActions, /normalizedTopic\.length > 200/);
  assert.match(settingsActions, /roleCount < 1 \|\| roleCount > 5/);
  assert.match(roomActions, /trimmedWord\.length > 30/);
});
