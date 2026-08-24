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
