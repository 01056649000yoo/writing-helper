import type {
  QuestionVotingConfig,
  QuestionVotingRoomResult,
  QuestionVotingSubmission,
} from "@/features/activities/types";

type QuestionVotingQuestion = QuestionVotingConfig["sourceQuestions"][number];

export function normalizeQuestionVotingConfig(value: unknown): QuestionVotingConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const sourceQuestions = Array.isArray(raw.sourceQuestions)
    ? raw.sourceQuestions
        .filter(isQuestion)
        .map((question) => ({
          id: question.id.trim(),
          text: question.text.trim(),
        }))
        .filter((question) => question.id.length > 0 && question.text.length > 0)
    : [];
  const dedupedSourceQuestions = dedupeQuestions(sourceQuestions);

  const evaluationCriteria = Array.isArray(raw.evaluationCriteria)
    ? raw.evaluationCriteria
        .filter((criterion): criterion is string => typeof criterion === "string")
        .map((criterion) => criterion.trim())
        .filter(Boolean)
    : [];

  return dedupedSourceQuestions.length > 0
    ? {
        sourceRoomId: typeof raw.sourceRoomId === "string" && raw.sourceRoomId.trim()
          ? raw.sourceRoomId.trim()
          : null,
        sourceRoomTitle: typeof raw.sourceRoomTitle === "string" && raw.sourceRoomTitle.trim()
          ? raw.sourceRoomTitle.trim()
          : null,
        sourceQuestions: dedupedSourceQuestions,
        evaluationCriteria,
        maxSelections: clampNumber(raw.maxSelections, 1, Math.max(dedupedSourceQuestions.length, 1), 1),
        requireReason: raw.requireReason === true,
      }
    : null;
}

export function normalizeQuestionVotingSubmission(value: unknown): QuestionVotingSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const selectedQuestionIds = Array.isArray(raw.selectedQuestionIds)
    ? raw.selectedQuestionIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  return selectedQuestionIds.length > 0
    ? {
        selectedQuestionIds,
        reason: typeof raw.reason === "string" && raw.reason.trim()
          ? raw.reason.trim()
          : undefined,
      }
    : null;
}

export function buildQuestionVotingRanking(
  config: QuestionVotingConfig,
  submissions: QuestionVotingSubmission[],
): QuestionVotingRoomResult["ranking"] {
  const questionMap = new Map(config.sourceQuestions.map((question) => [question.id, question] as const));
  const counters = new Map<string, { question: QuestionVotingQuestion; votes: number; reasons: string[] }>();

  for (const question of config.sourceQuestions) {
    counters.set(question.id, {
      question,
      votes: 0,
      reasons: [],
    });
  }

  for (const submission of submissions) {
    for (const questionId of submission.selectedQuestionIds) {
      const entry = counters.get(questionId);
      if (!entry) continue;
      entry.votes += 1;
      if (submission.reason) {
        entry.reasons.push(submission.reason);
      }
    }
  }

  return [...counters.values()]
    .map((entry) => ({
      questionId: entry.question.id,
      text: questionMap.get(entry.question.id)?.text ?? entry.question.text,
      votes: entry.votes,
      reasons: entry.reasons,
    }))
    .sort((left, right) => {
      if (right.votes !== left.votes) return right.votes - left.votes;
      return left.questionId.localeCompare(right.questionId, "ko");
    });
}

function isQuestion(value: unknown): value is { id: string; text: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { id?: unknown }).id === "string"
    && typeof (value as { text?: unknown }).text === "string";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function dedupeQuestions(questions: Array<{ id: string; text: string }>) {
  const seen = new Map<string, number>();

  return questions.map((question) => {
    const count = seen.get(question.id) ?? 0;
    seen.set(question.id, count + 1);

    if (count === 0) {
      return question;
    }

    return {
      ...question,
      id: `${question.id}__${count + 1}`,
    };
  });
}
