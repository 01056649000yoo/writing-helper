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

test("교사가 고르기 활동에 올린 최종 질문만 같은 교사·같은 학급에서 조회한다", () => {
  const source = actionSource("getOutlineSharedQuestionCandidates", "getStudentRoomEntry");

  assert.match(source, /ownsIntegratedStudentSession\(admin, sessionId, roomId\)/);
  assert.match(source, /outlineRoom\.activity_type && outlineRoom\.activity_type !== "outline_builder"/);
  assert.match(source, /\.eq\("teacher_id", outlineRoom\.teacher_id\)/);
  assert.match(source, /\.eq\(classColumn, classId\)/);
  assert.match(source, /\.eq\("activity_type", "question_voting"\)/);
  assert.match(source, /normalizeQuestionVotingConfig\(room\.activity_config\)/);
  assert.match(source, /config\.sourceQuestions/);
  assert.doesNotMatch(source, /student_sessions[\s\S]*submission/);
  assert.doesNotMatch(source, /buildQuestionVotingRanking/);
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
