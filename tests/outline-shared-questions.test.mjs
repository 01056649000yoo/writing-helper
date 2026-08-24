import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [studentActions, activityPage, roomActions, guideSource] = await Promise.all([
  readFile("src/app/actions/student-actions.ts", "utf8"),
  readFile("src/app/room/[id]/activity/page.tsx", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/features/activities/guide.ts", "utf8"),
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
  // 2026-08-24: 한 목록으로 합치며 `custom` 이 `answer` 가 됐다. 읽기 전용 표시는 그대로다.
  assert.match(activityPage, /const isSharedQuestion = answer\.itemId\.startsWith\(SHARED_QUESTION_ITEM_PREFIX\);/);
  assert.match(activityPage, /\{!isTeacherItem && \(isSharedQuestion \? \(/);
  assert.match(activityPage, /친구 질문 없이 내 항목 직접 쓰기/);
});

test("학생이 교사 개요 항목을 빼면 질문을 숨기고 제출에서도 제외하며 되돌릴 수 있다", () => {
  assert.match(activityPage, /const \[excludedTemplateItemIds, setExcludedTemplateItemIds\] = useState<string\[]>\(\[\]\)/);
  // 2026-08-24: 학생이 옮긴 순서를 지키려고 저장 순서로 정렬해 넣는다. 교사 항목이 모두
  // 목록에 들어온다는 계약은 그대로다(뺀 항목도 목록에 남아 있어야 다시 넣을 수 있다).
  assert.match(activityPage, /\[\.\.\.teacherAnswers, \.\.\.studentAddedAnswers\]\.sort\(/);
  assert.match(activityPage, /setTemplateAnswers\(orderedAnswers\)/);
  // 뺀 항목은 한 목록에서 걸러 낸다.
  assert.match(activityPage, /a\.section === key && !excludedItemIds\.has\(a\.itemId\)/);
  assert.match(activityPage, /\.filter\(\(answer\) => !excludedItemIds\.has\(answer\.itemId\)\)/);
  assert.match(activityPage, /뺀 항목 \{excludedTeacherItems\.length\}개 · 다시 넣기/);
  assert.match(activityPage, /onClick=\{\(\) => restoreTemplateItem\(item, key\)\}/);
  assert.doesNotMatch(activityPage, /\+ 쓸래요/);
  assert.match(guideSource, /`빼기`로 숨기고 접힌 `뺀 항목`에서 다시 넣을 수 있습니다/);
});

test("후보 데이터는 교사가 포함 여부와 교정 문장을 확정한 sourceQuestions이다", () => {
  assert.match(roomActions, /fullPayload\.filter\(\(entry\) => entry\.included\)/);
  assert.match(roomActions, /const text = question\.text\.trim\(\)/);
  assert.match(roomActions, /sourceQuestions: shuffledQuestions/);
});

/*
 * 2026-08-24: 불러온 질문이 늘 갈래(처음·가운데·끝) **맨 뒤**에 붙어, 학생이 원하는 자리에 둘 수
 * 없었다. 갈래 안에서 순서를 바꿀 수 있게 했다.
 *
 * ⚠️ 예전에는 교사 항목과 학생 항목을 **각각 다른 곳에서 순서를 받아** 그렸다(교사 항목은 틀 순서,
 *    학생 항목은 배열 뒤). 순서의 원본이 둘이면 옮겨도 화면이 안 따라오거나 저장된 순서와 어긋난다.
 *    이 검사는 순서의 원본이 `templateAnswers` **하나**로 유지되는지 본다.
 */
test("개요 항목은 갈래 안에서 순서를 바꿀 수 있고 순서의 원본이 하나다", () => {
  // 한 목록으로 그린다 — 교사 항목만 따로 그리던 옛 방식이 돌아오면 걸린다.
  assert.match(activityPage, /const sectionAnswers = templateAnswers\.filter\(/);
  assert.doesNotMatch(activityPage, /const customAnswers = templateAnswers\.filter\(/);

  // 옮기는 두 가지 방법이 모두 있어야 한다.
  assert.match(activityPage, /function moveTemplateItem\(itemId: string, direction: -1 \| 1\)/);
  assert.match(activityPage, /function dropTemplateItem\(draggedId: string, targetId: string\)/);

  // ⚠️ 끌기만 두면 태블릿·키보드에서 못 옮긴다. 같은 일을 하는 단추가 반드시 함께 있어야 한다.
  assert.match(activityPage, /moveTemplateItem\(answer\.itemId, -1\)/);
  assert.match(activityPage, /moveTemplateItem\(answer\.itemId, 1\)/);
  assert.match(activityPage, /aria-label=\{`\$\{answer\.label \|\| "이 항목"\} 위로 옮기기`\}/);

  // 처음·가운데·끝은 글의 구조라 갈래를 넘어가면 뜻이 달라진다. 넘어가는 이동은 막는다.
  assert.match(activityPage, /if \(prev\[from\]\.section !== prev\[to\]\.section\) return prev;/);
});

test("학생이 바꾼 개요 순서는 다시 들어와도 남는다", () => {
  // 교사 틀 순서로 다시 세우면 학생이 옮긴 순서가 사라진다. 저장된 순서를 먼저 따른다.
  assert.match(activityPage, /const savedOrder = new Map\(savedAnswers\.map\(\(answer, index\) => \[answer\.itemId, index\]\)\)/);
  assert.match(activityPage, /setTemplateAnswers\(orderedAnswers\)/);
  assert.doesNotMatch(activityPage, /setTemplateAnswers\(\[\.\.\.teacherAnswers, \.\.\.studentAddedAnswers\]\)/);

  // 저장도 화면과 같은 배열 순서를 그대로 보내야 결과 화면 순서가 맞는다.
  assert.match(activityPage, /const submittable = templateAnswers\s*\n\s*\.filter/);
});
