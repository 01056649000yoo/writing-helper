import type { HanjaWritingBoardEntry, HanjaWritingConfig, HanjaWritingSubmission } from "@/features/activities/types";

type RawHanjaReaction = {
  target_session_id: string;
  target_sentence_index?: number | null;
  session_id: string;
};

type RawHanjaSubmissionSession = {
  id: string;
  student_number: number;
  student_name: string;
  submission: { content?: unknown; contents?: unknown } | null;
  updated_at: string;
};

export function normalizeHanjaWritingConfig(value: unknown): HanjaWritingConfig | null {
  if (!isRecord(value)) return null;
  const rawCard = isRecord(value.card) ? value.card : null;
  if (!rawCard) return null;
  const word = typeof rawCard.word === "string" ? rawCard.word.trim() : "";
  if (!word) return null;

  const rawMax = typeof value.maxReactionsPerStudent === "number"
    ? value.maxReactionsPerStudent
    : Number(value.maxReactionsPerStudent);
  const maxReactionsPerStudent = Number.isFinite(rawMax)
    ? Math.min(Math.max(Math.trunc(rawMax), 1), 10)
    : 3;
  const rawSentenceCount = typeof value.sentenceCount === "number"
    ? value.sentenceCount
    : Number(value.sentenceCount);
  const sentenceCount = Number.isFinite(rawSentenceCount)
    ? Math.min(Math.max(Math.trunc(rawSentenceCount), 1), 5)
    : 1;

  return {
    promptTitle: typeof value.promptTitle === "string" && value.promptTitle.trim()
      ? value.promptTitle.trim()
      : "한자 카드를 보고 문장을 만들어 보세요",
    promptDescription: typeof value.promptDescription === "string" && value.promptDescription.trim()
      ? value.promptDescription.trim()
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
  };
}

export function normalizeHanjaWritingSubmission(value: unknown): HanjaWritingSubmission | null {
  if (!isRecord(value)) return null;
  const contents = extractHanjaWritingContents(value);
  if (contents.length === 0) return null;
  return { contents };
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
    const targetId = createHanjaSentenceEntryId(
      reaction.target_session_id,
      typeof reaction.target_sentence_index === "number" ? reaction.target_sentence_index : 0,
    );
    likeCountByTarget.set(
      targetId,
      (likeCountByTarget.get(targetId) ?? 0) + 1,
    );

    if (currentSessionId && reaction.session_id === currentSessionId) {
      likedTargetIds.add(targetId);
    }
  });

  return sessions.flatMap((session) => {
    const contents = extractHanjaWritingContents(session.submission);
    if (contents.length === 0) return [];

    return contents.map((content, sentenceIndex) => {
      const entryId = createHanjaSentenceEntryId(session.id, sentenceIndex);
      return {
        entryId,
        sessionId: session.id,
        sentenceIndex,
        studentNumber: session.student_number,
        studentName: session.student_name,
        content,
        likeCount: likeCountByTarget.get(entryId) ?? 0,
        likedByCurrentSession: likedTargetIds.has(entryId),
        isMine: currentSessionId === session.id,
        createdAt: session.updated_at,
      };
    });
  }).sort((left, right) => {
    if (right.likeCount !== left.likeCount) {
      return right.likeCount - left.likeCount;
    }

    if (left.isMine !== right.isMine) {
      return left.isMine ? -1 : 1;
    }

    if (left.studentNumber !== right.studentNumber) {
      return left.studentNumber - right.studentNumber;
    }

    return left.sentenceIndex - right.sentenceIndex;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractHanjaWritingContents(value: unknown): string[] {
  if (!isRecord(value)) return [];

  const contents = Array.isArray(value.contents)
    ? value.contents
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  if (contents.length > 0) return contents;

  const content = typeof value.content === "string" ? value.content.trim() : "";
  return content ? [content] : [];
}

export function createHanjaSentenceEntryId(sessionId: string, sentenceIndex: number) {
  return `${sessionId}:${sentenceIndex}`;
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
