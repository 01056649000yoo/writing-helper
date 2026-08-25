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
  // 2026-08-24: 단말 임시본이 서버보다 새것이면 그것으로 잇는다. 어느 쪽이든 저장 순서를 지킨다.
  assert.match(activityPage, /setTemplateAnswers\(restored\)/);
  assert.match(activityPage, /let restored = orderedAnswers;/);
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
  // 2026-08-24: 단말 임시본이 서버보다 새것이면 그것으로 잇는다. 어느 쪽이든 저장 순서를 지킨다.
  assert.match(activityPage, /setTemplateAnswers\(restored\)/);
  assert.match(activityPage, /let restored = orderedAnswers;/);
  assert.doesNotMatch(activityPage, /setTemplateAnswers\(\[\.\.\.teacherAnswers, \.\.\.studentAddedAnswers\]\)/);

  // 저장도 화면과 같은 배열 순서를 그대로 보내야 결과 화면 순서가 맞는다.
  assert.match(activityPage, /const submittable = templateAnswers\s*\n\s*\.filter/);
});

/*
 * 2026-08-24: 개요는 `개요 완성하기` 를 눌러야 처음 저장됐다. 20분 적다가 태블릿이 꺼지거나
 * 뒤로 가기를 누르면 전부 사라졌다. 아지트 학생 글쓰기와 **같은 값·같은 자리**로 임시 저장을 넣었다.
 */
