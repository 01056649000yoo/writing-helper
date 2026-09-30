import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * 질문 만들기에 선생님이 질문을 더한다 (2026-09-30).
 * 선생님 질문은 방에 딸린 표에 따로 두고(학생 제출 수에 섞지 않음), 좋은 질문 고르기 후보로 담긴 채 이어진다.
 */

const [actions, lib, roomActions, livePanel, adder, votingSetup, guide] = await Promise.all([
  readFile("src/app/actions/teacher-question-actions.ts", "utf8"),
  readFile("src/lib/room-teacher-questions.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
  readFile("src/components/teacher-question-adder.tsx", "utf8"),
  readFile("src/app/dashboard/room/new/page.tsx", "utf8"),
  readFile("src/features/activities/guide.ts", "utf8"),
]);

test("선생님 질문은 방을 만든 선생님만, 질문 만들기 방에서만 더하고 고치고 지운다", () => {
  assert.match(actions, /room\.teacher_id === teacherId && room\.activity_type === "question_generator"/);
  for (const name of ["getRoomTeacherQuestions", "addRoomTeacherQuestion", "updateRoomTeacherQuestion", "deleteRoomTeacherQuestion"]) {
    const start = actions.indexOf(`export async function ${name}`);
    assert.notEqual(start, -1, `${name} 가 없습니다.`);
    const end = actions.indexOf("\nexport async function", start + 1);
    const body = actions.slice(start, end === -1 ? undefined : end);
    assert.match(body, /getCurrentUser\(\)/, `${name} 가 로그인을 확인하지 않습니다.`);
    assert.match(body, /ownsQuestionGeneratorRoom/, `${name} 가 방 주인을 확인하지 않습니다.`);
  }
  // 고치기·지우기는 id 만이 아니라 방까지 맞춰 다른 방 질문을 건드리지 못한다.
  assert.equal((actions.match(/\.eq\("room_id", roomId\)/g) ?? []).length >= 3, true);
  assert.match(actions, /TEACHER_QUESTION_MAX_PER_ROOM/);
});

test("학생 제출에 끼워 넣지 않고 방에 딸린 표에 둔다", () => {
  assert.match(lib, /from\("room_teacher_questions"\)/);
  assert.doesNotMatch(actions, /from\("student_sessions"\)/, "선생님 질문을 학생 제출에 넣으면 제출 수가 어긋납니다.");
});

test("좋은 질문 고르기 원본 두 곳 모두 선생님 질문을 담긴 채로 싣는다", () => {
  assert.match(roomActions, /pickedForVoting: true,\s*fromTeacher: true/);
  const listStart = roomActions.indexOf("export async function getQuestionGeneratorSourceRooms");
  const summaryStart = roomActions.indexOf("async function getQuestionGeneratorSourceRoomSummary");
  for (const [name, start] of [["목록", listStart], ["방 하나", summaryStart]]) {
    const body = roomActions.slice(start, start + 2500);
    assert.match(body, /loadTeacherQuestionsByRoom\(admin/, `${name} 원본이 선생님 질문을 읽지 않습니다.`);
    assert.match(body, /teacherQuestionsAsSource\(/, `${name} 원본에 선생님 질문이 실리지 않습니다.`);
  }
  // 후보에는 id·문장만 남는다 — 학생 투표 화면에 선생님 질문이 드러나지 않는다.
  assert.match(roomActions, /return \{ id: source\.id, text \};/);
  // 고르기 방을 만들며 선생님 질문을 고치면 원본 표도 고친다.
  assert.match(roomActions, /parseTeacherQuestionSourceId\(source\.id\)/);
});

test("실시간 보기에 추가 칸이 있고, 고르기 방 만들기에서 선생님 질문을 알아볼 수 있다", () => {
  assert.match(livePanel, /<TeacherQuestionAdder roomId=\{roomId\} \/>/);
  assert.match(adder, /\+ 선생님 질문 추가/);
  assert.match(votingSetup, /question\.fromTeacher &&/);
  assert.match(votingSetup, /fromTeacher: question\.fromTeacher/);
  assert.match(guide, /\+ 선생님 질문 추가/);
});
