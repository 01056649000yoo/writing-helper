import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  types,
  outline,
  questions,
  voting,
  oneLine,
  hanja,
  adapter,
  studentActions,
] = await Promise.all([
  readFile("src/features/activities/types.ts", "utf8"),
  readFile("src/features/activities/outline-builder/definition.ts", "utf8"),
  readFile("src/features/activities/question-generator/definition.ts", "utf8"),
  readFile("src/features/activities/question-voting/definition.ts", "utf8"),
  readFile("src/features/activities/one-line-share/definition.ts", "utf8"),
  readFile("src/features/activities/hanja-writing/definition.ts", "utf8"),
  readFile("src/lib/portable-results.ts", "utf8"),
  readFile("src/app/actions/student-actions.ts", "utf8"),
]);

test("모든 통합 활동 매니페스트가 버전 있는 표준 결과 변환기를 소유한다", () => {
  assert.match(types, /toPortableResult:/);
  for (const definition of [outline, questions, voting, oneLine, hanja]) {
    assert.match(definition, /schemaVersion: 1/);
    assert.match(definition, /resultKind:/);
    assert.match(definition, /toPortableResult:/);
  }
});

test("활동 완료는 활동별 RPC 대신 하나의 공통 결과 저장 RPC를 사용한다", () => {
  assert.match(adapter, /getActivityDefinition\(activityType\)/);
  assert.match(adapter, /definition\.integration\.toPortableResult/);
  assert.match(adapter, /\.rpc\("upsert_portable_result_v1"/);
  assert.doesNotMatch(adapter, /rpc\("(?:outline|question|one_line|hanja)/);

  const persistCalls = studentActions.match(/await persistPortableResult\(/g) ?? [];
  assert.equal(persistCalls.length, 5);
});

test("표준 결과 저장은 진행·완료 통합 세션만 허용하고 입력 크기를 제한한다", () => {
  assert.match(adapter, /\["in_progress", "done"\]\.includes\(session\.status\)/);
  assert.match(adapter, /chunks\.length === 0 \|\| chunks\.length > 100/);
  assert.match(adapter, /slice\(0, 10000\)/);
  assert.match(adapter, /p_activity_version: definition\.version/);
  assert.match(adapter, /p_schema_version: definition\.integration\.schemaVersion/);
});
