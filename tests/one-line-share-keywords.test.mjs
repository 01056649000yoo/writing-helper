import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * ⚠️ `.ts` 를 그대로 `import` 하지 않는다. 배포 관문은 **Node 20** 이라 타입을 못 벗겨 낸다
 *    (로컬 Node 22 에서는 통과해 2026-08-25 배포가 실패했다).
 *    다른 검사들과 같이 **소스를 읽어** 판정 규칙을 확인하고, 규칙 자체는 여기서 같은 방식으로 흉내 낸다.
 */
const oneLineShareSource = await readFile("src/lib/one-line-share.ts", "utf8");

const normalizeSearchText = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");
const keywordMatches = (content, keyword) => {
  const k = normalizeSearchText(keyword);
  const c = normalizeSearchText(content);
  return Boolean(k) && Boolean(c) && c.includes(k);
};
const getMatchingConfiguredKeywords = (content, keywords) =>
  keywords.filter((keyword) => keywordMatches(content, keyword));
const includesAllConfiguredKeywords = (content, keywords) =>
  keywords.length === 0 || getMatchingConfiguredKeywords(content, keywords).length === keywords.length;

test("판정 규칙은 소스와 같은 방식이다", () => {
  // 흉내 낸 규칙이 실제 코드와 어긋나면 아래 검사들이 헛돈다. 원본이 substring 방식인지 본다.
  assert.match(oneLineShareSource, /return normalizedContent\.includes\(normalizedKeyword\);/);
  assert.doesNotMatch(oneLineShareSource, /KOREAN_PARTICLE_SUFFIXES/);
});

/*
 * 2026-08-25: 핵심단어 `온난화` 를 정해 두고 학생이 `온난화가` 라고 쓰면 **못 썼다고 나왔다.**
 *
 * ⚠️ 예전 방식은 띄어쓰기로 자른 낱말이 핵심단어와 정확히 같거나, 정해 둔 조사 하나가 붙은
 *    경우만 인정했다. 조사 목록을 늘려도 끝이 없다 — 한국어는 붙는 말이 너무 많고
 *    **아이 글은 띄어쓰기가 고르지 않다.** 지금은 글 안에 그 낱말이 들어 있으면 인정한다.
 */
test("핵심단어는 조사가 붙거나 띄어쓰기를 빠뜨려도 인정한다", () => {
  const written = [
    "온난화가 심각하다",      // 조사
    "온난화는 문제다",
    "온난화때문에 걱정이다",   // 옛 목록에 없던 말
    "온난화가심각하다",        // 띄어쓰기 없음 — 아이 글에서 가장 흔하다
    "지구온난화가 심각하다",   // 합성어 안
    "온난화",                 // 낱말만
  ];
  for (const content of written) {
    assert.deepEqual(
      getMatchingConfiguredKeywords(content, ["온난화"]),
      ["온난화"],
      `"${content}" 를 못 썼다고 본다`,
    );
  }

  // 안 쓴 글은 그대로 걸러야 한다. 무엇이든 통과시키면 이 활동의 뜻이 사라진다.
  assert.deepEqual(getMatchingConfiguredKeywords("날씨가 좋다", ["온난화"]), []);
});

test("핵심단어가 여럿이면 모두 들어가야 통과한다", () => {
  assert.equal(includesAllConfiguredKeywords("증발과 물의순환을 배웠다", ["증발", "물의순환"]), true);
  assert.equal(includesAllConfiguredKeywords("증발만 배웠다", ["증발", "물의순환"]), false);
});

/*
 * ⚠️ 핵심단어 없이도 방이 만들어졌다. 이 활동은 **핵심단어를 넣어 문장을 만드는 것**이 전부라,
 *    없으면 학생 화면에 목표가 사라지고 무엇을 써도 통과한다.
 *    화면의 `required` 만으로는 못 막는다(자동 채움·옛 초안·직접 호출). 서버에서 막아야 한다.
 */
test("핵심단어 없이는 한 줄 모아 방을 만들 수 없다", async () => {
  const roomActions = await readFile("src/app/actions/room-actions.ts", "utf8");
  assert.match(roomActions, /if \(coreKeywords\.length === 0\) \{/);
  assert.match(roomActions, /핵심단어를 한 개 이상 적어주세요/);

  const newRoom = await readFile("src/app/dashboard/room/new/page.tsx", "utf8");
  assert.match(newRoom, /name="core_keywords"\n\s+required/);
});
