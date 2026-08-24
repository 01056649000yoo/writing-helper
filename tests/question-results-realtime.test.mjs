import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [studentActions, roomActions, livePanel] = await Promise.all([
  readFile("src/app/actions/student-actions.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
]);

test("학생 제출은 질문 원문 없이 최소 Realtime 신호만 남긴다", () => {
  const signalStart = studentActions.indexOf('.from("activity_events")');
  assert.notEqual(signalStart, -1, "activity event insert is missing");
  const signalEnd = studentActions.indexOf("\n    });", signalStart);
  assert.notEqual(signalEnd, -1, "activity event insert end is missing");
  const signalBlock = studentActions.slice(signalStart, signalEnd + 7);

  assert.match(signalBlock, /event_type: "question_generator_submitted"/);
  assert.match(signalBlock, /payload: \{ version: 1 \}/);
  assert.doesNotMatch(signalBlock, /remixedQuestion|originalPrompt|submission/);
  assert.match(studentActions, /submission signal failed/);
});

test("교사 결과 조회는 방 소유권을 다시 확인하고 최대 100명으로 제한한다", () => {
  const actionStart = roomActions.indexOf("export async function getQuestionGeneratorRoomResults");
  const actionEnd = roomActions.indexOf("type QuestionUpdate", actionStart);
  const actionBlock = roomActions.slice(actionStart, actionEnd);

  assert.match(actionBlock, /room\.teacher_id !== user\.id/);
  assert.match(actionBlock, /room\.activity_type !== "question_generator"/);
  assert.match(actionBlock, /\.eq\("status", "done"\)[\s\S]*\.limit\(100\)/);
});

test("실시간 구독은 모달이 열린 동안만 방별 최소 이벤트를 듣는다", () => {
  assert.match(livePanel, /createSupabaseBrowserClient/);
  assert.match(livePanel, /isQuestionResultsOpen/);
  assert.match(livePanel, /\.channel\(`teacher-question-results:\$\{roomId\}`\)/);
  assert.match(livePanel, /"postgres_changes"/);
  assert.match(livePanel, /schema: "writing_helper"/);
  assert.match(livePanel, /table: "activity_events"/);
  assert.match(livePanel, /filter: `room_id=eq\.\$\{roomId\}`/);
  assert.match(livePanel, /event\.event_type === "question_generator_submitted"/);
  assert.match(livePanel, /removeChannel\(channel\)/);
});

test("동시 제출은 1초로 합치고 연결 장애와 탭 복귀를 보완한다", () => {
  assert.match(livePanel, /scheduleEventRefresh[\s\S]*}, 1000\)/);
  assert.match(livePanel, /connectionMode === "live" \? 30000 : 5000/);
  assert.match(livePanel, /document\.visibilityState !== "visible"/);
  assert.match(livePanel, /visibilitychange/);
  assert.match(livePanel, /questionRefreshInFlightRef/);
  assert.match(livePanel, /questionRefreshQueuedRef/);

  const secureRefreshCalls = livePanel.match(/getQuestionGeneratorRoomResults\(roomId\)/g) ?? [];
  assert.equal(secureRefreshCalls.length, 1, "closed modal must not keep polling question results");
});

test("제출 전에도 전체 보기 창을 열고 진행 상황과 새 질문을 확인할 수 있다", () => {
  assert.match(livePanel, /전체 질문 실시간 보기/);
  assert.doesNotMatch(livePanel, /disabled=\{questionResults\.length === 0\}/);
  for (const label of ["제출 완료", "작성 중", "미접속", "모인 질문", "새 질문"]) {
    assert.ok(livePanel.includes(label), `${label} 표시가 없습니다.`);
  }
  assert.match(livePanel, /학생이 제출하면 이 창에 자동으로 올라옵니다/);
  assert.match(livePanel, /작성 중 내용은 공개되지 않아요/);
});

test("큰 모달에서 학생 이름을 누르면 위 질문 칠판에 그 학생 질문을 모아 보여 준다", () => {
  assert.match(livePanel, /h-\[92vh\][^\n]*max-w-7xl/);
  assert.match(livePanel, /aria-label="선택 학생 질문 칠판"/);
  assert.match(livePanel, /const \[boardSessionId, setBoardSessionId\] = useState<string \| null>\(null\)/);
  assert.match(livePanel, /const selectedBoardResult = results\.find/);
  assert.match(livePanel, /selectedBoardResult\.selections\.map/);
  assert.match(livePanel, /selection\.remixedQuestion/);
  assert.match(livePanel, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.ok(
    (livePanel.match(/aria-pressed=\{boardSessionId ===/g) ?? []).length >= 2,
    "학생별 보기와 질문만 보기 양쪽 이름이 모두 칠판 선택 버튼이어야 합니다.",
  );
  assert.ok(
    (livePanel.match(/칠판에서 보기/g) ?? []).length >= 2,
    "학생 이름 버튼의 용도가 두 보기 방식에 모두 표시되어야 합니다.",
  );
});

/*
 * 2026-08-24: 전체 질문 실시간 보기의 위쪽 요약이 큰 카드 넷이라 화면을 많이 먹었고,
 * 칠판 아래 학생 목록은 학생마다 질문을 모두 펼친 카드가 세로로 쌓여 30명이면 한참 내려야 했다.
 */
test("실시간 보기 요약은 한 줄이고 학생은 명단 카드로 골라 칠판에 띄운다", async () => {
  const panel = await readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8");

  // 요약은 곁눈질로 보는 숫자다. 큰 카드 넷으로 되돌아가면 걸린다.
  assert.doesNotMatch(panel, /<p className="mt-1 text-xl font-bold text-emerald-900">\{results\.length\}명<\/p>/);
  assert.match(panel, /label: "제출 완료", value: `\$\{results\.length\}명`/);

  // 명단은 격자 카드이고, 누르면 칠판에 뜬다.
  assert.match(panel, /학생 명단 · 누르면 칠판에 보여요/);
  assert.match(panel, /grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6/);
  assert.match(panel, /aria-label=\{`\$\{result\.studentNumber\}번 \$\{result\.studentName\} 질문 \$\{result\.selections\.length\}개를 칠판에서 보기`\}/);

  // 고른 학생을 알 수 있어야 하고, 칠판을 비울 수도 있어야 한다.
  assert.match(panel, /aria-pressed=\{isOnBoard\}/);
  assert.match(panel, /칠판 비우기/);
});
