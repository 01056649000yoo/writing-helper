import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [globals, layout, nav, dashboard, classPage, roomNew, guide, login, compose, readme] = await Promise.all([
  readFile("src/app/globals.css", "utf8"),
  readFile("src/app/dashboard/layout.tsx", "utf8"),
  readFile("src/app/dashboard/dashboard-nav.tsx", "utf8"),
  readFile("src/app/dashboard/page.tsx", "utf8"),
  readFile("src/app/dashboard/class/[id]/page.tsx", "utf8"),
  readFile("src/app/dashboard/room/new/page.tsx", "utf8"),
  readFile("src/app/dashboard/dashboard-tabs.tsx", "utf8"),
  readFile("src/app/login/page-client.tsx", "utf8"),
  readFile("docker-compose.yml", "utf8"),
  readFile("README.md", "utf8"),
]);

test("연구소는 끄적끄적 아지트 공통 디자인 토큰을 사용한다", () => {
  assert.match(globals, /--ui-primary:\s*#2563eb/);
  assert.match(globals, /--ui-primary-hover:\s*#1d4ed8/);
  assert.match(globals, /--ui-page:\s*#f8fafc/);
  assert.match(globals, /--ui-ink:\s*#0f172a/);
  assert.match(globals, /--ui-border:\s*#e2e8f0/);
  assert.match(globals, /\.lab-button--primary/);
  assert.match(globals, /:focus-visible/);
  assert.match(globals, /prefers-reduced-motion:\s*reduce/);
  assert.match(globals, /@media \(max-width:\s*767px\)/);
});

test("교사용 대시보드는 공통 셸과 현재 메뉴 표시를 한 번만 렌더링한다", async () => {
  assert.match(layout, /끄적끄적 아지트/);
  assert.match(layout, /글쓰기 연구소/);
  assert.match(layout, /DashboardNav/);
  assert.match(layout, /NEXT_PUBLIC_AGIT_APP_URL/);
  assert.match(layout, /아지트로 돌아가기/);
  assert.match(nav, /usePathname/);
  assert.match(nav, /aria-current/);
  assert.match(nav, /학급·활동/);
  assert.match(nav, /질문 카드/);
  assert.doesNotMatch(nav, /한자 단어집|hanja-wordbook/);

  await Promise.all([
    assert.rejects(access("src/app/dashboard/hanja-wordbook/page.tsx")),
    assert.rejects(access("src/app/dashboard/hanja-wordbook/wordbook-client.tsx")),
    assert.rejects(access("src/app/dashboard/hanja-wordbook/print/page.tsx")),
    assert.rejects(access("src/app/dashboard/hanja-wordbook/print/print-client.tsx")),
  ]);

  for (const page of [dashboard, classPage, roomNew]) {
    assert.doesNotMatch(page, /bg-gradient-to-br from-blue-50 to-indigo-100/);
  }
  assert.doesNotMatch(dashboard, /<header/);
  assert.doesNotMatch(classPage, /<header/);
});

test("연구소의 별도 서비스 관리와 화면 배포 번호를 제거한다", async () => {
  assert.doesNotMatch(layout, /BUILD_LABEL|deploy\s/);
  assert.doesNotMatch(nav, /서비스 관리|dashboard\/admin|isServiceAdmin/);
  assert.doesNotMatch(login, /BUILD_LABEL|fixed bottom-4 right-4/);
  assert.doesNotMatch(compose, /SERVICE_ADMIN_EMAIL/);
  assert.doesNotMatch(readme, /SERVICE_ADMIN_EMAIL|deploy <commit>/);

  await Promise.all([
    assert.rejects(access("src/app/dashboard/admin/page.tsx")),
    assert.rejects(access("src/app/dashboard/admin/admin-dashboard-client.tsx")),
    assert.rejects(access("src/app/actions/admin-actions.ts")),
    assert.rejects(access("src/lib/service-admin.ts")),
    assert.rejects(access("src/lib/build-version.ts")),
  ]);
});

test("도움말은 새로 만들 수 있는 네 활동을 활동 폴더 한 곳에서 설명한다", async () => {
  // 새로 만들 수 있는 활동(한자는 단어집 자료로만 남았다).
  for (const activityId of ["outline_builder", "question_generator", "question_voting", "one_line_share"]) {
    assert.match(roomNew, new RegExp(`"${activityId}"`));
  }

  const guideSource = await readFile("src/features/activities/guide.ts", "utf8");
  assert.match(guideSource, /글 개요 짜기/);
  assert.match(guideSource, /질문 만들기/);
  assert.match(guideSource, /좋은 질문 고르기/);
  assert.match(guideSource, /한줄모아/);
  // 용도·언제·학생이 하는 일·결과가 어디로 — 네 가지를 모두 담는다.
  for (const field of ["purpose:", "whenToUse:", "studentFlow:", "resultUse:", "teacherSetup:"]) {
    assert.ok(guideSource.includes(field), `${field} 없음`);
  }

  // 화면은 안내 문구를 따로 베껴 쓰지 않고 이 자료를 읽어 그린다.
  const guidePage = await readFile("src/app/dashboard/guide/page.tsx", "utf8");
  assert.match(guidePage, /LabGuide/);
  assert.match(roomNew, /LabGuide/);
  // 도움말은 상단 메뉴에 있다 — 학급 안에서도 열려야 한다(2026-08-20).
  assert.match(nav, /도움말/);
  assert.match(nav, /\/dashboard\/guide/);
  // 학급 목록 화면의 옛 탭은 없앴다(같은 안내가 두 곳에 있으면 한쪽만 낡는다).
  assert.doesNotMatch(guide, /LabGuide|활동별 설명서/);
  assert.doesNotMatch(guide, /4대 모듈|4개 모듈|AI 자동 대기열|GPT/);
  // 옛 안내가 남긴 틀린 문장("연동할 예정")이 다시 들어오지 않게 한다.
  assert.doesNotMatch(guide, /연동할 예정/);
  await assert.rejects(access("src/app/dashboard/manual-modal.tsx"));
});

/*
 * 2026-08-24: 색·간격·모서리는 이미 아지트와 같았는데 **글자만 달랐다**.
 * 연구소는 Tailwind 기본 크기를 그대로 썼고(가장 많이 쓰는 `text-xs` 가 0.75rem = 12px),
 * 본문 글꼴은 Geist 를 앞에 둬서 한글은 같아 보여도 숫자·영문이 두 앱에서 달라 보였다.
 *
 * ⚠️ 두 앱은 저장소가 달라 서로의 파일을 읽을 수 없다. 그래서 **같은 숫자를 양쪽에 적어 두고**
 *    각자 검사한다. 아지트 원본은 `vibe_agit/src/styles/design-system.css` 의 `--ui-text-*` 이고
 *    저쪽 검사는 `vibe_agit/tests/teacherTypeScale.test.mjs` 다. 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.
 */
const AGIT_TYPE_SCALE = Object.freeze([
  ["xs", "0.8rem"],
  ["sm", "0.9rem"],
  ["base", "1rem"],
  ["lg", "1.15rem"],
  ["xl", "1.35rem"],
  ["2xl", "1.5rem"],
  ["3xl", "2rem"],
]);

test("연구소 글자 크기는 아지트 계단과 같다", () => {
  for (const [step, size] of AGIT_TYPE_SCALE) {
    const rule = new RegExp(`--text-${step.replace("2xl", "2xl")}:\\s*${size.replace(".", "\\.")};`);
    assert.match(globals, rule, `--text-${step} 가 아지트 계단(${size})과 다르다`);
  }
  // Tailwind 기본 크기를 다시 정의해야 이미 쓰고 있는 `text-*` 클래스가 한 곳을 따라온다.
  assert.match(globals, /@theme\s*\{[\s\S]*--text-xs:/);
});

test("연구소 본문 글꼴은 아지트와 같은 한글 글꼴을 앞에 둔다", async () => {
  const layoutSource = await readFile("src/app/layout.tsx", "utf8");

  // Geist 에는 한글 글리프가 없다. 앞에 두면 숫자·영문만 아지트와 다르게 보인다.
  assert.match(layoutSource, /Noto_Sans_KR/);
  assert.doesNotMatch(layoutSource, /const\s+geistSans/);
  // 아지트가 쓰는 굵기를 그대로 받아야 같은 900 이 같은 모양으로 나온다.
  for (const weight of ["400", "500", "700", "800", "900"]) {
    assert.ok(layoutSource.includes(`"${weight}"`), `본문 글꼴에 ${weight} 굵기가 없다`);
  }
  assert.match(globals, /font-family: var\(--font-ui-sans\), "Noto Sans KR"/);
});
