import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [sharedResultCards, studentResult, teacherLivePanel, teacherResultPage, studentActions, studentActivity] = await Promise.all([
  readFile("src/components/question-generator-result-cards.tsx", "utf8"),
  readFile("src/app/room/[id]/result/page.tsx", "utf8"),
  readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
  readFile("src/app/dashboard/room/[id]/result/[sessionId]/page.tsx", "utf8"),
  readFile("src/app/actions/student-actions.ts", "utf8"),
  readFile("src/app/room/[id]/activity/page.tsx", "utf8"),
]);

test("question result source cards are hidden by default and use one shared toggle label", () => {
  assert.match(sharedResultCards, /useState\(false\)/);
  assert.match(sharedResultCards, /카드와 함께보기/);
  assert.match(sharedResultCards, /질문만 보기/);
  assert.match(sharedResultCards, /aria-pressed=\{showQuestionCards\}/);
});

test("students can reveal source cards from their result without changing the creation screen", () => {
  assert.match(studentResult, /QuestionCardVisibilityButton/);
  assert.match(studentResult, /showQuestionCards && selection\.originalPrompt/);
  assert.doesNotMatch(studentResult, /\{selection\.originalPrompt && \(/);

  assert.match(studentActivity, /selectedPrompt && \(/);
  assert.match(studentActivity, /고른 질문 카드/);
});

test("all teacher question result views hide source cards until the teacher opens them", () => {
  assert.match(teacherLivePanel, /QuestionCardVisibilityButton/);
  assert.ok(
    teacherLivePanel.match(/showQuestionCards && selection\.originalPrompt/g)?.length >= 3,
    "teacher collection, grouped view, and individual modal must all use the visibility state",
  );
  assert.doesNotMatch(teacherLivePanel, /\{selection\.originalPrompt && \(/);

  assert.match(teacherResultPage, /TeacherQuestionGeneratorResultList/);
  assert.doesNotMatch(teacherResultPage, /selection\.originalPrompt/);
});

test("hiding source cards is presentation-only so editing can restore the referenced card", () => {
  assert.match(studentActions, /originalPrompt:[\s\S]*selection\.originalPrompt/);
  assert.match(studentActivity, /setSelectedPrompt\(selection\.originalPrompt\)/);
});
