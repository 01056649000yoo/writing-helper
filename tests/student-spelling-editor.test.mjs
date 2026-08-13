import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activityPage = await readFile("src/app/room/[id]/activity/page.tsx", "utf8");
const spellingEditor = await readFile("src/components/student-spelling-textarea.tsx", "utf8");
const globalStyles = await readFile("src/app/globals.css", "utf8");

test("학생 활동의 실제 글 입력 화면은 아지트 글쓰기와 같은 1200px 폭 계약을 쓴다", () => {
  assert.equal((activityPage.match(/max-w-\[1200px\]/g) ?? []).length, 4);
  assert.match(activityPage, /w-full max-w-\[1200px\] space-y-4/);
  assert.doesNotMatch(activityPage, /max-w-lg mx-auto/);
});

test("다섯 학생 글 입력란은 공용 아지트 맞춤법 입력 컴포넌트를 쓴다", () => {
  assert.equal((activityPage.match(/<StudentSpellingTextarea/g) ?? []).length, 5);
  assert.match(spellingEditor, /elementary-detection-v1\.json/);
  assert.match(spellingEditor, /get_student_spelling_entries_v1/);
  assert.match(spellingEditor, /SCAN_DELAY_MS = 350/);
  assert.match(spellingEditor, /MAX_ISSUES = 50/);
  assert.match(spellingEditor, /spellingSourcesPromise/);
  assert.match(spellingEditor, /credentials: "same-origin"/);
});

test("맞춤법 입력은 모바일에서도 물결 밑줄과 교정 안내를 같은 위치에 겹쳐 그린다", () => {
  assert.match(spellingEditor, /lab-spelling__overlay/);
  assert.match(spellingEditor, /lab-spelling__notice/);
  assert.match(globalStyles, /\.lab-spelling__mark/);
  assert.match(globalStyles, /background-image: url\("data:image\/svg\+xml/);
  assert.match(globalStyles, /-webkit-text-size-adjust: 100%/);
});
