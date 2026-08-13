import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  roster,
  classActions,
  roomActions,
  studentActions,
  studentSession,
  roomEntryPage,
  roomEntryClient,
  dashboard,
  classPage,
  rosterManager,
  livePanel,
] = await Promise.all([
  readFile("src/lib/lab-roster.ts", "utf8"),
  readFile("src/app/actions/class-actions.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/actions/student-actions.ts", "utf8"),
  readFile("src/lib/lab-student-session.ts", "utf8"),
  readFile("src/app/room/[id]/page.tsx", "utf8"),
  readFile("src/app/room/[id]/room-entry-client.tsx", "utf8"),
  readFile("src/app/dashboard/dashboard-tabs.tsx", "utf8"),
  readFile("src/app/dashboard/class/[id]/page.tsx", "utf8"),
  readFile("src/app/dashboard/class/[id]/roster-manager.tsx", "utf8"),
  readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
]);

test("통합 연구소는 아지트 학급·활성 학생을 단일 원장으로 읽는다", () => {
  assert.match(roster, /\.from\("classes"\)/);
  assert.match(roster, /\.eq\("teacher_id", teacherId\)/);
  assert.match(roster, /\.from\("students"\)/);
  assert.match(roster, /\.eq\("class_id", classId\)/);
  assert.match(roster, /\.eq\("is_active", true\)/);
  assert.match(roster, /\.is\("deleted_at", null\)/);
  assert.match(roster, /\.limit\(100\)/);
  assert.match(classActions, /getIntegratedTeacherClasses/);
  assert.match(classActions, /getIntegratedClassStudents/);
  assert.match(classActions, /getIntegratedClassWorkspace/);
  assert.match(roster, /const \[students, rooms\] = await Promise\.all/);
});

test("통합 모드에서는 연구소 학급과 학생을 별도로 만들거나 삭제하지 않는다", () => {
  assert.match(classActions, /통합 연구소의 학급과 학생은 끄적끄적 아지트에서 관리합니다/);
  assert.match(classActions, /학생 명단은 끄적끄적 아지트의 학급 관리에서 수정해주세요/);
  assert.match(dashboard, /integratedRoster \? \(/);
  assert.match(dashboard, /아지트에서 학급 관리/);
  assert.match(classPage, /readOnly=\{integratedRoster\}/);
  assert.match(rosterManager, /학생 추가·이름 변경·삭제는 아지트 학급 관리에서 한 번만 처리합니다/);
});

test("신규 활동과 결과는 아지트 학급·학생 ID를 직접 저장한다", () => {
  assert.match(roomActions, /\{ class_id: null, agit_class_id: classId \}/);
  assert.match(roomActions, /getIntegratedTeacherClass\(admin, user\.id, classId\)/);
  assert.match(roster, /\.eq\("agit_class_id", classId\)/);
  assert.match(roomActions, /isIntegratedLab\(\) \? "agit_class_id" : "class_id"/);
  assert.match(studentSession, /agit_student_id: student\.id/);
  assert.match(studentSession, /\.eq\("agit_student_id", student\.id\)/);
  assert.match(livePanel, /connectedStudentIds\.has\(student\.id\)/);
});

test("통합 학생은 실제 로그인 연결로 자동 입장하고 번호·이름 입력을 사용하지 않는다", () => {
  assert.match(studentSession, /supabase\.auth\.getUser\(\)/);
  assert.match(studentSession, /\.eq\("auth_id", authData\.user\.id\)/);
  assert.match(studentSession, /room\.agit_class_id !== student\.class_id/);
  assert.match(studentSession, /\.eq\("is_active", true\)/);
  assert.match(studentSession, /\.is\("deleted_at", null\)/);
  assert.match(roomEntryPage, /ensureIntegratedStudentRoomSession\(roomId\)/);
  assert.match(roomEntryClient, /router\.replace\(/);
  assert.match(studentActions, /if \(isIntegratedLab\(\)\) \{[\s\S]*ensureIntegratedStudentRoomSession\(roomId\)/);
});

test("통합 학생의 읽기·저장·반응은 본인 세션 소유권을 공통 검사한다", () => {
  assert.match(studentSession, /getAuthenticatedIntegratedStudent\(admin\)/);
  assert.match(studentSession, /\.eq\("id", sessionId\)[\s\S]*\.eq\("agit_student_id", student\.id\)/);
  const guardCalls = studentActions.match(/await ownsIntegratedStudentSession\(/g) ?? [];
  assert.ok(guardCalls.length >= 12, `학생 동작 소유권 검사가 부족합니다: ${guardCalls.length}개`);
});
