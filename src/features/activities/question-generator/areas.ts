import type { QuestionCardSet } from "../types";

/**
 * 질문의 **큰 카테고리** — 12개 질문 카드 묶음을 6가지로 묶는다.
 *
 * 2026-08-18까지는 `탐정 모드`·`상담사 모드` 같은 **역할**이 학생의 첫 단계였다.
 * 역할은 2026-08-19에 걷어냈고(교사 화면에서 먼저 지웠다), 지금은 학생이
 * **큰 카테고리를 고른 뒤 그 안의 질문을 선생님 주제에 맞춰 바꿔 쓴다.**
 *
 * 카드 묶음 이름은 교사가 고칠 수 있으므로 id 가 아니라 **이름의 낱말**로 카테고리를 정한다.
 * 교사 설정 화면·활동 만들기·학생 화면이 모두 이 파일 하나를 본다.
 */

export type QuestionAreaId =
  | "상상·반전"
  | "마음·가치"
  | "감각·관찰"
  | "이유·해결"
  | "연결·비유"
  | "관점·시간"
  | "기타";

export type QuestionArea = {
  id: QuestionAreaId;
  label: string;
  emoji: string;
  /** 학생에게 보여 주는 한 줄 안내 */
  hint: string;
  chip: { bg: string; text: string; border: string };
  /** 고른 카테고리 카드의 배경 */
  surface: string;
  /** 고른 것을 알리는 진한 배지 */
  badge: string;
};

export const QUESTION_AREAS: QuestionArea[] = [
  {
    id: "상상·반전",
    label: "상상·반전",
    emoji: "💡",
    hint: "만약에 다르게 되었다면 어땠을지 상상해 보는 질문",
    chip: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    surface: "from-indigo-50 to-indigo-100 ring-indigo-200",
    badge: "bg-indigo-500 text-white",
  },
  {
    id: "마음·가치",
    label: "마음·가치",
    emoji: "❤️",
    hint: "마음이 어땠는지, 무엇이 소중한지 묻는 질문",
    chip: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    surface: "from-rose-50 to-rose-100 ring-rose-200",
    badge: "bg-rose-500 text-white",
  },
  {
    id: "감각·관찰",
    label: "감각·관찰",
    emoji: "👁️",
    hint: "보고 듣고 느낀 것을 자세히 들여다보는 질문",
    chip: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    surface: "from-emerald-50 to-emerald-100 ring-emerald-200",
    badge: "bg-emerald-500 text-white",
  },
  {
    id: "이유·해결",
    label: "이유·해결",
    emoji: "❓",
    hint: "왜 그런지 따져 보고 어떻게 풀지 찾는 질문",
    chip: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    surface: "from-amber-50 to-amber-100 ring-amber-200",
    badge: "bg-amber-500 text-white",
  },
  {
    id: "연결·비유",
    label: "연결·비유",
    emoji: "🌱",
    hint: "내 삶이나 다른 것에 빗대어 이어 보는 질문",
    chip: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
    surface: "from-teal-50 to-teal-100 ring-teal-200",
    badge: "bg-teal-500 text-white",
  },
  {
    id: "관점·시간",
    label: "관점·시간",
    emoji: "⏳",
    hint: "다른 사람의 눈으로, 다른 때로 옮겨 보는 질문",
    chip: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
    surface: "from-violet-50 to-violet-100 ring-violet-200",
    badge: "bg-violet-500 text-white",
  },
];

export const OTHER_QUESTION_AREA: QuestionArea = {
  id: "기타",
  label: "그 밖의 질문",
  emoji: "🃏",
  hint: "선생님이 따로 만든 질문 묶음",
  chip: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  surface: "from-gray-50 to-gray-100 ring-gray-200",
  badge: "bg-gray-600 text-white",
};

const AREA_KEYWORDS: Array<{ id: QuestionAreaId; keywords: string[] }> = [
  { id: "상상·반전", keywords: ["상상", "반전", "가정"] },
  { id: "마음·가치", keywords: ["마음", "가치", "감정", "의미"] },
  { id: "감각·관찰", keywords: ["감각", "관찰", "오감", "단서"] },
  { id: "이유·해결", keywords: ["이유", "해결", "원인", "위기"] },
  { id: "연결·비유", keywords: ["연결", "비유", "삶", "경험"] },
  { id: "관점·시간", keywords: ["관점", "시간", "입장", "미래"] },
];

/** 카드 묶음 이름이 어느 카테고리인지 정한다. 어디에도 안 걸리면 `기타`. */
export function getQuestionAreaId(cardSetLabel: string): QuestionAreaId {
  const label = String(cardSetLabel ?? "");
  const found = AREA_KEYWORDS.find((area) => area.keywords.some((keyword) => label.includes(keyword)));
  return found?.id ?? "기타";
}

export function getQuestionArea(id: QuestionAreaId): QuestionArea {
  return QUESTION_AREAS.find((area) => area.id === id) ?? OTHER_QUESTION_AREA;
}

export function getQuestionAreaByCardLabel(cardSetLabel: string): QuestionArea {
  return getQuestionArea(getQuestionAreaId(cardSetLabel));
}

/** 카드 묶음 이름에서 짧은 배지 낱말을 만든다(예: `상상 카드` → `상상`). */
export function getCardKeywordBadge(cardSetLabel: string): string {
  const label = String(cardSetLabel ?? "");
  const keyword = AREA_KEYWORDS.flatMap((area) => area.keywords).find((word) => label.includes(word));
  return keyword ?? label.slice(0, 4);
}

/**
 * 교사가 고른 카드 묶음을 큰 카테고리로 묶는다.
 * 카테고리 순서는 `QUESTION_AREAS` 순서를 따르고, `기타`는 늘 맨 뒤에 온다.
 */
export function groupCardSetsByArea(cardSets: QuestionCardSet[]) {
  const grouped = new Map<QuestionAreaId, QuestionCardSet[]>();

  for (const cardSet of cardSets) {
    const areaId = getQuestionAreaId(cardSet.label);
    const bucket = grouped.get(areaId);
    if (bucket) bucket.push(cardSet);
    else grouped.set(areaId, [cardSet]);
  }

  const ordered: Array<{ area: QuestionArea; cardSets: QuestionCardSet[]; promptCount: number }> = [];
  for (const area of [...QUESTION_AREAS, OTHER_QUESTION_AREA]) {
    const bucket = grouped.get(area.id);
    if (!bucket || bucket.length === 0) continue;
    ordered.push({
      area,
      cardSets: bucket,
      promptCount: bucket.reduce((sum, cardSet) => sum + cardSet.prompts.length, 0),
    });
  }

  return ordered;
}
