/**
 * 점수로 등수를 매기는 공용 규칙.
 *
 * 좋은 질문 고르기(표)와 한 줄 나눔(좋아요)이 같은 문제를 갖고 있었다 — 화면이 배열 자리
 * (`index + 1`)를 그대로 등수로 써서, **점수가 같은데 등수가 다르게** 보였다. 5표가 나란히
 * 둘이어도 하나는 금색 `1위`, 다른 하나는 은색 `2위`가 됐다. 갈리는 기준도 질문 내용과
 * 무관한 내부 ID 순서였다(한 줄 나눔은 제출 시각).
 *
 * 활동마다 따로 고치면 한쪽만 고쳐 두고 잊는다. 규칙은 여기 한 곳에만 둔다.
 */

/** 화면에 보여 줄 상위 등수. */
export const PODIUM_TOP_RANKS = 5;

/** 동률 때문에 카드가 끝없이 늘어나지 않게 두는 상한. */
const PODIUM_MAX_ITEMS = 8;

export type Ranked<T> = T & {
  /** 같은 점수는 같은 등수. 공동 1위가 둘이면 다음은 3위다. */
  rank: number;
  /** 같은 점수를 받은 항목이 또 있는가. 화면이 `공동 N위`로 표시할지 판단한다. */
  tied: boolean;
};

/**
 * 점수 내림차순으로 이미 정렬된 목록에 등수를 매긴다.
 *
 * 같은 점수는 같은 등수를 받고 그만큼 다음 등수를 건너뛴다(1, 1, 3).
 * 정렬은 호출부가 책임진다 — 동점일 때 어떤 순서로 둘지는 활동마다 다르기 때문이다.
 */
export function rankByScore<T>(items: T[], scoreOf: (item: T) => number): Ranked<T>[] {
  const sameScoreCount = new Map<number, number>();
  for (const item of items) {
    const score = scoreOf(item);
    sameScoreCount.set(score, (sameScoreCount.get(score) ?? 0) + 1);
  }

  let rank = 0;
  let previousScore: number | null = null;
  return items.map((item, index) => {
    const score = scoreOf(item);
    if (previousScore === null || score !== previousScore) {
      rank = index + 1;
      previousScore = score;
    }
    return { ...item, rank, tied: (sameScoreCount.get(score) ?? 0) > 1 };
  });
}

/**
 * 시상대에 올릴 묶음을 고른다.
 *
 * 같은 등수는 절대 쪼개지 않는다 — 점수가 같은데 한쪽만 올라가면 애초에 고치려던 그 임의의
 * 자르기가 그대로 남는다. 그래서 상한을 넘기는 묶음은 통째로 뺀다(첫 묶음은 예외로 항상 넣는다).
 *
 * 0점은 시상대에 올리지 않는다. 아무도 고르지 않은 것이 `공동 3위`로 뜨면 등수의 뜻이 무너진다.
 * 전체 목록에서는 0점도 그대로 보여 준다 — 거기서는 없어진 게 아니라 정보다.
 */
export function pickPodium<T>(ranked: Ranked<T>[], scoreOf: (item: T) => number): Ranked<T>[] {
  const scored = ranked.filter((item) => scoreOf(item) > 0);
  const picked: Ranked<T>[] = [];
  for (let index = 0; index < scored.length;) {
    const currentRank = scored[index].rank;
    if (currentRank > PODIUM_TOP_RANKS) break;
    const group = scored.filter((item) => item.rank === currentRank);
    const fits = picked.length + group.length <= PODIUM_MAX_ITEMS;
    if (!fits && picked.length > 0) break;
    picked.push(...group);
    index += group.length;
  }
  return picked;
}

/** 같은 점수에는 같은 이름표를 붙인다. `공동`이 빠지면 아이들은 왜 등수가 갈렸는지 알 수 없다. */
export function rankLabel(item: { rank: number; tied: boolean }) {
  return item.tied ? `공동 ${item.rank}위` : `${item.rank}위`;
}
