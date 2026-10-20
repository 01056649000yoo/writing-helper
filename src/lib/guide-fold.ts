/*
 * 도움말 한 항목이 길 때 **첫 문장만 먼저** 보이게 나눈다(2026-10-20, "글이 한 화면에 너무 많다").
 * 아지트 활용 안내서(`guideFold.js`)와 같은 규칙이다. `**굵게**`·`` `버튼` `` 표기가 짝이 맞는 자리에서만 자르고,
 * 나눌 만한 자리가 없거나 뒤에 남는 말이 너무 짧으면 나누지 않는다.
 */
export const GUIDE_FOLD_MIN_LENGTH = 110;
const MIN_LEAD = 14;
const MIN_REST = 30;

const plainLength = (text: string) => text.replace(/\*\*|`/g, "").length;
const isBalanced = (text: string) => (text.match(/\*\*/g) ?? []).length % 2 === 0 && (text.match(/`/g) ?? []).length % 2 === 0;

export function splitGuideLead(text: string): { lead: string; rest: string } {
  if (plainLength(text) < GUIDE_FOLD_MIN_LENGTH) return { lead: text, rest: "" };
  for (const match of text.matchAll(/[.!?](?=\s)/g)) {
    const end = (match.index ?? 0) + 1;
    const lead = text.slice(0, end);
    const rest = text.slice(end).trim();
    if (plainLength(lead) >= MIN_LEAD && plainLength(rest) >= MIN_REST && isBalanced(lead)) return { lead, rest };
  }
  return { lead: text, rest: "" };
}
