import type { GradeLevel, OutlineDepth, QuestionSets, SubjectType, StudentLevel, Answer } from "@/types";

export type { OutlineTemplate, OutlineTemplateItem, OutlineSection } from "@/lib/outline-templates";

export type OutlineTemplateAnswer = {
  section: "처음" | "가운데" | "끝";
  itemId: string;
  label: string;
  answer: string;
};

export type ActivityType =
  | "outline_builder"
  | "question_generator"
  | "question_voting"
  | "one_line_share"
  | "hanja_writing"
  | "word_game";

export type ActivityCategory =
  | "writing"
  | "questioning"
  | "discussion"
  | "reflection";

export type ActivityConfigValidation<TConfig> =
  | { ok: true; value: TConfig }
  | { ok: false; errors: string[] };

export type ActivityDefinition<
  TConfig extends Record<string, unknown>,
  TSubmission extends Record<string, unknown>,
  TResult extends Record<string, unknown>,
  TRoomResult extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: ActivityType;
  label: string;
  description: string;
  category: ActivityCategory;
  version: number;
  usesAi: boolean;
  supportsRoomResult: boolean;
  createDefaultConfig: () => TConfig;
  validateConfig: (input: unknown) => ActivityConfigValidation<TConfig>;
  emptySubmission: () => TSubmission;
  emptyResult: () => TResult;
  emptyRoomResult?: () => TRoomResult;
};

export type OutlineBuilderConfig = {
  subjectType: SubjectType;
  gradeLevel: GradeLevel;
  outlineDepth: OutlineDepth;
  /** null이면 글 종류 기본 템플릿 사용 */
  outlineTemplate: import("@/lib/outline-templates").OutlineTemplate | null;
  /** @deprecated 이전 방식 호환용 — 새 방에는 사용 안 함 */
  questionSets?: QuestionSets | null;
  /** @deprecated 이전 방식 호환용 */
  questionsGeneratedAt?: string | null;
};

export type OutlineBuilderSubmission = {
  answers: OutlineTemplateAnswer[];
  /** @deprecated 이전 방식 호환용 */
  level?: StudentLevel | null;
  /** @deprecated 이전 방식 호환용 */
  legacyAnswers?: Answer[];
};

export type OutlineBuilderResult = {
  outline: string | null;
};

export type QuestionCardSet = {
  id: string;
  label: string;
  description: string;
  prompts: string[];
  roleId?: string | null;
  isDefault?: boolean;
};

export type QuestionCardRole = {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  cardSetIds: string[];
  isDefault?: boolean;
};

/** 교사가 큐레이션한 질문 세트 — 여러 묶음에서 골라 만든 평면 질문 풀 */
export type QuestionSetItem = {
  text: string;
  source_label?: string;  // 어느 묶음에서 가져왔는지 (선택)
};

export type QuestionSet = {
  id: string;
  name: string;
  description: string;
  items: QuestionSetItem[];
};

export type QuestionGeneratorConfig = {
  enabledCardSetIds: string[];
  cardSets: QuestionCardSet[];
  roles?: QuestionCardRole[];
  maxSelections: number;
  guidance: string;
};

export type StudentQuestion = {
  id: string;
  text: string;
};

export type QuestionGeneratorSubmission = {
  selections: Array<{
    id: string;
    method: "direct" | "card_remix";
    cardSetId: string | "custom";
    cardSetLabel: string;
    originalPrompt: string | null;
    remixedQuestion: string;
    originalRemixedQuestion?: string;
  }>;
};

export type QuestionGeneratorResult = {
  submittedCount: number;
};

export type QuestionGeneratorRoomResult = {
  questions: Array<{
    id: string;
    sessionId: string;
    studentNumber: number;
    studentName: string;
    text: string;
  }>;
};

export type QuestionVotingConfig = {
  sourceRoomId: string | null;
  sourceRoomTitle: string | null;
  sourceQuestions: Array<{
    id: string;
    text: string;
  }>;
  evaluationCriteria: string[];
  maxSelections: number;
};

export type QuestionVotingSubmission = {
  selectedQuestionIds: string[];
};

export type QuestionVotingResult = {
  selectedQuestionIds: string[];
};

export type QuestionVotingRoomResult = {
  ranking: Array<{
    questionId: string;
    text: string;
    votes: number;
  }>;
};

