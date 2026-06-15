import { normalizeQuestionCardLabel } from "./question-card-roles";

export type CardColorKey =
  | "indigo"
  | "pink"
  | "lime"
  | "orange"
  | "cyan"
  | "amber"
  | "purple"
  | "emerald"
  | "fuchsia"
  | "sky"
  | "rose"
  | "slate";

export type RecommendedGradeKey = "3-4" | "5-6" | "all";

export type CardThemeClasses = {
  chip: string;
  border: string;
  accentBorder: string;
  ring: string;
  badge: string;
  softBg: string;
};

export const CARD_COLOR_THEME: Record<CardColorKey, CardThemeClasses> = {
  indigo: {
    chip: "bg-indigo-50 text-indigo-700 border border-indigo-100",
    border: "border-indigo-200",
    accentBorder: "border-l-4 border-indigo-300",
    ring: "ring-indigo-300",
    badge: "bg-indigo-500 text-white",
    softBg: "bg-indigo-50/60",
  },
  pink: {
    chip: "bg-pink-50 text-pink-700 border border-pink-100",
    border: "border-pink-200",
    accentBorder: "border-l-4 border-pink-300",
    ring: "ring-pink-300",
    badge: "bg-pink-500 text-white",
    softBg: "bg-pink-50/60",
  },
  lime: {
    chip: "bg-lime-50 text-lime-700 border border-lime-100",
    border: "border-lime-200",
    accentBorder: "border-l-4 border-lime-300",
    ring: "ring-lime-300",
    badge: "bg-lime-500 text-white",
    softBg: "bg-lime-50/60",
  },
  orange: {
    chip: "bg-orange-50 text-orange-700 border border-orange-100",
    border: "border-orange-200",
    accentBorder: "border-l-4 border-orange-300",
    ring: "ring-orange-300",
    badge: "bg-orange-500 text-white",
    softBg: "bg-orange-50/60",
  },
  cyan: {
    chip: "bg-cyan-50 text-cyan-700 border border-cyan-100",
    border: "border-cyan-200",
    accentBorder: "border-l-4 border-cyan-300",
    ring: "ring-cyan-300",
    badge: "bg-cyan-500 text-white",
    softBg: "bg-cyan-50/60",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700 border border-amber-100",
    border: "border-amber-200",
    accentBorder: "border-l-4 border-amber-300",
    ring: "ring-amber-300",
    badge: "bg-amber-500 text-white",
    softBg: "bg-amber-50/60",
  },
  purple: {
    chip: "bg-purple-50 text-purple-700 border border-purple-100",
    border: "border-purple-200",
    accentBorder: "border-l-4 border-purple-300",
    ring: "ring-purple-300",
    badge: "bg-purple-500 text-white",
    softBg: "bg-purple-50/60",
  },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    border: "border-emerald-200",
    accentBorder: "border-l-4 border-emerald-300",
    ring: "ring-emerald-300",
    badge: "bg-emerald-500 text-white",
    softBg: "bg-emerald-50/60",
  },
  fuchsia: {
    chip: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100",
    border: "border-fuchsia-200",
    accentBorder: "border-l-4 border-fuchsia-300",
    ring: "ring-fuchsia-300",
    badge: "bg-fuchsia-500 text-white",
    softBg: "bg-fuchsia-50/60",
  },
  sky: {
    chip: "bg-sky-50 text-sky-700 border border-sky-100",
    border: "border-sky-200",
    accentBorder: "border-l-4 border-sky-300",
    ring: "ring-sky-300",
    badge: "bg-sky-500 text-white",
    softBg: "bg-sky-50/60",
  },
  rose: {
    chip: "bg-rose-50 text-rose-700 border border-rose-100",
    border: "border-rose-200",
    accentBorder: "border-l-4 border-rose-300",
    ring: "ring-rose-300",
    badge: "bg-rose-500 text-white",
    softBg: "bg-rose-50/60",
  },
  slate: {
    chip: "bg-slate-50 text-slate-700 border border-slate-200",
    border: "border-slate-200",
    accentBorder: "border-l-4 border-slate-300",
    ring: "ring-slate-300",
    badge: "bg-slate-500 text-white",
    softBg: "bg-slate-50/60",
  },
};

export type CardMeta = {
  color: CardColorKey;
  recommendedGrades: RecommendedGradeKey;
  emoji: string;
};

const CARD_META_BY_LABEL: Record<string, CardMeta> = {
  상상: { color: "indigo", recommendedGrades: "3-4", emoji: "🌈" },
  마음: { color: "pink", recommendedGrades: "3-4", emoji: "💗" },
  감각: { color: "lime", recommendedGrades: "3-4", emoji: "👃" },
  이유: { color: "orange", recommendedGrades: "3-4", emoji: "❓" },
  연결: { color: "cyan", recommendedGrades: "3-4", emoji: "🔗" },
  해결: { color: "emerald", recommendedGrades: "3-4", emoji: "🔧" },
  가치: { color: "amber", recommendedGrades: "5-6", emoji: "💎" },
  관점: { color: "purple", recommendedGrades: "5-6", emoji: "🔄" },
  반전: { color: "fuchsia", recommendedGrades: "5-6", emoji: "🎲" },
  관찰: { color: "sky", recommendedGrades: "5-6", emoji: "🔍" },
  비유: { color: "rose", recommendedGrades: "5-6", emoji: "🎨" },
  시간: { color: "slate", recommendedGrades: "5-6", emoji: "⏰" },
};

const DEFAULT_CARD_META: CardMeta = {
  color: "slate",
  recommendedGrades: "all",
  emoji: "🃏",
};

export function getCardMeta(label: string | null | undefined): CardMeta {
  if (!label) return DEFAULT_CARD_META;
  const normalized = normalizeQuestionCardLabel(label);
  for (const [key, meta] of Object.entries(CARD_META_BY_LABEL)) {
    if (normalizeQuestionCardLabel(key) === normalized) return meta;
  }
  return DEFAULT_CARD_META;
}

export function getCardTheme(label: string | null | undefined): CardThemeClasses {
  return CARD_COLOR_THEME[getCardMeta(label).color];
}

export function getRecommendedGradeLabel(key: RecommendedGradeKey): string {
  switch (key) {
    case "3-4": return "초3-4 추천";
    case "5-6": return "초5-6 추천";
    case "all": return "전 학년";
  }
}

export function getRecommendedGradeChipClass(key: RecommendedGradeKey): string {
  switch (key) {
    case "3-4": return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    case "5-6": return "bg-violet-50 text-violet-700 border border-violet-100";
    case "all": return "bg-gray-100 text-gray-600 border border-gray-200";
  }
}
