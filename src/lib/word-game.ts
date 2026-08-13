import {
  ALL_VOCAB,
  type VocabularyEntry,
  type VocabularyGrade,
  type VocabularyLevel,
} from "@/lib/vocabulary";
import type {
  WordGameActivityState,
  WordGameAnswer,
  WordGameConfig,
  WordGameQuestion,
  WordGameResult,
  WordGameRoomResult,
  WordGameStudentProgress,
  WordGameTeam,
  WordGameTeamAssignment,
} from "@/features/activities/types";

const TEAM_COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7"] as const;

export function createDefaultWordGameTeams(count: 2 | 3 | 4): WordGameTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `${String.fromCharCode(65 + index)}팀`,
    color: TEAM_COLORS[index] ?? TEAM_COLORS[0],
  }));
}

export function buildWordGameQuestions(config: Pick<WordGameConfig, "grade" | "levelFilter" | "categoryFilter" | "wordCount" | "easyStart">) {
  const categorySet = new Set(config.categoryFilter);
  const entries = ALL_VOCAB.filter((entry) => {
    if (entry.grade !== config.grade) return false;
    if (config.levelFilter !== "mixed" && entry.level !== config.levelFilter) return false;
    if (categorySet.size > 0 && !categorySet.has(entry.category)) return false;
    return true;
  });

  const ordered = config.easyStart
    ? [...entries].sort((a, b) => a.level - b.level || a.word.localeCompare(b.word, "ko-KR"))
    : [...entries].sort((a, b) => a.word.localeCompare(b.word, "ko-KR"));

  const selected = ordered.slice(0, config.wordCount);
  return selected.map((entry, index) => buildQuestion(entry, index, entries));
}

function buildQuestion(entry: VocabularyEntry, index: number, pool: VocabularyEntry[]): WordGameQuestion {
  const distractors = pool
    .filter((candidate) => candidate.word !== entry.word && candidate.level === entry.level)
    .sort((a, b) => a.word.localeCompare(b.word, "ko-KR"))
    .slice(0, 3);

  if (distractors.length < 3) {
    const fallback = pool
      .filter((candidate) => candidate.word !== entry.word && !distractors.some((item) => item.word === candidate.word))
      .sort((a, b) => a.word.localeCompare(b.word, "ko-KR"))
      .slice(0, 3 - distractors.length);
    distractors.push(...fallback);
  }

  const choices = shuffleDeterministically(
    [entry.word, ...distractors.map((candidate) => candidate.word)],
    `word-game-${entry.id}`
  );

  return {
    id: `wgq-${index + 1}-${entry.id}`,
    word: entry.word,
    category: entry.category,
    level: entry.level as VocabularyLevel,
    prompt: entry.definition,
    choices,
    answer: entry.word,
    definition: entry.definition,
    example: entry.example,
  };
}

export function assignWordGameTeam(
  studentNumber: number,
  teams: WordGameTeam[],
  mode: WordGameConfig["teamMode"]
): WordGameTeamAssignment | null {
  if (teams.length === 0) return null;

  let index = 0;
  if (mode === "number_block") {
    const blockSize = Math.ceil(30 / teams.length);
    index = Math.floor((Math.max(studentNumber, 1) - 1) / blockSize) % teams.length;
  } else if (mode === "random_balanced") {
    index = (studentNumber * 7 + 3) % teams.length;
  } else {
    index = (Math.max(studentNumber, 1) - 1) % teams.length;
  }

  const team = teams[index] ?? teams[0];
  return {
    teamId: team.id,
    teamName: team.name,
    color: team.color,
  };
}

export function calculateWordGameResult(
  answers: WordGameAnswer[],
  elapsedMs: number,
  allowHints: boolean
): WordGameResult {
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const wrongCount = answers.length - correctCount;
  const usedHints = answers.filter((answer) => answer.usedHint).length;
  const baseScore = answers.reduce((sum, answer) => {
    if (!answer.isCorrect) return sum;
    return sum + (answer.usedHint && allowHints ? 70 : 100);
  }, 0);
  const timeBonus = Math.max(0, Math.round((answers.length * 120000 - elapsedMs) / 1000));
  const recoveryBonus = answers.reduce((sum, answer, index) => {
    if (index === 0) return sum;
    return !answers[index - 1]?.isCorrect && answer.isCorrect ? sum + 20 : sum;
  }, 0);
  const firstHalf = answers.slice(0, Math.ceil(answers.length / 2));
  const secondHalf = answers.slice(Math.ceil(answers.length / 2));
  const firstHalfCorrect = firstHalf.filter((answer) => answer.isCorrect).length;
  const secondHalfCorrect = secondHalf.filter((answer) => answer.isCorrect).length;
  const growthBonus = Math.max(0, secondHalfCorrect - firstHalfCorrect) * 15;
  const completionBonus = answers.length > 0 ? 50 : 0;

  return {
    score: baseScore + timeBonus + recoveryBonus + growthBonus + completionBonus,
    correctCount,
    wrongCount,
    timeBonus,
    recoveryBonus,
    growthBonus,
    completionBonus,
    usedHints,
    elapsedMs,
    teamId: null,
  };
}

