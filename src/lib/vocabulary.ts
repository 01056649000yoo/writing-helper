import allVocabData from "@/data/vocabulary/all.json";
import grade3VocabData from "@/data/vocabulary/grade3.json";
import grade4VocabData from "@/data/vocabulary/grade4.json";
import grade5VocabData from "@/data/vocabulary/grade5.json";
import grade6VocabData from "@/data/vocabulary/grade6.json";
import vocabSummaryData from "@/data/vocabulary/summary.json";

export const VOCAB_GRADES = [3, 4, 5, 6] as const;
export const VOCAB_LEVELS = [1, 2, 3] as const;

export type VocabularyGrade = (typeof VOCAB_GRADES)[number];
export type VocabularyLevel = (typeof VOCAB_LEVELS)[number];

export type VocabularyEntry = {
  id: string;
  grade: VocabularyGrade;
  word: string;
  category: string;
  level: VocabularyLevel;
  definition: string;
  example: string;
  source: string;
};

export type VocabularyGradeSummary = {
  count: number;
  levels: Record<string, number>;
  categories: Record<string, number>;
};

export type VocabularySummary = {
  totalCount: number;
  grades: Record<string, VocabularyGradeSummary>;
};

export const VOCAB_BY_GRADE: Record<VocabularyGrade, VocabularyEntry[]> = {
  3: grade3VocabData as VocabularyEntry[],
  4: grade4VocabData as VocabularyEntry[],
  5: grade5VocabData as VocabularyEntry[],
  6: grade6VocabData as VocabularyEntry[],
};

export const ALL_VOCAB = allVocabData as VocabularyEntry[];
export const VOCAB_SUMMARY = vocabSummaryData as VocabularySummary;

export function getVocabByGrade(grade: VocabularyGrade) {
  return VOCAB_BY_GRADE[grade];
}

export function findVocabByWord(word: string) {
  return ALL_VOCAB.find((entry) => entry.word === word);
}

export function getVocabCategories(grade?: VocabularyGrade) {
  const entries = grade ? VOCAB_BY_GRADE[grade] : ALL_VOCAB;

  return [...new Set(entries.map((entry) => entry.category))].sort((a, b) =>
    a.localeCompare(b, "ko-KR")
  );
}
