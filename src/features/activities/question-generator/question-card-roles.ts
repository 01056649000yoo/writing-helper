export type QuestionCardRolePreset = {
  key: string;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  cardSetLabels: string[];
};

export const QUESTION_CARD_ROLE_PRESETS: QuestionCardRolePreset[] = [
  {
    key: "detective",
    label: "탐정 모드",
    subtitle: "단서/원인/흐름",
    description: "보이는 단서를 찾고, 왜 그런지와 사건의 앞뒤 흐름을 차근차근 밝혀내는 역할이에요.",
    icon: "🕵️",
    cardSetLabels: [
      "관찰",
      "이유",
      "시간",
    ],
  },
  {
    key: "wizard",
    label: "마법사 모드",
    subtitle: "상상/반전/비유",
    description: "익숙한 이야기를 새롭게 바꾸고, 엉뚱하고 반짝이는 발상으로 질문을 넓히는 역할이에요.",
    icon: "🪄",
    cardSetLabels: [
      "상상",
      "반전",
      "비유",
    ],
  },
  {
    key: "judge",
    label: "판사 모드",
    subtitle: "가치/판단/해결",
    description: "여러 입장을 따져 보고, 무엇이 더 중요한지 판단하며 더 나은 해결 방향을 찾는 역할이에요.",
    icon: "⚖️",
    cardSetLabels: [
      "가치",
      "관점",
      "해결",
    ],
  },
  {
    key: "counselor",
    label: "상담사 모드",
    subtitle: "마음/공감/연결",
    description: "인물의 마음을 헤아리고, 내 경험과 감각을 이어 더 따뜻하고 가까운 질문을 만드는 역할이에요.",
    icon: "💬",
    cardSetLabels: [
      "마음",
      "감각",
      "연결",
    ],
  },
];

export function normalizeQuestionCardLabel(value: string) {
  return value.replace(/\s+/g, "").replace(/카드$/u, "").trim().toLowerCase();
}
