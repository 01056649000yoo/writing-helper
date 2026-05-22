import type { ActivityType } from "@/features/activities/types";

export const DRAFT_STORAGE_PREFIX = "writing-helper:activity-draft:v1";
export const SCIENCE_DRAFT_SLUG = "science";

type StoredDraft<T> = {
  data: T;
  savedAt: number;
};

export type DraftActivitySlug = ActivityType | typeof SCIENCE_DRAFT_SLUG;
export type DraftKind = "writing" | "science";

export type ActivityDraftSummary = {
  storageKey: string;
  classId: string;
  kind: DraftKind;
  /** writing 활동 타입이거나 'science' */
  activitySlug: DraftActivitySlug;
  topic: string;
  topicDescription: string;
  sourceRoomTitle: string;
  sourceRoomTopic: string;
  savedAt: number | null;
};

const WRITING_ACTIVITY_SLUGS: ReadonlySet<string> = new Set<ActivityType>([
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
]);

function classifySlug(slug: string): { kind: DraftKind; activitySlug: DraftActivitySlug } | null {
  if (slug === SCIENCE_DRAFT_SLUG) return { kind: "science", activitySlug: SCIENCE_DRAFT_SLUG };
  if (WRITING_ACTIVITY_SLUGS.has(slug)) return { kind: "writing", activitySlug: slug as ActivityType };
  return null;
}

export function buildDraftStorageKey(classId: string, activitySlug: DraftActivitySlug) {
  return `${DRAFT_STORAGE_PREFIX}:${classId || "no-class"}:${activitySlug}`;
}

export function clearActivityDraft(storageKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}

export function persistActivityDraft<T>(storageKey: string, draft: T) {
  if (typeof window === "undefined") return;
  const payload: StoredDraft<T> = {
    data: draft,
    savedAt: Date.now(),
  };
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function readActivityDraft<T>(storageKey: string, initialState: T): { draft: T; savedAt: number | null } {
  if (typeof window === "undefined") {
    return { draft: initialState, savedAt: null };
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { draft: initialState, savedAt: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isStoredDraft<T>(parsed)) {
      return {
        draft: { ...initialState, ...parsed.data },
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : null,
      };
    }

    if (isRecord(parsed)) {
      return {
        draft: { ...initialState, ...parsed },
        savedAt: null,
      };
    }
  } catch {
    return { draft: initialState, savedAt: null };
  }

  return { draft: initialState, savedAt: null };
}

export function listActivityDraftsForClass(classId: string): ActivityDraftSummary[] {
  if (typeof window === "undefined") return [];

  const drafts: ActivityDraftSummary[] = [];
  const prefix = `${DRAFT_STORAGE_PREFIX}:${classId || "no-class"}:`;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(prefix)) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const slug = key.slice(prefix.length);
      const classified = classifySlug(slug);
      if (!classified) continue;

      const payload = isStoredDraft<Record<string, unknown>>(parsed)
        ? parsed
        : isRecord(parsed)
          ? { data: parsed, savedAt: null }
          : null;

      if (!payload) continue;

      drafts.push({
        storageKey: key,
        classId,
        kind: classified.kind,
        activitySlug: classified.activitySlug,
        topic: typeof payload.data.topic === "string" ? payload.data.topic : "",
        topicDescription: typeof payload.data.topic_description === "string" ? payload.data.topic_description : "",
        sourceRoomTitle: typeof payload.data.source_room_title === "string" ? payload.data.source_room_title : "",
        sourceRoomTopic: typeof payload.data.source_room_topic === "string" ? payload.data.source_room_topic : "",
        savedAt: typeof payload.savedAt === "number" ? payload.savedAt : null,
      });
    } catch {
      continue;
    }
  }

  return drafts.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredDraft<T>(value: unknown): value is StoredDraft<T> {
  return isRecord(value) && "data" in value;
}
