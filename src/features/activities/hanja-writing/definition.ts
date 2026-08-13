import type {
  ActivityDefinition,
  HanjaWritingConfig,
  HanjaWritingResult,
  HanjaWritingRoomResult,
  HanjaWritingSubmission,
} from "../types";

export const hanjaWritingDefinition: ActivityDefinition<
  HanjaWritingConfig,
  HanjaWritingSubmission,
  HanjaWritingResult,
  HanjaWritingRoomResult
> = {
  id: "hanja_writing",
  label: "한자 활용 문장 만들기",
  description: "단어 속 한자의 뜻을 살피고, 그 단어를 활용해 한 문장을 써서 친구들과 나누는 활동입니다.",
  category: "writing",
  version: 1,
  usesAi: true,
  supportsRoomResult: true,
  integration: {
    schemaVersion: 1,
    resultKind: "hanja_sentences",
  },
  createDefaultConfig: () => ({
    promptTitle: "한자 카드를 보고 문장을 만들어 보세요",
    promptDescription: "단어 속 한자의 뜻과 관련 단어를 살펴본 뒤, 이 단어를 활용해 자연스러운 문장을 써보세요.",
    sentenceCount: 1,
    maxReactionsPerStudent: 3,
    card: {
      word: "",
      grade: 4,
      hanja: [],
      relatedWords: [],
      definition: "",
      example: "",
      category: "",
    },
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    const rawCard = isRecord(raw.card) ? raw.card : {};
    const word = typeof rawCard.word === "string" ? rawCard.word.trim() : "";

    if (!word) {
      return { ok: false, errors: ["한자 카드 단어가 비어 있습니다."] };
    }

    const rawMax = typeof raw.maxReactionsPerStudent === "number"
      ? raw.maxReactionsPerStudent
      : Number(raw.maxReactionsPerStudent);
    const maxReactionsPerStudent = Number.isFinite(rawMax)
      ? Math.min(Math.max(Math.trunc(rawMax), 1), 10)
      : 3;
    const rawSentenceCount = typeof raw.sentenceCount === "number"
      ? raw.sentenceCount
      : Number(raw.sentenceCount);
    const sentenceCount = Number.isFinite(rawSentenceCount)
      ? Math.min(Math.max(Math.trunc(rawSentenceCount), 1), 5)
      : 1;

    return {
      ok: true,
      value: {
        promptTitle: typeof raw.promptTitle === "string" && raw.promptTitle.trim()
          ? raw.promptTitle.trim()
          : "한자 카드를 보고 문장을 만들어 보세요",
        promptDescription: typeof raw.promptDescription === "string" && raw.promptDescription.trim()
          ? raw.promptDescription.trim()
          : "단어 속 한자의 뜻과 관련 단어를 살펴본 뒤, 이 단어를 활용해 자연스러운 문장을 써보세요.",
        sentenceCount,
        maxReactionsPerStudent,
        card: {
          word,
          grade: clampGrade(rawCard.grade),
          hanja: Array.isArray(rawCard.hanja)
            ? rawCard.hanja
                .filter(isRecord)
                .map((entry) => ({
                  char: typeof entry.char === "string" ? entry.char.trim() : "",
                  reading: typeof entry.reading === "string" ? entry.reading.trim() : "",
                  meaning: typeof entry.meaning === "string" ? entry.meaning.trim() : "",
                }))
                .filter((entry) => entry.char && entry.reading && entry.meaning)
            : [],
          relatedWords: Array.isArray(rawCard.relatedWords)
            ? rawCard.relatedWords
                .filter(isRecord)
                .map((entry) => ({
                  word: typeof entry.word === "string" ? entry.word.trim() : "",
                  hanja: typeof entry.hanja === "string" ? entry.hanja.trim() : "",
                  meaning: typeof entry.meaning === "string" ? entry.meaning.trim() : "",
                  sharedChar: typeof entry.sharedChar === "string" ? entry.sharedChar.trim() : "",
                }))
                .filter((entry) => entry.word && entry.meaning)
            : [],
          definition: typeof rawCard.definition === "string" ? rawCard.definition.trim() : "",
          example: typeof rawCard.example === "string" ? rawCard.example.trim() : "",
          category: typeof rawCard.category === "string" ? rawCard.category.trim() : "",
        },
      },
    };
  },
  emptySubmission: () => ({
    contents: [],
  }),
  emptyResult: () => ({
    submitted: false,
  }),
  emptyRoomResult: () => ({
    entries: [],
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampGrade(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 4;
  return Math.min(Math.max(Math.trunc(num), 3), 6);
}
