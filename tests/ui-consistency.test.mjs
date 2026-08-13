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

test("교사용 대시보드는 공통 셸과 현재 메뉴 표시를 한 번만 렌더링한다", () => {
  assert.match(layout, /끄적끄적 아지트/);
  assert.match(layout, /글쓰기 연구소/);
  assert.match(layout, /DashboardNav/);
  assert.match(layout, /NEXT_PUBLIC_AGIT_APP_URL/);
  assert.match(layout, /아지트 홈/);
  assert.match(nav, /usePathname/);
  assert.match(nav, /aria-current/);
  assert.match(nav, /학급·활동/);
  assert.match(nav, /질문 카드/);
  assert.match(nav, /한자 단어집/);

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

test("활동 선택과 설명은 통합 대상 다섯 활동만 같은 꾸러미로 안내한다", async () => {
  const activityIds = [
    "outline_builder",
    "question_generator",
    "question_voting",
    "one_line_share",
    "hanja_writing",
  ];

  for (const activityId of activityIds) {
    assert.match(roomNew, new RegExp(`"${activityId}"`));
  }

  assert.match(guide, /글쓰기 활동 꾸러미 5가지 핵심 활동/);
  assert.match(guide, /글 개요 짜기/);
  assert.match(guide, /질문 만들기/);
  assert.match(guide, /좋은 질문 고르기/);
  assert.match(guide, /한줄모아/);
  assert.match(guide, /한자 활용 문장 만들기/);
  assert.doesNotMatch(guide, /4대 모듈|4개 모듈|AI 자동 대기열|GPT/);
  await assert.rejects(access("src/app/dashboard/manual-modal.tsx"));
});
