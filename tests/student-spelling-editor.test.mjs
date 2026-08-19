import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activityPage = await readFile("src/app/room/[id]/activity/page.tsx", "utf8");
const spellingEditor = await readFile("src/components/student-spelling-textarea.tsx", "utf8");
const spellingLookup = await readFile("src/components/student-spelling-lookup-dialog.tsx", "utf8");
const globalStyles = await readFile("src/app/globals.css", "utf8");

test("학생 활동 화면은 아지트 글쓰기와 같은 1200px 폭 계약을 쓴다", () => {
  // 화면마다 폭이 널뛰지 않게 모든 학생 화면이 같은 폭을 쓴다(질문 만들기는 화면이 하나다).
  assert.equal((activityPage.match(/max-w-\[1200px\]/g) ?? []).length, 4);
  assert.match(activityPage, /mx-auto w-full max-w-\[1200px\] px-4 py-6 space-y-4/);
  assert.doesNotMatch(activityPage, /max-w-lg mx-auto/);
  assert.doesNotMatch(activityPage, /max-w-2xl mx-auto/);
});

test("다섯 학생 글 입력란은 공용 아지트 맞춤법 입력 컴포넌트를 쓴다", () => {
  assert.equal((activityPage.match(/<StudentSpellingTextarea/g) ?? []).length, 5);
  assert.match(spellingEditor, /elementary-detection-v1\.json/);
  assert.match(spellingEditor, /elementary-lookup-v1\.json/);
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

test("밑줄 교정 문구와 상시 버튼은 지연 로딩 맞춤법 찾아보기로 연결된다", () => {
  assert.match(spellingEditor, /lookupEntries/);
  assert.match(spellingEditor, /loadSpellingLookupEntries\(\)\.then/);
  assert.match(spellingEditor, /student-spelling-lookup-dialog/);
  assert.match(spellingEditor, /ssr: false/);
  assert.match(spellingEditor, /맞춤법 찾아보기/);
  assert.equal((spellingEditor.match(/aria-haspopup="dialog"/g) ?? []).length, 2);
  assert.match(spellingEditor, /className="lab-spelling__suggestion"/);
  assert.match(globalStyles, /\.lab-spelling__toolbar/);
  assert.match(globalStyles, /\.lab-spelling-lookup__panel/);
});

test("맞춤법 찾아보기는 설명·예문·출처 검색과 키보드 접근성을 제공한다", () => {
  assert.match(spellingLookup, /useDeferredValue/);
  assert.match(spellingLookup, /role="dialog"/);
  assert.match(spellingLookup, /aria-modal="true"/);
  assert.match(spellingLookup, /event\.key === "Escape"/);
  assert.match(spellingLookup, /FOCUSABLE_SELECTOR/);
  assert.match(spellingLookup, /entry\.explanation/);
  assert.match(spellingLookup, /entry\.examples/);
  assert.match(spellingLookup, /entry\.source\.label/);
  assert.match(spellingLookup, /createOfficialDictionarySearchUrl/);
  assert.match(spellingLookup, /글은 자동으로 바꾸지 않으니/);
});