test("개요는 아지트와 같은 간격으로 자동 저장하고 임시 저장 단추도 함께 둔다", () => {
  // ⚠️ 간격은 아지트 `StudentWriting.jsx` 와 같아야 한다. 한쪽만 바꾸면 두 화면이 다르게 움직인다.
  assert.match(activityPage, /const LOCAL_DRAFT_DEBOUNCE_MS = 3000;/);
  assert.match(activityPage, /const DB_BACKUP_INTERVAL_MS = 120000;/);

  // 저장하는 곳이 둘이다 — 이 단말과 서버.
  assert.match(activityPage, /window\.localStorage\.setItem\(outlineDraftStorageKey\(id\)/);
  assert.match(activityPage, /const result = await saveAnswers\(id, answers\)/);

  // 자동 저장만 두면 학생이 저장됐는지 알 수 없다. 직접 누르는 단추와 상태 표시가 함께 있어야 한다.
  assert.match(activityPage, /async function handleOutlineManualSave\(\)/);
  assert.match(activityPage, /임시 저장 💾/);
  assert.match(activityPage, /임시 저장 완료/);

  // 화면을 덮거나 떠날 때 마지막으로 한 번 남긴다 — 태블릿에서 가장 흔한 유실 경로다.
  assert.match(activityPage, /window\.addEventListener\("pagehide", flush\)/);
  assert.match(activityPage, /document\.visibilityState === "hidden"/);

  // 내용이 그대로면 보내지 않는다. 가만히 있는 학생이 2분마다 서버를 두드리면 안 된다.
  assert.match(activityPage, /snapshot === lastServerDraftRef\.current/);
  assert.match(activityPage, /snapshot === lastLocalDraftRef\.current/);
});

/*
 * ⚠️ 임시 저장에 **제출용 목록을 그대로 쓰면 안 된다.** 제출은 `label && answer` 가 있는 것만 보내는데,
 *    그 목록으로 임시 저장하면 아직 안 쓴 교사 항목이 저장본에서 빠진다. 다시 들어올 때 저장본에 없는
 *    교사 항목은 **학생이 뺀 것**으로 되살아나므로, 반쯤 쓰다 만 개요에서 안 쓴 항목이 통째로
 *    `뺀 항목` 으로 사라진다. 이 검사가 그 되돌아감을 막는다.
 */
test("임시 저장은 아직 안 쓴 항목도 담는다", () => {
  const draftBuilder = activityPage.slice(
    activityPage.indexOf("const buildOutlineDraftAnswers"),
    activityPage.indexOf("const outlineDraftRef"),
  );
  assert.ok(draftBuilder.length > 0, "임시 저장 목록을 만드는 곳을 찾지 못했다");

  // 뺀 항목만 걸러 낸다.
  assert.match(draftBuilder, /\.filter\(\(answer\) => !excluded\.has\(answer\.itemId\)\)/);
  // 빈 항목을 걸러 내면 안 된다.
  assert.doesNotMatch(draftBuilder, /a\.label && a\.answer/);
  assert.doesNotMatch(draftBuilder, /answer\.label && answer\.answer/);

  // 완성했으면 단말 임시본을 지운다. 남기면 다음에 낡은 것이 되살아난다.
  assert.match(activityPage, /window\.localStorage\.removeItem\(outlineDraftStorageKey\(sessionId\)\)/);
});

/*
 * 2026-08-25: 개요 짜기 화면이 "글이 너무 작다"는 지적을 받았다.
 *
 * ⚠️ 계단은 이미 아지트와 맞춰 뒀는데도 작았다. 원인은 계단이 아니라 **어느 단을 골랐나** 였다 —
 *    화면 전체가 `text-sm`(0.9rem)·`text-xs`(0.8rem)뿐이고 본문 크기(`text-base`)가 두 곳뿐이었다.
 *    여기는 **초등학생이 읽고 직접 쓰는 화면**이다. 읽는 글과 쓰는 칸은 본문 크기 이상이어야 한다.
 */
test("개요 짜기에서 학생이 읽고 쓰는 곳은 본문 크기 이상이다", () => {
  const outline = activityPage.slice(
    activityPage.indexOf('step === "outline_sections"'),
    activityPage.indexOf('sharedQuestionPickerSection && ('),
  );
  assert.ok(outline.length > 0, "개요 화면을 찾지 못했다");

  // 학생이 답할 질문(교사 항목·불러온 친구 질문)은 보조 글자가 아니다.
  assert.match(outline, /text-base font-semibold text-gray-800 flex-1 leading-relaxed/);
  assert.match(outline, /text-base font-semibold leading-relaxed text-gray-800/);

  // 직접 쓰는 칸 — 자기가 쓴 글이 잘 보여야 한다. 여기가 이 화면의 핵심이다.
  assert.match(outline, /rounded-2xl text-base text-gray-900 placeholder/);
  assert.match(outline, /rounded-xl text-base font-semibold text-gray-800 placeholder/);

  // 제목은 화면·구역 단계를 지킨다.
  // 여백은 머리말 재배치에서 바뀔 수 있다. 크기 단계만 못 박는다.
  assert.match(outline, /<h1 className="text-2xl font-bold text-gray-800[^"]*">주제:/);
  assert.match(outline, /<h2 className="text-xl font-bold text-orange-500/);

  // ⚠️ 읽는 문장을 꼬리표 크기(text-xs)로 되돌리면 걸린다.
  assert.doesNotMatch(outline, /text-xs text-orange-700 font-semibold/);
});

/*
 * 2026-08-25: 개요 짜기 상단이 **전부 가운데 정렬**이라 넓은 화면에서 양옆이 휑했고,
 * `남긴 항목 N개 · 작성 완료 N개` 가 따로 한 줄을 먹어 위쪽 여백이 컸다.
 *
 * ⚠️ 가운데 정렬은 짧은 글에만 어울린다. 최대 1200px 폭에서 제목 한 줄을 가운데 두면
 *    양옆이 통째로 빈다. 왼쪽 정렬로 가로를 쓰고, 곁눈질로 보는 숫자는 같은 줄 오른쪽 끝에 붙인다.
 */
test("개요 짜기 머리말은 가로를 쓰고 진행 숫자를 제목 줄에 붙인다", () => {
  const header = activityPage.slice(
    activityPage.indexOf('step === "outline_sections"'),
    activityPage.indexOf("sections.map"),
  );

  // 제목 묶음이 가운데로 몰리면 안 된다.
  assert.doesNotMatch(header, /<div className="text-center">/);
  assert.match(header, /flex flex-wrap items-end justify-between/);

  // 진행 숫자는 따로 줄을 먹지 않고 제목 줄 오른쪽에 붙는다.
  assert.match(header, /shrink-0 text-sm font-bold text-gray-500/);
  assert.match(header, /남긴 항목 <b className="text-gray-800">\{selectedCount\}<\/b>개/);

  // 학생이 읽는 안내라 본문 크기여야 한다.
  assert.match(header, /text-base font-semibold text-orange-700/);
});
