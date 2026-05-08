import type { GradeLevel, OutlineDepth, QuestionSets, SubjectType, StudentLevel, Answer } from "@/types";

export type ActivityType =
  | "outline_builder"
  | "question_generator"
  | "question_voting";

export type ActivityCategory =
  | "writing"
  | "questioning"
  | "discussion";

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
  questionSets: QuestionSets | null;
  questionsGeneratedAt: string | null;
};

export type OutlineBuilderSubmission = {
  level: StudentLevel | null;
  answers: Answer[];
};

export type OutlineBuilderResult = {
  outline: string | null;
};

export type QuestionCardSet = {
  id: string;
  label: string;
  description: string;
  prompts: string[];
};

export type QuestionGeneratorConfig = {
  enabledCardSetIds: string[];
  cardSets: QuestionCardSet[];
  maxSelections: number;
  guidance: string;
  requireReason: boolean;
  allowCustomQuestion: boolean;
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
    reason?: string;
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
  maxSelections: number;
  requireReason: boolean;
  candidates: Array<{
    id: string;
    text: string;
  }>;
};

export type QuestionVotingSubmission = {
  selectedQuestionIds: string[];
  reason: string;
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
