import type { GradeLevel, OutlineDepth, QuestionSets, SubjectType, StudentLevel, Answer } from "@/types";

export type { OutlineTemplate, OutlineTemplateItem, OutlineSection } from "@/lib/outline-templates";

export type OutlineTemplateAnswer = {
  section: "처음" | "가운데" | "끝";
  itemId: string;
  label: string;
  answer: string;
};

export const ACTIVITY_TYPES = [
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
  "hanja_writing",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(value: string | null | undefined): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}

export type ActivityCategory =
  | "writing"
  | "questioning"
  | "discussion"
  | "reflection";

/** 아지트 글쓰기에서 다시 사용할 수 있는 학생 결과의 표준 종류 */
export type PortableResultKind =
  | "outline"
  | "questions"
  | "selected_questions"
  | "one_line"
  | "hanja_sentences";

export type PortableResultChunk = {
  id: string;
  kind: "outline_item" | "question" | "selected_question" | "sentence";
  text: string;
  label?: string;
  section?: "처음" | "가운데" | "끝";
};

export type PortableResultContent = {
  chunks: PortableResultChunk[];
  metadata?: Record<string, unknown>;
};

export type PortableResultBuildContext = {
  config: unknown;
  submission: unknown;
  result: unknown;
  answers: unknown;
};

/**
 * 연구소 활동 결과를 아지트로 연결할 때 지켜야 하는 계약.
 * 새 활동은 매니페스트에서 결과 종류와 스키마 버전을 반드시 선언한다.
 */
export type ActivityIntegrationContract = {
  schemaVersion: 1;
  resultKind: PortableResultKind;
  toPortableResult: (context: PortableResultBuildContext) => PortableResultContent;
};

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
  integration: ActivityIntegrationContract;
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
  /**
   * 학생이 개요 틀을 고칠 수 있는가.
   * `true`(기본)면 항목을 빼고 더하고 친구들이 고른 질문을 불러올 수 있다.
   * `false`면 교사가 준 틀 그대로 채우기만 한다. 옛 방에는 이 값이 없어 기본값(허용)으로 읽는다.
   */
  studentEditable?: boolean;
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

/** 교사가 고른 질문 작성 방식 — 학생 화면의 단계 구성과 시작 조건이 여기서 갈린다. */
export type QuestionGeneratorMode = "direct" | "card_remix" | "ai_custom";

export type QuestionGeneratorConfig = {
  mode: QuestionGeneratorMode;
  enabledCardSetIds: string[];
  cardSets: QuestionCardSet[];
  /**
   * 학생이 **적어도** 만들어야 하는 질문 수.
   * 예전에는 maxSelections(상한)만 있어서, 선생님이 3개로 정해도 1개만 쓰고 제출됐다.
   * minSelections === maxSelections 면 "정확히 N개", 다르면 "N개 이상"이다.
   */
  minSelections: number;
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
  sentenceCount: number;
  maxReactionsPerStudent: number;
};

export type HanjaWritingSubmission = {
  contents: string[];
};

export type HanjaWritingResult = {
  submitted: boolean;
  likeCount?: number;
};

export type HanjaWritingBoardEntry = {
  entryId: string;
  sessionId: string;
  sentenceIndex: number;
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
