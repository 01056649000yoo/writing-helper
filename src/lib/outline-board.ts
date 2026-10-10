// 친구 개요 모음(공유판) — 개요짜기에서 학생이 제출한 개요를 친구들과 함께 보는 공개 페이지(2026-10-10).
// DB 원본: 아지트 migration 20261391(writing_helper.outline_boards·get_outline_board_v1 등).
// 만료의 원본은 샘링크 링크 하나다(샘링크에서 늘리거나 지우면 이 페이지도 따라간다).
// 이 파일은 의존성이 없어 node 검사가 그대로 불러온다.

export const OUTLINE_BOARD_REFRESH_MS = 60_000;
export const OUTLINE_BOARD_MANUAL_COOLDOWN_MS = 5_000;
export const OUTLINE_BOARD_SERVER_CACHE_MS = 5_000;
export const OUTLINE_BOARD_FRESH_MS = 2 * 60_000;
export const OUTLINE_BOARD_TOKEN_PATTERN = /^[a-f0-9]{48}$/;
export const SAMLINK_DISPLAY_HOST = "샘링크.kr";

export type OutlineBoardSection = "처음" | "가운데" | "끝";
export const OUTLINE_BOARD_SECTIONS: OutlineBoardSection[] = ["처음", "가운데", "끝"];

export type OutlineBoardItem = { label: string; answer: string };
export type OutlineBoardStudent = {
  key: string;
  number: number;
  name: string;
  updatedAt: string;
  sections: Record<OutlineBoardSection, OutlineBoardItem[]>;
};

export type OutlineBoardState = "open" | "expired" | "closed" | "missing";

export type OutlineBoardPayload =
  | { state: "open"; topic: string; expiresAt: string | null; students: OutlineBoardStudent[] }
  | { state: Exclude<OutlineBoardState, "open"> };

export type TeacherOutlineBoard = {
  state: OutlineBoardState;
  slug: string;
  expiresAt: string | null;
  createdAt: string | null;
};

function text(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 학생 답 배열 → 처음·가운데·끝. 옛 개요는 label 대신 question 을 쓴다. 빈 칸은 뺀다. */
export function groupOutlineAnswers(raw: unknown): Record<OutlineBoardSection, OutlineBoardItem[]> {
  const sections: Record<OutlineBoardSection, OutlineBoardItem[]> = { 처음: [], 가운데: [], 끝: [] };
  if (!Array.isArray(raw)) return sections;
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const answer = text(row.answer);
    if (!answer) continue;
    const section = OUTLINE_BOARD_SECTIONS.includes(row.section as OutlineBoardSection)
      ? (row.section as OutlineBoardSection)
      : "처음";
    sections[section].push({ label: text(row.label, 200) || text(row.question, 200), answer });
  }
  return sections;
}

export function normalizeOutlineBoardPayload(raw: unknown): OutlineBoardPayload {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const state = data.state;
  if (state !== "open") {
    return { state: state === "expired" || state === "closed" ? state : "missing" };
  }
  const students = Array.isArray(data.students) ? data.students : [];
  return {
    state: "open",
    topic: text(data.topic, 200) || "개요짜기",
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : null,
    students: students
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row) => ({
        key: text(row.key, 40),
        number: Number(row.number) || 0,
        name: text(row.name, 40) || "이름 없음",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
        sections: groupOutlineAnswers(row.answers),
      }))
      .filter((student) => student.key),
  };
}

/**
 * 새로 고침 응답(`/board/긴번호/data`) 읽기. 서버가 이미 normalizeOutlineBoardPayload 로 정리해 보낸 모양이라
 * 다시 정리하지 않는다 — 다시 돌리면 answers 가 없어 개요가 모두 비고, 모든 카드가 `새로 들어옴` 이 된다(2026-10-10 화면 확인에서 찾음).
 */
