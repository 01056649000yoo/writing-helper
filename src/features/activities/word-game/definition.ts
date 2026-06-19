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
    mode: "team",
    questionMode: "definition_to_word",
    timeLimit: 90,
    grade: 4,
    levelFilter: "mixed",
    categoryFilter: [],
    wordCount: 10,
    allowHints: true,
    easyStart: true,
    recoveryBonus: true,
    growthBonus: true,
    showLiveTeamBoard: true,
    teamCount: 2,
    teamMode: "number_alternate",
    teams: [
      { id: "team-1", name: "A팀", color: "#f97316" },
      { id: "team-2", name: "B팀", color: "#0ea5e9" },
    ],
    questions: [],
  }),
  validateConfig: (input) => {
    const raw = isRecord(input) ? input : {};
    return {
      ok: true,
      value: {
        gameMode: "speed_match",
        mode: raw.mode === "individual" ? "individual" : "team",
        questionMode: "definition_to_word",
        timeLimit: typeof raw.timeLimit === "number" ? raw.timeLimit : 180,
        grade: raw.grade === 3 || raw.grade === 4 || raw.grade === 5 || raw.grade === 6 ? raw.grade : 4,
        levelFilter: raw.levelFilter === 1 || raw.levelFilter === 2 || raw.levelFilter === 3 ? raw.levelFilter : "mixed",
        categoryFilter: Array.isArray(raw.categoryFilter) ? raw.categoryFilter.filter((item): item is string => typeof item === "string") : [],
        wordCount: typeof raw.wordCount === "number" ? raw.wordCount : 10,
        allowHints: raw.allowHints !== false,
        easyStart: raw.easyStart !== false,
        recoveryBonus: raw.recoveryBonus !== false,
        growthBonus: raw.growthBonus !== false,
        showLiveTeamBoard: raw.showLiveTeamBoard !== false,
        teamCount: raw.teamCount === 3 || raw.teamCount === 4 ? raw.teamCount : 2,
        teamMode: raw.teamMode === "random_balanced" || raw.teamMode === "number_block" ? raw.teamMode : "number_alternate",
        teams: Array.isArray(raw.teams) ? raw.teams.filter(isWordGameTeam) : [],
        questions: Array.isArray(raw.questions) ? raw.questions.filter(isWordGameQuestion) : [],
      },
    };
  },
  emptySubmission: () => ({
    answers: [],
    startedAt: null,
    completedAt: null,
    elapsedMs: 0,
    usedHints: 0,
    currentIndex: 0,
    totalQuestions: 0,
    teamId: null,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
  }),
  emptyResult: () => ({
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    timeBonus: 0,
    recoveryBonus: 0,
    growthBonus: 0,
    completionBonus: 0,
    usedHints: 0,
    elapsedMs: 0,
    teamId: null,
  }),
  emptyRoomResult: () => ({
    rankings: [],
    teams: [],
    progress: {
      totalStudents: 0,
      connectedStudents: 0,
      activeStudents: 0,
      completedStudents: 0,
      averageCorrectRate: 0,
    },
    hardWords: [],
  }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWordGameTeam(value: unknown): value is WordGameConfig["teams"][number] {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.color === "string";
}

function isWordGameQuestion(value: unknown): value is WordGameConfig["questions"][number] {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.word === "string"
    && typeof value.prompt === "string"
    && typeof value.answer === "string"
    && typeof value.definition === "string"
    && typeof value.example === "string"
    && typeof value.category === "string"
    && (value.level === 1 || value.level === 2 || value.level === 3)
    && Array.isArray(value.choices)
    && value.choices.every((choice) => typeof choice === "string");
}