export function buildWordGameRoomSummary(
  students: Array<{ student_number: number; student_name: string }>,
  sessions: WordGameStudentProgress[],
  results: Array<WordGameResult & { studentNumber: number; studentName: string; status: "in_progress" | "done" }>,
  teams: WordGameTeam[],
  teamMode: WordGameConfig["teamMode"] = "number_alternate"
): WordGameRoomResult {
  const progressByStudent = new Map(
    sessions.map((session) => [
      session.studentNumber,
      { currentIndex: session.currentIndex, totalQuestions: session.totalQuestions },
    ] as const)
  );

  const rankings = results
    .map((result) => {
      const progress = progressByStudent.get(result.studentNumber);
      return {
        studentNumber: result.studentNumber,
        studentName: result.studentName,
        score: result.score,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        usedHints: result.usedHints,
        currentIndex: progress?.currentIndex ?? 0,
        totalQuestions: progress?.totalQuestions ?? 0,
        teamId: result.teamId,
        status: result.status,
      };
    })
    .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.studentNumber - b.studentNumber);

  const teamsSummary = teams.map((team) => {
    const teamResults = results.filter((result) => result.teamId === team.id);
    const teamSessions = sessions.filter((session) => session.teamId === team.id);
    const memberCount = students.filter((student) => assignWordGameTeam(student.student_number, teams, teamMode)?.teamId === team.id).length;
    const completedCount = teamResults.filter((result) => result.status === "done").length;
    const activeCount = teamSessions.filter((session) => session.status === "in_progress").length;
    const averageScore = teamResults.length > 0 ? Math.round(teamResults.reduce((sum, result) => sum + result.score, 0) / teamResults.length) : 0;
    const averageGrowthBonus = teamResults.length > 0 ? Math.round(teamResults.reduce((sum, result) => sum + result.growthBonus, 0) / teamResults.length) : 0;
    const averageCorrectRate = teamResults.length > 0
      ? Math.round((teamResults.reduce((sum, result) => sum + result.correctCount / Math.max(result.correctCount + result.wrongCount, 1), 0) / teamResults.length) * 100)
      : 0;

    return {
      teamId: team.id,
      teamName: team.name,
      color: team.color,
      memberCount,
      activeCount,
      completedCount,
      averageScore,
      averageGrowthBonus,
      averageCorrectRate,
      tugOffset: 0,
    };
  });

  const maxScore = Math.max(...teamsSummary.map((team) => team.averageScore), 0);
  const tugTeams = teamsSummary.map((team) => ({
    ...team,
    tugOffset: maxScore === 0 ? 0 : Math.round((team.averageScore / maxScore) * 100),
  }));

  return {
    rankings,
    teams: tugTeams,
    progress: {
      totalStudents: students.length,
      connectedStudents: sessions.length,
      activeStudents: sessions.filter((session) => session.status === "in_progress").length,
      completedStudents: sessions.filter((session) => session.status === "done").length,
      averageCorrectRate: results.length > 0
        ? Math.round((results.reduce((sum, result) => sum + result.correctCount / Math.max(result.correctCount + result.wrongCount, 1), 0) / results.length) * 100)
        : 0,
    },
    hardWords: [],
  };
}

export function normalizeWordGameActivityState(value: unknown): WordGameActivityState {
  const raw = isRecord(value) ? value : {};
  const wordGame = isRecord(raw.wordGame) ? raw.wordGame : {};
  return {
    status: wordGame.status === "in_progress" ? "in_progress" : "waiting",
    startedAt: typeof wordGame.startedAt === "string" ? wordGame.startedAt : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shuffleDeterministically<T>(items: T[], seed: string) {
  const next = [...items];
  let state = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (state * 48271) % 2147483647;
    const swapIndex = state % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}
