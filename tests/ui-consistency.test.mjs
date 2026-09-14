import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
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

test("도움말은 최신 아지트 참고함과 개요 고정 흐름을 정확히 설명한다", async () => {
  const guideSource = await readFile("src/features/activities/guide.ts", "utf8");

  // 개요는 본문에 한 번 복사하는 자료가 아니라 과제에 고정해 학생·교사가 최신본을 함께 본다.
  for (const phrase of [
    "과제명과 개요 전체를 다시 확인",
    "이 기기와 서버에 자동 저장",
    "그 과제에 고정",
    "최종 승인 전에는 다른 개요로 바꿀 수 있고",
    "선생님 글 확인 화면에 최신 저장 내용",
  ]) {
    assert.ok(guideSource.includes(phrase), `최신 개요 흐름 안내가 빠졌습니다: ${phrase}`);
  }

  // 질문 만들기 원문과 학생이 실제로 고른 질문을 혼동하면 참고함에서 보이지 않는 자료를 안내하게 된다.
  assert.match(guideSource, /질문 만들기 원문을 참고함에 바로 넣는 것이 아니라/);
  assert.match(guideSource, /직접 고른 좋은 질문/);
  assert.match(guideSource, /전체 질문 실시간 보기/);
  assert.match(guideSource, /연결은 기본으로 켜져 있으며 교사 설정에서 끌 수도 있습니다/);
  assert.doesNotMatch(guideSource, /본문에 바로 넣어 글의 뼈대로 씁니다/);
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

test("계단을 비켜 간 글자 크기가 없다", () => {
  /*
   * 2026-09-14: 계단은 2026-08-24 에 맞췄는데 **비켜 간 자리**가 남아 있었다.
   * 화면 코드에 `text-[11px]` 54곳·`text-[10px]` 11곳, globals.css 에 0.68~0.78rem 열 곳이
   * 박혀 있었다. 계단의 바닥은 0.8rem 이다 — 그 아래는 아이가 태블릿에서 못 읽는다.
   * 아지트와 나란히 놓았을 때 느껴지던 이질감의 정체가 이것이었다.
   *
   * 한 자리만 고치면 또 흩어지므로 **비켜 가는 방식 자체**를 막는다.
   */
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk("src");

  const offenders = [];
  for (const file of files) {
    // 주석에 적힌 보기(`text-[13px]` 처럼)는 세지 않는다.
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const match of code.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (Number(match[1]) < 12.8) offenders.push(`${file} ${match[0]}`);
    }
    for (const match of code.matchAll(/font-size:\s*(0\.\d+)rem/g)) {
      if (Number(match[1]) < 0.8) offenders.push(`${file} font-size:${match[1]}rem`);
    }
  }
  assert.deepEqual(offenders, [], `계단보다 작은 글자: ${offenders.slice(0, 5).join(", ")}`);
});

test("교사용 공통 셸은 아지트의 전체 폭과 글자 계단을 따른다", () => {
  const shellStart = globals.indexOf(".lab-shell {");
  const shellEnd = globals.indexOf("@media (prefers-reduced-motion: reduce)", shellStart);
  const shellStyles = globals.slice(shellStart, shellEnd);

  assert.match(shellStyles, /\.lab-shell__header,[\s\S]*width:\s*100%;[\s\S]*padding-inline:\s*clamp\(24px,\s*1\.5vw,\s*48px\)/);
  assert.doesNotMatch(shellStyles, /width:\s*min\(100%\s*-\s*32px,\s*1280px\)/);
  assert.match(shellStyles, /@media \(max-width:\s*1023px\)[\s\S]*\.lab-shell__header,[\s\S]*padding-inline:\s*16px/);
  assert.match(shellStyles, /@media \(max-width:\s*1023px\)[\s\S]*\.lab-shell__nav\s*\{[\s\S]*padding-inline:\s*8px/);
  assert.match(shellStyles, /@media \(max-width:\s*600px\)[\s\S]*\.lab-page__content\s*\{[\s\S]*padding-inline:\s*12px/);

  for (const selector of [
    "lab-brand__eyebrow",
    "lab-brand__title",
    "lab-profile",
    "lab-nav-link",
    "lab-page-heading h1",
    "lab-page-heading p",
    "lab-breadcrumb",
    "lab-button",
    "lab-chip",
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(shellStyles, new RegExp(`\\.${escaped}\\s*\\{[\\s\\S]*?font-size:\\s*var\\(--text-`), `${selector}가 공통 글자 계단을 쓰지 않는다`);
  }
});

test("연구소 상단 메뉴는 PC에서 읽기 쉽고 모바일에서는 넘치지 않는다", () => {
  assert.match(globals, /\.lab-shell__nav\s*\{[\s\S]*?min-height:\s*52px;[\s\S]*?gap:\s*var\(--ui-space-2\)/);
  assert.match(globals, /\.lab-nav-link\s*\{[\s\S]*?min-height:\s*52px;[\s\S]*?padding-inline:\s*var\(--ui-space-5\);[\s\S]*?font-size:\s*var\(--text-base\)/);
  assert.match(globals, /@media \(max-width:\s*767px\)[\s\S]*?\.lab-shell__nav\s*\{[\s\S]*?gap:\s*var\(--ui-space-1\)/);
  assert.match(globals, /@media \(max-width:\s*767px\)[\s\S]*?\.lab-nav-link\s*\{[\s\S]*?min-height:\s*46px;[\s\S]*?padding-inline:\s*var\(--ui-space-3\);[\s\S]*?font-size:\s*var\(--text-sm\)/);
});

test("읽는 문장에는 가장 작은 칸을 쓰지 않는다", () => {
  /*
   * 2026-09-14 지적: 활동 만들기 화면 글씨가 너무 작다.
   *
   * 연구소가 스스로 적어 둔 규칙이 있다 — `text-xs` 는 **뱃지·꼬리표 전용**이고 읽어야 하는
   * 문장에는 `text-sm` 아래를 쓰지 않는다. 그런데 활동 만들기 한 화면에만 `text-xs` 가 81곳,
   * 학생이 보는 활동 화면까지 합치면 11개 화면 170곳이었다. 규칙이 글로만 있었다.
   *
   * 뱃지는 `uppercase` · `tracking-wide` · `rounded-full` 로 알아본다. 그 밖의 자리에서
   * 가장 작은 칸을 쓰면 여기서 걸린다.
   */
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) files.push(full);
    }
  };
  walk("src");

  const badge = ["uppercase", "tracking-wide", "rounded-full"];
  const offenders = [];
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/className="([^"]*\btext-xs\b[^"]*)"/g)) {
      if (!badge.some((mark) => match[1].includes(mark))) offenders.push(`${file}: ${match[1].slice(0, 40)}`);
    }
  }
  assert.deepEqual(offenders, [], `읽는 문장에 가장 작은 칸: ${offenders.slice(0, 3).join(" / ")}`);
});

test("연구소 상단 메뉴는 아지트와 같은 모양이다", () => {
  /*
   * 2026-09-14 지적: 두 앱을 오갈 때 이질감이 있다.
   * 아지트의 업무 메뉴는 **회색 줄 위에 지금 자리만 흰 바탕으로 떠오르고**, 글자는 0.95rem,
   * `아이콘 + 이름` 모양이다. 연구소는 흰 줄에 연파랑이 칠해지고 글자가 1rem, 이름만 있었다.
   *
   * ⚠️ 아지트 쪽 원본은 `vibe_agit/src/components/teacher/TeacherDashboard.jsx` 의 메뉴 항목과
   *    `TeacherDashboard.css` 다. 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.
   */
  const linkStart = globals.indexOf(".lab-nav-link {");
  const linkStyles = globals.slice(linkStart, globals.indexOf(".lab-nav-link[aria-current=\"page\"]::after", linkStart));
  assert.match(linkStyles, /font-size:\s*0\.95rem/);
  // 활성은 흰 바탕으로 떠오른다. 연파랑을 칠하지 않는다.
  assert.match(linkStyles, /\[aria-current="page"\]\s*\{[^}]*background:\s*var\(--ui-surface\)/);
  assert.doesNotMatch(linkStyles, /\[aria-current="page"\]\s*\{[^}]*var\(--ui-primary-soft\)/);
  // 메뉴 줄은 머리말과 다른 층이다.
  assert.match(globals, /\.lab-shell__nav-wrap \{[^}]*background:\s*var\(--ui-surface-muted\)/);
  // 아이콘은 뜻을 돕는 장식이라 화면 낭독에서는 숨긴다.
  assert.match(nav, /<span aria-hidden="true">\{item\.icon\}<\/span>/);
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

test("학급이 하나뿐인 선생님에게는 `학급 목록` 되돌아가기를 보이지 않는다", () => {
  /*
   * 왜 이 검사가 있나 (2026-09-09):
   *   학급 화면의 `← 학급 목록` 은 `/dashboard` 로 간다. 그런데 `/dashboard` 는 학급이 1개면
   *   곧바로 그 학급으로 되돌려 보낸다. 즉 학급이 하나인 선생님이 누르면 화면만 깜빡이고
   *   같은 자리로 돌아온다 — 아무 일도 하지 않는 버튼이다. 당시 승인 교사 526명 중 506명이
   *   학급 1개였다.
   *
   *   두 화면이 짝이라 한쪽만 고치면 어긋난다. 그래서 둘을 함께 본다.
   *   `/dashboard` 의 자동 넘김이 사라지면 이 숨김은 근거를 잃고, 반대로 숨김이 사라지면
   *   대부분의 선생님이 다시 제자리걸음 버튼을 보게 된다.
   */
  assert.match(dashboard, /classes\.length === 1/);
  assert.match(dashboard, /redirect\(`\/dashboard\/class\/\$\{classes\[0\]\.id\}`\)/);

  assert.match(classPage, /classes\.length > 1/);
  assert.match(classPage, /canSwitchClass && \(/);

  // 되돌아가기 자체는 남아 있어야 한다 — 학급이 여럿인 선생님에게는 다른 학급으로 가는 유일한 길이다.
  assert.match(classPage, /href="\/dashboard" className="lab-breadcrumb">← 학급 목록/);

  // 아지트로 나가는 길은 이 변경과 무관하게 늘 열려 있어야 한다.
  assert.match(layout, /아지트로 돌아가기/);
});
