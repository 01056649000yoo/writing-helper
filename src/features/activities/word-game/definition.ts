import type {
  ActivityDefinition,
  WordGameConfig,
  WordGameSubmission,
  WordGameResult,
  WordGameRoomResult,
} from "../types";

export const wordGameDefinition: ActivityDefinition<
  WordGameConfig,
  WordGameSubmission,
  WordGameResult,
  WordGameRoomResult
> = {
  id: "word_game",
  label: "필수 단어 맞추기 게임",
  description: "3~6학년 학년별 필수 단어를 활용하여 정해진 시간 동안 낱말을 맞추는 실시간 경쟁 게임입니다.",
  category: "reflection",
  version: 1,
  usesAi: false,
  supportsRoomResult: true,
  createDefaultConfig: () => ({
    gameMode: "speed_match",
    timeLimit: 180,
    grade: 4,
    wordCount: 10,
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    return {
      ok: true,
      value: {
        gameMode: typeof raw.gameMode === "string" ? raw.gameMode : "speed_match",
        timeLimit: typeof raw.timeLimit === "number" ? raw.timeLimit : 180,
        grade: typeof raw.grade === "number" ? raw.grade : 4,
        wordCount: typeof raw.wordCount === "number" ? raw.wordCount : 10,
      },
    };
  },
  emptySubmission: () => ({
    score: 0,
    correctCount: 0,
    wrongCount: 0,
  }),
  emptyResult: () => ({
    score: 0,
    correctCount: 0,
    wrongCount: 0,
  }),
  emptyRoomResult: () => ({
    rankings: [],
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
