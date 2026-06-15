import { createHash } from "crypto";

// 학생 익명성 보호용 결정적 셔플: 같은 시드면 모두에게 같은 순서가 보이지만,
// 제출 순서·학생별 묶음 같은 원본 정렬 정보는 드러나지 않는다.
export function deterministicShuffle<T>(items: T[], seed: string, keyOf: (item: T) => string): T[] {
  return items
    .map((item) => ({
      item,
      sortKey: createHash("sha256").update(`${seed}:${keyOf(item)}`).digest("hex"),
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ item }) => item);
}
