import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

// 2026-10-11 연구소 점검(4가지 활동 만들기 → 학생 제출·결과 → 다시 들어가기 → 종료 뒤 접근)에서 찾은 것들.

test("폐기한 umami 스크립트를 부르지 않는다 — 꺼진 서버를 기다리느라 화면이 계속 로딩 중이었다", async () => {
  const layout = await readFile("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /umami/i);
});

test("배포 버전 어긋남 보호: 배포 전에 열어 둔 화면은 이동할 때 저절로 새로 고친다", async () => {
  const config = await readFile("next.config.ts", "utf8");
  assert.match(config, /deploymentId:\s*process\.env\.NEXT_PUBLIC_BUILD_VERSION/);
});

test("아지트에서 들어온 학생은 서버에서 곧바로 내 활동·결과로 보낸다(화면을 두 번 받지 않게)", async () => {
  const page = await readFile("src/app/room/[id]/page.tsx", "utf8");
  assert.match(page, /integratedEntry\?\.sessionId[\s\S]{0,200}redirect\(`\/room\/\$\{roomId\}\/\$\{destination\}\?session=/);
});

test("이동 중 표시가 있다 — 선생님 방·학급, 학생 입장", async () => {
  for (const dir of ["src/app/dashboard/room/[id]", "src/app/dashboard/class/[id]", "src/app/room/[id]"]) {
    await access(`${dir}/loading.tsx`);
  }
});

test("선생님 확인은 한 요청 안에서 한 번만(React cache) — 방 화면 하나에 4~5번 오가던 것", async () => {
  const [lib, actions] = await Promise.all([
    readFile("src/lib/current-user.ts", "utf8"),
    readFile("src/app/actions/auth-actions.ts", "utf8"),
  ]);
  assert.match(lib, /export const getCachedCurrentUser = cache\(/);
  assert.match(actions, /export async function getCurrentUser\(\) \{\s*\/\/[^\n]*\n\s*return getCachedCurrentUser\(\);/);
});

test("선생님 방 화면은 첫 화면부터 제출 현황을 싣는다 — 잠깐 0명·미참여로 보이던 것", async () => {
  const [page, panel] = await Promise.all([
    readFile("src/app/dashboard/room/[id]/page.tsx", "utf8"),
    readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
  ]);
  assert.match(page, /getRoomSessions\(id\)/);
  assert.match(page, /initialSessions=\{/);
  assert.match(panel, /useState<Session\[\]>\(initialSessions\)/);
});

test("학생 활동 화면은 서버를 못 부르면 불러오는 중에 멈추지 않고 새로 고침을 안내한다", async () => {
  const activity = await readFile("src/app/room/[id]/activity/page.tsx", "utf8");
  assert.match(activity, /getStudentRoomQuestions\(sessionId, roomId\)\.then[\s\S]*?\}\)\.catch\(\(\) => \{[\s\S]{0,300}활동을 불러오지 못했어요/);
});

test("종료된 활동에 로그인한 학생이 들어오면 로그인 안내가 아니라 끝났다고 알린다", async () => {
  const entry = await readFile("src/app/room/[id]/room-entry-client.tsx", "utf8");
  assert.match(entry, /ended \? "활동이 끝났어요" : "학생 로그인이 필요해요"/);
});

// 2026-10-11 보안 점검(Codex 독립 검토를 코드로 확인한 항목)
test("독립 모드에서 소유권 검사는 기본 거절이고, 학급이 바뀐 학생은 옛 학급 세션을 못 쓴다", async () => {
  const session = await readFile("src/lib/lab-student-session.ts", "utf8");
  const body = session.slice(session.indexOf("export async function ownsIntegratedStudentSession"));
  assert.doesNotMatch(body, /if \(!isIntegratedLab\(\)\) return true;/);
  assert.match(body, /LAB_ALLOW_STANDALONE_OWNERSHIP === "true"/);
  assert.match(body, /rooms\(agit_class_id\)/);
  assert.match(body, /roomClassId === student\.class_id/);
});

test("한줄모아 제출도 활동 종류를 확인한다(한자·투표 제출과 같게)", async () => {
  const actions = await readFile("src/app/actions/student-actions.ts", "utf8");
  const body = actions.slice(actions.indexOf("export async function submitOneLineShare("));
  assert.match(body.slice(0, 2500), /activity_type !== "one_line_share"\) return \{ error: "활동 종류가 맞지 않습니다\." \}/);
});

test("연구소 응답에 기본 보안 헤더가 붙는다", async () => {
  const config = await readFile("next.config.ts", "utf8");
  for (const key of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.match(config, new RegExp(key));
  }
});