export type OneLineShareConfig = {
  promptTitle: string;
  promptDescription: string;
  coreKeywords: string[];
  auxiliaryKeywords: string[];
  maxReactionsPerStudent: number;
};

export type OneLineShareSubmission = {
  entryId: string | null;
  content: string | null;
};

export type OneLineShareResult = {
  entryId: string | null;
  submitted: boolean;
  likeCount: number;
};

export type OneLineShareBoardEntry = {
  entryId: string;
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  likedByCurrentSession: boolean;
  isMine: boolean;
  containsKeywords: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OneLineShareRoomResult = {
  entries: OneLineShareBoardEntry[];
};

export type HanjaCharInfo = {
  char: string;
  reading: string;
  meaning: string;
};

export type HanjaRelatedWord = {
  word: string;
  hanja: string;
  meaning: string;
  sharedChar: string;
};

export type HanjaWordCard = {
  word: string;
  grade: number;
  hanja: HanjaCharInfo[];
  relatedWords: HanjaRelatedWord[];
  definition: string;
  example: string;
  category: string;
};

export type HanjaWritingConfig = {
  promptTitle: string;
  promptDescription: string;
  card: HanjaWordCard;
};

export type HanjaWritingSubmission = {
  content: string;
};

export type HanjaWritingResult = {
  submitted: boolean;
  likeCount?: number;
};

export type HanjaWritingBoardEntry = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  likedByCurrentSession: boolean;
  isMine: boolean;
  createdAt: string;
};

export type HanjaWritingRoomResult = {
  entries: HanjaWritingBoardEntry[];
};

export type WordGameConfig = {
  gameMode: "speed_match";
  mode: "individual" | "team";
  questionMode: "definition_to_word";
  timeLimit: number;
  grade: 3 | 4 | 5 | 6;
  levelFilter: 1 | 2 | 3 | "mixed";
  categoryFilter: string[];
  wordCount: number;
  allowHints: boolean;
  easyStart: boolean;
  recoveryBonus: boolean;
  growthBonus: boolean;
  showLiveTeamBoard: boolean;
  teamCount: 2 | 3 | 4;
  teamMode: "number_alternate" | "random_balanced" | "number_block";
  teams: WordGameTeam[];
  questions: WordGameQuestion[];
};

export type WordGameSubmission = {
  answers: WordGameAnswer[];
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number;
  usedHints: number;
  currentIndex: number;
  totalQuestions: number;
  teamId: string | null;
  score: number;
  correctCount: number;
  wrongCount: number;
};

export type WordGameResult = {
  score: number;
  correctCount: number;
  wrongCount: number;
  timeBonus: number;
  recoveryBonus: number;
  growthBonus: number;
  completionBonus: number;
  usedHints: number;
  elapsedMs: number;
  teamId: string | null;
};

export type WordGameRoomResult = {
  rankings: Array<{
    studentNumber: number;
    studentName: string;
    score: number;
    correctCount: number;
    wrongCount: number;
    usedHints: number;
    currentIndex: number;
    totalQuestions: number;
    teamId: string | null;
    status: "in_progress" | "done";
  }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    color: string;
    memberCount: number;
    activeCount: number;
    completedCount: number;
    averageScore: number;
    averageGrowthBonus: number;
    averageCorrectRate: number;
    tugOffset: number;
  }>;
  progress: {
    totalStudents: number;
    connectedStudents: number;
    activeStudents: number;
    completedStudents: number;
    averageCorrectRate: number;
  };
  hardWords: Array<{
    word: string;
    wrongCount: number;
    correctCount: number;
  }>;
};

export type WordGameQuestion = {
  id: string;
  word: string;
  category: string;
  level: 1 | 2 | 3;
  prompt: string;
  choices: string[];
  answer: string;
  definition: string;
  example: string;
};

export type WordGameAnswer = {
  questionId: string;
  selectedChoice: string;
  isCorrect: boolean;
  usedHint: boolean;
  answeredAt: string;
  responseMs: number;
};

export type WordGameTeam = {
  id: string;
  name: string;
  color: string;
};

export type WordGameTeamAssignment = {
  teamId: string;
  teamName: string;
  color: string;
};

export type WordGameStudentProgress = {
  studentNumber: number;
  studentName: string;
  status: "not_joined" | "in_progress" | "done";
  score: number;
  correctCount: number;
  wrongCount: number;
  usedHints: number;
  currentIndex: number;
  totalQuestions: number;
  teamId: string | null;
};
