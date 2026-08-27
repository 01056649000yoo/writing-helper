import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ranking, voting, oneLine, votingBoard, oneLineBoard, resultPage, livePanel, teacherResult] =
  await Promise.all([
    readFile("src/lib/ranking.ts", "utf8"),
    readFile("src/lib/question-voting.ts", "utf8"),
    readFile("src/lib/one-line-share.ts", "utf8"),
    readFile("src/components/question-voting-ranking-summary.tsx", "utf8"),
    readFile("src/components/one-line-share-board.tsx", "utf8"),
    readFile("src/app/room/[id]/result/page.tsx", "utf8"),
    readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
    readFile("src/app/dashboard/room/[id]/result/[sessionId]/page.tsx", "utf8"),
  ]);

const guide = await readFile("src/features/activities/guide.ts", "utf8");

test("점수가 같으면 같은 등수를 주고 다음 등수를 건너뛴다", () => {
  // 자리(index)를 등수로 쓰면 5표가 나란히 둘일 때 한쪽이 금색 1위, 다른 쪽이 은색 2위가 된다.
  // 등수는 점수에서만 나와야 한다.
  assert.match(ranking, /export function rankByScore/);
  assert.match(ranking, /if \(previousScore === null \|\| score !== previousScore\) \{/);
  assert.match(ranking, /rank = index \+ 1;/);
  assert.match(ranking, /tied: \(sameScoreCount\.get\(score\) \?\? 0\) > 1/);
});

test("시상대는 상위 5등까지 보여 주고 같은 등수를 쪼개지 않는다", () => {
  assert.match(ranking, /PODIUM_TOP_RANKS = 5/);
  assert.match(ranking, /currentRank > PODIUM_TOP_RANKS\) break/);
  // 상한을 넘겨도 묶음을 반만 올리지 않는다 — 그러면 고치려던 임의의 자르기가 그대로 남는다.
  assert.match(ranking, /if \(!fits && picked\.length > 0\) break/);
});

test("아무도 고르지 않은 항목은 시상대에 올리지 않는다", () => {
  // 0점을 거르는 자리가 호출부마다 달라 어떤 화면에서는 `공동 3위 · 0표` 카드가 떴다.
  assert.match(ranking, /const scored = ranked\.filter\(\(item\) => scoreOf\(item\) > 0\)/);
});

test("등수 규칙은 활동마다 베끼지 않고 공용 모듈 하나만 쓴다", () => {
  // 활동마다 따로 두면 한쪽만 고쳐 두고 잊는다. 활동은 "점수가 무엇인지"만 알려 준다.
  for (const source of [voting, oneLine]) {
    assert.match(source, /from "@\/lib\/ranking"/);
    assert.match(source, /rankByScore\(/);
    assert.match(source, /pickPodium\(/);
    assert.doesNotMatch(source, /sameScoreCount|PODIUM_MAX_ITEMS/);
  }
  assert.match(voting, /const votesOf = \(item: \{ votes: number \}\) => item\.votes/);
  assert.match(oneLine, /const likesOf = \(entry: \{ likeCount: number \}\) => entry\.likeCount/);
});

test("두 활동 화면 모두 자리 번호가 아니라 등수로 표시한다", () => {
  assert.match(ranking, /item\.tied \? `공동 \$\{item\.rank\}위` : `\$\{item\.rank\}위`/);
  for (const source of [votingBoard, oneLineBoard]) {
    assert.match(source, /rankLabel\(/);
    assert.match(source, /PODIUM_STYLES\[\w+\.rank - 1\]/);
    assert.doesNotMatch(source, /\$\{index \+ 1\}위/);
    assert.doesNotMatch(source, /slice\(0, 3\)/);
  }
  // 시상대 색이 5등까지 있어야 4·5위가 3위 색을 물려받지 않는다.
  assert.equal((votingBoard.match(/accent: "text-/g) ?? []).length, 5);
  assert.equal((oneLineBoard.match(/border-\w+-200 bg-\w+-50",/g) ?? []).length, 5);
});

test("순위를 보여 주는 화면이 모두 같은 컴포넌트를 쓴다", () => {
  for (const source of [resultPage, livePanel, teacherResult]) {
    assert.match(source, /QuestionVotingTopRanks/);
    assert.match(source, /OneLineShareTopRanks/);
    assert.doesNotMatch(source, /TopThree/);
  }
});

test("도움말이 동률 규칙과 보여 주는 등수를 설명한다", () => {
  // 화면에 `공동 3위`가 뜨는데 안내에 한 줄도 없으면 선생님이 아이에게 설명할 근거가 없다.
  assert.match(guide, /표가 같으면 `공동 3위`처럼 같은 등수/);
  assert.match(guide, /하트 수가 같으면 `공동 1위`처럼 같은 등수/);
  assert.match(guide, /다섯 등수까지/);
  // 규칙(1, 2, 2, 4)을 말로 적어 두면 다음 사람이 코드를 열지 않아도 안다.
  assert.match(guide, /공동 2위가 둘이면 다음은 3위가 아니라 4위/);
});