export function readOutlineBoardResponse(raw: unknown): OutlineBoardPayload {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (data.state !== "open") {
    return { state: data.state === "expired" || data.state === "closed" ? data.state : "missing" };
  }
  const emptySections = (): Record<OutlineBoardSection, OutlineBoardItem[]> => ({ 처음: [], 가운데: [], 끝: [] });
  const students = (Array.isArray(data.students) ? data.students : [])
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null && typeof row.key === "string")
    .map((row) => {
      const sections = emptySections();
      const rawSections = (typeof row.sections === "object" && row.sections !== null ? row.sections : {}) as Record<string, unknown>;
      for (const section of OUTLINE_BOARD_SECTIONS) {
        const items = Array.isArray(rawSections[section]) ? rawSections[section] : [];
        sections[section] = items
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => ({ label: text(item.label, 200), answer: text(item.answer) }))
          .filter((item) => item.answer);
      }
      return {
        key: row.key as string,
        number: Number(row.number) || 0,
        name: text(row.name, 40) || "이름 없음",
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
        sections,
      };
    });
  return {
    state: "open",
    topic: text(data.topic, 200) || "개요짜기",
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
    students,
  };
}

export function normalizeTeacherOutlineBoard(raw: unknown): TeacherOutlineBoard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const slug = text(data.slug, 40);
  if (!slug) return null;
  const state = data.state;
  return {
    state: state === "open" || state === "expired" || state === "closed" ? state : "missing",
    slug,
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
  };
}

/** 학생 개요 화면 띠: 열린 판·기간 지난 판만(끈 판은 null → 띠 없음). token 은 모달에서 판을 읽는 데 쓴다. */
export type StudentOutlineBoard = { state: "open" | "expired"; slug: string; expiresAt: string | null; token: string };

export function normalizeStudentOutlineBoard(raw: unknown): StudentOutlineBoard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const slug = text(data.slug, 40);
  const token = typeof data.token === "string" && OUTLINE_BOARD_TOKEN_PATTERN.test(data.token) ? data.token : "";
  if (!slug || !token || (data.state !== "open" && data.state !== "expired")) return null;
  return {
    state: data.state,
    slug,
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : null,
    token,
  };
}

export function samlinkShortUrl(slug: string) {
  return `https://${SAMLINK_DISPLAY_HOST}/${slug}`;
}

/** 카드 미리보기: `처음` 첫 답(없으면 가장 먼저 나오는 답) 한 줄. */
export function outlinePreview(student: OutlineBoardStudent, max = 40) {
  const first = student.sections.처음[0] ?? student.sections.가운데[0] ?? student.sections.끝[0];
  if (!first) return "";
  const oneLine = first.answer.replace(/\s+/g, " ");
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

const SEOUL = "Asia/Seoul";

/** "10월 17일(금) 오후 3:00" — 서울 시각. */
export function formatBoardDeadline(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL, month: "long", day: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL, weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL, hour: "numeric", minute: "2-digit" }).format(date);
  return `${day}(${weekday}) ${time}`;
}

function seoulDayNumber(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SEOUL, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return Math.floor(Date.parse(`${parts}T00:00:00Z`) / 86_400_000);
}

/** 남은 기간: 오늘 닫히면 urgent. 지났으면 null. */
export function boardRemaining(iso: string | null, now = new Date()): { label: string; urgent: boolean } | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  const days = seoulDayNumber(end) - seoulDayNumber(now);
  if (days <= 0) return { label: "오늘 닫혀요", urgent: true };
  return { label: `D-${days}`, urgent: days <= 1 };
}

/** "10:42:15" — 마지막 반영 시각. */
export function formatSyncedAt(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: SEOUL, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

/** 이전에 본 판과 비교해 새로 들어오거나 고쳐진 학생 key. 첫 읽기(previous=null)는 비워 둔다. */
export function changedStudentKeys(previous: OutlineBoardStudent[] | null, next: OutlineBoardStudent[]) {
  if (!previous) return new Set<string>();
  const before = new Map(previous.map((student) => [student.key, student.updatedAt]));
  return new Set(next.filter((student) => before.get(student.key) !== student.updatedAt).map((student) => student.key));
}
