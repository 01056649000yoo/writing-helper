import type {
  QuestionCardSet,
  QuestionGeneratorConfig,
  QuestionGeneratorMode,
} from "../types";

/**
 * 질문 만들기 활동의 **작성 방식(모드)** 계약.
 *
 * 교사 화면·서버 액션·학생 화면이 각자 조건을 판단하면 어긋난다(2026-08-19에 실제로 어긋났다 —
 * 교사 화면은 방식을 3가지로 나눴는데 서버는 모드와 무관하게 "카드 묶음 1개 이상"을 요구했고,
 * 학생 화면은 늘 역할→카드→다듬기 3단계를 강요했다. 역할은 2026-08-19에 걷어냈다 — `areas.ts` 참고).
 * 그래서 **시작 조건과 단계 구성의 원본은 이 파일 하나**다.
 */

export const QUESTION_GENERATOR_MODES = ["direct", "card_remix", "ai_custom"] as const;

/** 방식별 화면 문구 — 교사 화면과 학생 화면이 같은 말을 쓰게 한다. */
export const QUESTION_GENERATOR_MODE_META: Record<
  QuestionGeneratorMode,
  { label: string; icon: string; teacherHint: string; studentHint: string }
> = {
  direct: {
    label: "직접 만들기",
    icon: "✍️",
    teacherHint: "카드 힌트 없이 학생이 스스로 질문을 씁니다.",
    studentHint: "오늘 주제를 보고 스스로 질문을 만들어 보세요.",
  },
  card_remix: {
    label: "질문 카드 활용",
    icon: "🃏",
    teacherHint: "질문 카드 묶음을 골라 주면 학생이 큰 카테고리 → 질문을 고른 뒤 주제에 맞게 바꿔 씁니다.",
    studentHint: "질문 카테고리를 고르고, 그 안의 질문을 오늘 주제에 맞게 바꿔 써 보세요.",
  },
  ai_custom: {
    label: "선생님 추천 질문",
    icon: "✨",
    teacherHint: "선생님이 고른 질문 예시만 학생에게 보여 줍니다.",
    studentHint: "선생님이 준비한 질문 예시를 고른 뒤, 내 질문으로 바꿔 써 보세요.",
  },
};

/** 방식별 학생 화면 단계 — 화면은 이 목록만 보고 마법사를 그린다. */
const MODE_STEPS: Record<QuestionGeneratorMode, ReadonlyArray<{ key: string; label: string }>> = {
  direct: [{ key: "rewrite", label: "질문 쓰기" }],
  ai_custom: [
    { key: "set", label: "질문 고르기" },
    { key: "rewrite", label: "질문 완성" },
  ],
  card_remix: [
    { key: "path", label: "카테고리 고르기" },
    { key: "set", label: "질문 고르기" },
    { key: "rewrite", label: "질문 바꿔 쓰기" },
  ],
};

export function questionGeneratorSteps(mode: QuestionGeneratorMode) {
  return MODE_STEPS[mode];
}

/** 옛 방에는 `mode`가 없다 — 그때는 전부 카드 방식이었으므로 카드 방식으로 읽는다. */
export function parseQuestionGeneratorMode(value: unknown): QuestionGeneratorMode {
  return typeof value === "string" && (QUESTION_GENERATOR_MODES as readonly string[]).includes(value)
    ? (value as QuestionGeneratorMode)
    : "card_remix";
}

export const AI_CUSTOM_CARD_SET_ID = "ai-custom-card-set";
export const AI_CUSTOM_CARD_SET_LABEL = "선생님 추천 질문";
export const MAX_AI_CUSTOM_QUESTIONS = 20;
export const MAX_AI_CUSTOM_QUESTION_LENGTH = 200;

export const DEFAULT_QUESTION_GENERATOR_GUIDANCE: Record<QuestionGeneratorMode, string> = {
  direct: "오늘 주제를 잘 보고, 내가 정말 궁금한 것을 질문으로 만들어 봅시다.",
  card_remix: "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.",
  ai_custom: "선생님이 준비한 질문 예시를 고른 뒤, 내 생각이 드러나게 바꿔 봅시다.",
};

/**
 * 저장된 `activity_config`를 화면이 바로 쓸 수 있는 형태로 읽는다.
 * 교사 화면·학생 화면·서버가 각자 만들던 정규화를 여기로 모았다.
 */
