import { pickPodium, rankByScore, type Ranked } from "@/lib/ranking";
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
      }
    : null;
}

export function buildQuestionVotingRanking(
  config: QuestionVotingConfig,
  submissions: QuestionVotingSubmission[],
): QuestionVotingRoomResult["ranking"] {
  const questionMap = new Map(config.sourceQuestions.map((question) => [question.id, question] as const));
  const counters = new Map<string, { question: QuestionVotingQuestion; votes: number }>();

  for (const question of config.sourceQuestions) {
    counters.set(question.id, {
      question,
      votes: 0,
    });
  }

  for (const submission of submissions) {
    for (const questionId of submission.selectedQuestionIds) {
      const entry = counters.get(questionId);
      if (!entry) continue;
      entry.votes += 1;
    }
  }

  return [...counters.values()]
    .map((entry) => ({
      questionId: entry.question.id,
      text: questionMap.get(entry.question.id)?.text ?? entry.question.text,
      votes: entry.votes,
    }))
    .sort((left, right) => {
      if (right.votes !== left.votes) return right.votes - left.votes;
      // 표가 같으면 순서를 정할 근거가 없다. 화면이 이 순서를 등수로 읽지 않도록
      // `rankQuestionVoting` 이 같은 표에 같은 등수를 매긴다. 여기서는 다시 열어도
      // 목록이 흔들리지 않게 안정적인 순서만 만든다.
      return left.questionId.localeCompare(right.questionId, "ko");
    });
}

/**
 * 등수·시상대 규칙은 활동 공용이다. 한 줄 나눔도 같은 규칙을 쓴다.
 * 여기서는 "점수가 무엇인지"(표 수)만 알려 준다.
 */
export type RankedQuestionVotingItem = Ranked<QuestionVotingRoomResult["ranking"][number]>;

const votesOf = (item: { votes: number }) => item.votes;

export function rankQuestionVoting(
  ranking: QuestionVotingRoomResult["ranking"],
): RankedQuestionVotingItem[] {
  return rankByScore(ranking, votesOf);
}

export function pickQuestionVotingPodium(
  ranked: RankedQuestionVotingItem[],
): RankedQuestionVotingItem[] {
  return pickPodium(ranked, votesOf);
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
