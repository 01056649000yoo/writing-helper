import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [config, roomActions, teacherForm, studentPage, teacherDetail] = await Promise.all([
  readFile("src/features/activities/question-generator/config.ts", "utf8"),
  readFile("src/app/actions/room-actions.ts", "utf8"),
  readFile("src/app/dashboard/room/new/page.tsx", "utf8"),
  readFile("src/app/room/[id]/activity/page.tsx", "utf8"),
  readFile("src/features/activities/teacher-detail/QuestionGeneratorDetail.tsx", "utf8"),
]);

test("질문 만들기 시작 조건은 방식마다 다르고, 판정의 원본은 한 파일이다", () => {
  // 직접 만들기는 준비물이 없다.
  assert.match(config, /if \(setup\.mode === "direct"\)/);
  // 선생님 추천 질문은 질문 1개 이상, 카드 방식은 묶음 1개 이상.
  assert.match(config, /학생에게 보여 줄 질문 예시를 1개 이상/);
  assert.match(config, /제공할 질문 카드 묶음을 1개 이상/);

  // 서버는 스스로 조건을 만들지 않고 공용 판정을 부른다.
  assert.match(roomActions, /buildQuestionGeneratorConfig\(\{ setup, teacherCardSets \}\)/);
  assert.doesNotMatch(roomActions, /질문 카드 묶음을 1개 이상 선택해주세요/);
  // 옛 조건(부연 설명 필수)은 화면이 "선택"이라 적으므로 남기지 않는다.
  assert.doesNotMatch(roomActions, /학생에게 보여줄 활동 가이드를 주제 부연 설명에/);
});

test("교사 화면은 서버와 같은 조건으로 먼저 막아 준다", () => {
  assert.match(teacherForm, /draft\.mode === "card_remix" && draft\.selectedCardSetIds\.length === 0/);
  assert.match(teacherForm, /draft\.mode === "ai_custom" && activeAiQuestions\.length === 0/);
  // 카드 내용은 서버가 교사 설정에서 다시 채운다 — 화면이 보낸 카드를 저장하지 않는다.
  assert.match(teacherForm, /enabledCardSetIds: draft\.mode === "card_remix"/);
});

test("옛 방에는 방식이 없다 — 카드 방식으로 읽는다", () => {
  assert.match(config, /return typeof value === "string" && \(QUESTION_GENERATOR_MODES as readonly string\[\]\)\.includes\(value\)/);
  assert.match(config, /: "card_remix";/);
});

test("학생 화면의 단계는 방식이 정한다", () => {
  assert.match(config, /direct: \[\{ key: "rewrite", label: "질문 쓰기" \}\]/);
  // 직접 쓰기는 입력창부터, 선생님 추천 질문은 질문 고르기부터 연다.
  assert.match(studentPage, /questionMode === "direct"\s*\n\s*\? "question_rewrite"\s*\n\s*: questionMode === "ai_custom"\s*\n\s*\? "question_set"/);
  assert.match(studentPage, /steps=\{questionSteps\}/);
  // 화면 안에 정규화 사본을 다시 두지 않는다.
  assert.doesNotMatch(studentPage, /function normalizeQuestionGeneratorConfig/);
  assert.match(studentPage, /normalizeQuestionGeneratorConfig,\n\s*questionGeneratorSteps,\n\} from "@\/features\/activities\/question-generator\/config"/);
});

test("교사 활동 내용 화면은 방식과 실제 질문 카드를 보여 준다", () => {
  assert.match(teacherDetail, /QUESTION_GENERATOR_MODE_META\[normalized\.mode\]/);
  // 카드 본문은 prompts 에 들어 있다 — 예전에는 없는 필드(cards)를 읽어 늘 비어 있었다.
  assert.match(teacherDetail, /cardSet\.prompts\.slice\(0, 6\)/);
});

test("학생은 역할이 아니라 질문의 큰 카테고리를 고른다", async () => {
  const areas = await readFile("src/features/activities/question-generator/areas.ts", "utf8");
  const settings = await readFile("src/app/dashboard/settings/page.tsx", "utf8");
  const roomNew = await readFile("src/app/dashboard/room/new/page.tsx", "utf8");

  // 6개 카테고리가 원본 한 곳에 있다.
  for (const area of ["상상·반전", "마음·가치", "감각·관찰", "이유·해결", "연결·비유", "관점·시간"]) {
    assert.ok(areas.includes(area), `${area} 카테고리 없음`);
  }

  // 교사 화면 두 곳과 학생 화면이 같은 기준을 부른다(각자 베껴 쓰지 않는다).
  assert.match(settings, /from "@\/features\/activities\/question-generator\/areas"/);
  assert.match(roomNew, /from "@\/features\/activities\/question-generator\/areas"/);
  assert.match(studentPage, /groupCardSetsByArea/);

  // 역할(탐정 모드·상담사 모드)은 학생 화면에서 사라졌다.
  // 주석의 이력 설명은 남겨 두고, 화면 문구·코드에서 역할이 사라졌는지 본다.
  assert.doesNotMatch(studentPage, /연구원 역할|RESEARCH_ROLES|selectedResearchRole/);
  assert.doesNotMatch(areas, /QuestionCardRole/);

  // 활동 설정에도 역할을 더는 담지 않는다.
  const config = await readFile("src/features/activities/question-generator/config.ts", "utf8");
  assert.doesNotMatch(config, /roles:/);
});
