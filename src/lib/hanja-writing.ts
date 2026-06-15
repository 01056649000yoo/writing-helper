import type { HanjaWritingBoardEntry, HanjaWritingConfig, HanjaWritingSubmission } from "@/features/activities/types";

type RawHanjaReaction = {
  target_session_id: string;
  session_id: string;
};

type RawHanjaSubmissionSession = {
  id: string;
  student_number: number;
  student_name: string;
  submission: { content?: unknown } | null;
  updated_at: string;
};

export function normalizeHanjaWritingConfig(value: unknown): HanjaWritingConfig | null {
  if (!isRecord(value)) return null;
  const rawCard = isRecord(value.card) ? value.card : null;
  if (!rawCard) return null;
  const word = typeof rawCard.word === "string" ? rawCard.word.trim() : "";
  if (!word) return null;

  return {
    promptTitle: typeof value.promptTitle === "string" && value.promptTitle.trim()
      ? value.promptTitle.trim()
      : "한자 카드를 보고 한 문장을 만들어 보세요",
    promptDescription: typeof value.promptDescription === "string" && value.promptDescription.trim()
      ? value.promptDescription.trim()
      : "단어 속 한자의 뜻과 관련 단어를 살펴본 뒤, 이 단어를 활용해 자연스러운 한 문장을 써보세요.",
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
  };
}

export function normalizeHanjaWritingSubmission(value: unknown): HanjaWritingSubmission | null {
  if (!isRecord(value)) return null;
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (!content) return null;
  return { content };
}

export function sentenceContainsWord(sentence: string, word: string): boolean {
  const normalizedWord = normalizeSearchText(word);
  if (!normalizedWord) return false;

  const normalizedSentence = normalizeSearchText(sentence);
  if (!normalizedSentence) return false;

  const compactWord = compactSearchText(word);
  const compactSentence = compactSearchText(sentence);

  if (!compactWord || !compactSentence) return false;
  if (compactSentence.includes(compactWord)) return true;

  const tokens = sentence
    .split(/[\s,.;:!?()[\]{}"'“”‘’/\\|<>]+/u)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);

  return tokens.some((token) => {
    if (token === normalizedWord) return true;
    return KOREAN_PARTICLE_SUFFIXES.some((suffix) => token === `${normalizedWord}${suffix}`);
  });
}

export function buildHanjaWritingBoard(
  sessions: RawHanjaSubmissionSession[],
  reactions: RawHanjaReaction[],
  currentSessionId?: string | null,
): HanjaWritingBoardEntry[] {
  const likeCountByTarget = new Map<string, number>();
  const likedTargetIds = new Set<string>();

  reactions.forEach((reaction) => {
    likeCountByTarget.set(
      reaction.target_session_id,
      (likeCountByTarget.get(reaction.target_session_id) ?? 0) + 1,
    );

    if (currentSessionId && reaction.session_id === currentSessionId) {
      likedTargetIds.add(reaction.target_session_id);
    }
  });

  return sessions.flatMap((session) => {
    const content = typeof session.submission?.content === "string" ? session.submission.content.trim() : "";
    if (!content) return [];

    return [{
      sessionId: session.id,
      studentNumber: session.student_number,
      studentName: session.student_name,
      content,
      likeCount: likeCountByTarget.get(session.id) ?? 0,
      likedByCurrentSession: likedTargetIds.has(session.id),
      isMine: currentSessionId === session.id,
      createdAt: session.updated_at,
    }];
  }).sort((left, right) => {
    if (right.likeCount !== left.likeCount) {
      return right.likeCount - left.likeCount;
    }

    if (left.isMine !== right.isMine) {
      return left.isMine ? -1 : 1;
    }

    return left.studentNumber - right.studentNumber;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KOREAN_PARTICLE_SUFFIXES = [
  "은", "는", "이", "가", "을", "를", "와", "과", "도", "만",
  "에", "에서", "에게", "께", "한테", "으로", "로", "보다", "처럼",
  "만큼", "부터", "까지", "랑", "이나", "나", "의",
];

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function compactSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function clampGrade(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 4;
  return Math.min(Math.max(Math.trunc(num), 3), 6);
}