export function normalizeQuestionGeneratorConfig(value: unknown): QuestionGeneratorConfig {
  const raw = isRecord(value) ? value : {};
  const mode = parseQuestionGeneratorMode(raw.mode);
  const cardSets = normalizeCardSets(raw.cardSets);
  const allIds = new Set(cardSets.map((cardSet) => cardSet.id));

  const requestedIds = Array.isArray(raw.enabledCardSetIds)
    ? raw.enabledCardSetIds.filter((id): id is string => typeof id === "string" && allIds.has(id))
    : [];

  // 직접 만들기에는 카드가 없다 — 빈 목록을 "전체 허용"으로 되돌리면 카드 화면이 되살아난다.
  const enabledCardSetIds = mode === "direct"
    ? []
    : requestedIds.length > 0
      ? requestedIds
      : cardSets.map((cardSet) => cardSet.id);

  const enabledIdSet = new Set(enabledCardSetIds);

  return {
    mode,
    enabledCardSetIds,
    cardSets: mode === "direct" ? [] : cardSets.filter((cardSet) => enabledIdSet.has(cardSet.id)),
    maxSelections: clampNumber(raw.maxSelections, 1, 4, 1),
    guidance: typeof raw.guidance === "string" && raw.guidance.trim()
      ? raw.guidance.trim()
      : DEFAULT_QUESTION_GENERATOR_GUIDANCE[mode],
  };
}

export type QuestionGeneratorSetupInput = {
  mode: QuestionGeneratorMode;
  /** 카드 방식에서 교사가 고른 묶음 id */
  selectedCardSetIds: string[];
  /** 선생님 추천 질문 방식에서 실제로 학생에게 보낼 질문 */
  customQuestions: string[];
  maxSelections: number;
  guidance: string;
};

export type QuestionGeneratorBuildResult =
  | { ok: true; value: QuestionGeneratorConfig }
  | { ok: false; error: string };

/**
 * 활동 시작 조건 — 방식마다 다르다.
 * - 직접 만들기: 준비물이 없다. 주제만 있으면 시작한다.
 * - 질문 카드 활용: 교사가 가진 묶음 중 1개 이상.
 * - 선생님 추천 질문: 학생에게 보여 줄 질문 1개 이상.
 */
export function buildQuestionGeneratorConfig(input: {
  setup: QuestionGeneratorSetupInput;
  teacherCardSets: QuestionCardSet[];
}): QuestionGeneratorBuildResult {
  const { setup, teacherCardSets } = input;
  const maxSelections = clampNumber(setup.maxSelections, 1, 4, 1);
  const guidance = setup.guidance.trim() || DEFAULT_QUESTION_GENERATOR_GUIDANCE[setup.mode];

  if (setup.mode === "direct") {
    return {
      ok: true,
      value: {
        mode: "direct",
        enabledCardSetIds: [],
        cardSets: [],
        maxSelections,
        guidance,
      },
    };
  }

  if (setup.mode === "ai_custom") {
    const questions = setup.customQuestions
      .map((question) => question.trim().slice(0, MAX_AI_CUSTOM_QUESTION_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_AI_CUSTOM_QUESTIONS);

    if (questions.length === 0) {
      return { ok: false, error: "학생에게 보여 줄 질문 예시를 1개 이상 만들거나 선택해주세요." };
    }

    const cardSet: QuestionCardSet = {
      id: AI_CUSTOM_CARD_SET_ID,
      label: AI_CUSTOM_CARD_SET_LABEL,
      description: "선생님이 오늘 주제에 맞게 골라 둔 질문 예시입니다.",
      prompts: questions,
    };

    return {
      ok: true,
      value: {
        mode: "ai_custom",
        enabledCardSetIds: [cardSet.id],
        cardSets: [cardSet],
        maxSelections,
        guidance,
      },
    };
  }

  const allowedIds = new Set(teacherCardSets.map((cardSet) => cardSet.id));
  const enabledCardSetIds = setup.selectedCardSetIds.filter((cardSetId) => allowedIds.has(cardSetId));

  if (enabledCardSetIds.length === 0) {
    return { ok: false, error: "제공할 질문 카드 묶음을 1개 이상 선택해주세요." };
  }

  const enabledIdSet = new Set(enabledCardSetIds);

  return {
    ok: true,
    value: {
      mode: "card_remix",
      enabledCardSetIds,
      cardSets: teacherCardSets.filter((cardSet) => enabledIdSet.has(cardSet.id)),
      maxSelections,
      guidance,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function normalizeCardSets(value: unknown): QuestionCardSet[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item, index): QuestionCardSet => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `card-set-${index + 1}`,
      label: typeof item.label === "string" ? item.label.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : "",
      prompts: Array.isArray(item.prompts)
        ? item.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0)
        : [],
      roleId: typeof item.roleId === "string" && item.roleId.trim() ? item.roleId.trim() : null,
    }))
    .filter((cardSet) => cardSet.label && cardSet.prompts.length > 0);
}
