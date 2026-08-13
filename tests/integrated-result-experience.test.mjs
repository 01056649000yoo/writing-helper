import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  roomDetailPage,
  liveStudentPanel,
  teacherResultPage,
  studentResultPage,
  globalStyles,
] = await Promise.all([
  readFile("src/app/dashboard/room/[id]/page.tsx", "utf8"),
  readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
  readFile("src/app/dashboard/room/[id]/result/[sessionId]/page.tsx", "utf8"),
  readFile("src/app/room/[id]/result/page.tsx", "utf8"),
  readFile("src/app/globals.css", "utf8"),
]);

test("통합 연구소의 학생 결과 보기에는 개인 결과 QR과 QR 버튼을 표시하지 않는다", () => {
  assert.match(roomDetailPage, /showResultQr=\{!integratedLab\}/);
  assert.match(liveStudentPanel, /showResultQr && qrTarget \?/);
  assert.match(liveStudentPanel, /activityType === "outline_builder" && showResultQr \?/);
  assert.match(liveStudentPanel, /보기 → 학생 개요 상세/);
  assert.match(teacherResultPage, /const integratedLab = isIntegratedLab\(\)/);
  assert.match(teacherResultPage, /const showLegacyResultQr = !integratedLab/);
  assert.match(teacherResultPage, /\{showLegacyResultQr \? \(/);
});

test("학생과 교사의 개요 완성 화면은 입력 화면과 같은 1200px 폭을 사용한다", () => {
  assert.match(studentResultPage, /w-full max-w-\[1200px\] mx-auto pt-8 pb-16 space-y-4/);
  assert.doesNotMatch(studentResultPage, /max-w-lg mx-auto/);
  assert.match(teacherResultPage, /isOutlineBuilder \? "lab-page__content--writing"/);
  assert.match(globalStyles, /\.lab-page__content--writing \{\s*max-width: 1200px;/);
});
