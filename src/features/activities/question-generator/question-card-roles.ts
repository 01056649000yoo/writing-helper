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
    subtitle: "사실/추론",
    description: "보이는 사실을 살피고, 이유와 흐름을 차근차근 캐내요.",
    icon: "🕵️",
    cardSetLabels: ["관찰", "이유", "시간"],
  },
  {
    key: "wizard",
    label: "마법사 모드",
    subtitle: "상상/비틀기",
    description: "생각을 넓히고 낯선 방향으로 비틀어 새로운 질문을 만들어요.",
    icon: "🪄",
    cardSetLabels: ["상상", "반전", "비유"],
  },
  {
    key: "judge",
    label: "판사 모드",
    subtitle: "가치/해결",
    description: "무엇이 더 중요할지 따져 보고, 해결 방향을 찾도록 도와줘요.",
    icon: "⚖️",
    cardSetLabels: ["가치", "해결", "연결"],
  },
  {
    key: "counselor",
    label: "상담사 모드",
    subtitle: "공감/시점",
    description: "마음과 관점을 살피며 더 깊고 따뜻한 질문으로 바꿔요.",
    icon: "💬",
    cardSetLabels: ["마음", "관점", "감각"],
  },
];

export function normalizeQuestionCardLabel(value: string) {
  return value.replace(/\s+/g, "").replace(/카드$/u, "").trim().toLowerCase();
}
