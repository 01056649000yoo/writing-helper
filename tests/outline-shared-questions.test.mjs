import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [studentActions, activityPage, roomActions] = await Promise.all([
  readFile("src/app/actions/student-actions.ts", "utf8"),
  readFile("src/app/room/[id]/activity/page.tsx", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
]);

function actionSource(name, nextName) {
  const start = studentActions.indexOf(`export async function ${name}`);
  const end = studentActions.indexOf(`export async function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} 액션을 찾지 못했습니다.`);
  assert.notEqual(end, -1, `${nextName} 액션을 찾지 못했습니다.`);
  return studentActions.slice(start, end);
}

test("우리 반이 고른 질문을 득표순으로, 같은 교사·같은 학급에서만 조회한다", () => {
  const source = actionSource("getOutlineSharedQuestionCandidates", "getStudentRoomEntry");

  assert.match(source, /ownsIntegratedStudentSession\(admin, sessionId, roomId\)/);
  assert.match(source, /outlineRoom\.activity_type && outlineRoom\.activity_type !== "outline_builder"/);
  assert.match(source, /\.eq\("teacher_id", outlineRoom\.teacher_id\)/);
  assert.match(source, /\.eq\(classColumn, classId\)/);
  assert.match(source, /\.eq\("activity_type", "question_voting"\)/);
  assert.match(source, /normalizeQuestionVotingConfig\(room\.activity_config\)/);

  // 2026-08-20 결정 뒤집기: 후보 전체가 아니라 **친구들이 실제로 고른 질문**을 득표순으로 준다.
  // 개요에 넣을 질문은 "좋다고 뽑힌 것"이어야 좋은 질문 고르기 활동과 이어진다.
  assert.match(source, /buildQuestionVotingRanking\(config, submissionsByRoom/);
  assert.match(source, /entry\.votes > 0/);
  // 아직 아무도 고르지 않았으면 후보를 그대로 보여 준다(활동 직후에도 비어 보이지 않게).
  assert.match(source, /voted\.length > 0/);
  assert.match(source, /config\.sourceQuestions/);
  // 집계만 읽고 누가 골랐는지는 화면에 내보내지 않는다.
  assert.match(source, /\.select\("room_id, submission"\)/);
  assert.doesNotMatch(source, /student_name|agit_student_id/);
});

test("학생 질문 원본 ID는 숨기고 조회량은 최근 10개 활동·질문 100개로 제한한다", () => {
  const source = actionSource("getOutlineSharedQuestionCandidates", "getStudentRoomEntry");

  assert.match(source, /\.limit\(10\)/);
  assert.match(source, /remainingQuestionCount = 100/);
  assert.match(source, /id: `question-\$\{index \+ 1\}`/);
});

test("직접 추가하기를 눌렀을 때만 질문을 불러오고 선택한 질문 문장은 읽기 전용으로 보여준다", () => {
  assert.equal(
    activityPage.match(/getOutlineSharedQuestionCandidates\(sessionId, roomId\)/g)?.length,
    1,
  );
  assert.match(activityPage, /onClick=\{\(\) => openSharedQuestionPicker\(key\)\}/);
  assert.match(activityPage, /친구들과 만든 질문/);
  assert.match(activityPage, /custom\.itemId\.startsWith\(SHARED_QUESTION_ITEM_PREFIX\) \? \(/);
  assert.match(activityPage, /친구 질문 없이 내 항목 직접 쓰기/);
});

test("후보 데이터는 교사가 포함 여부와 교정 문장을 확정한 sourceQuestions이다", () => {
  assert.match(roomActions, /fullPayload\.filter\(\(entry\) => entry\.included\)/);
  assert.match(roomActions, /const text = question\.text\.trim\(\)/);
  assert.match(roomActions, /sourceQuestions: shuffledQuestions/);
});
