"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/app-path";
import {
  OUTLINE_BOARD_FRESH_MS,
  OUTLINE_BOARD_MANUAL_COOLDOWN_MS,
  OUTLINE_BOARD_REFRESH_MS,
  OUTLINE_BOARD_SECTIONS,
  OUTLINE_VIEWER_FIT_MIN,
  OUTLINE_VIEWER_FONT_DEFAULT_INDEX,
  OUTLINE_VIEWER_FONT_STEPS,
  OUTLINE_VIEWER_FONT_STORAGE_KEY,
  readFontStep,
  boardRemaining,
  changedStudentKeys,
  formatBoardDeadline,
  formatSyncedAt,
  readOutlineBoardResponse,
  outlinePreview,
  type OutlineBoardPayload,
  type OutlineBoardStudent,
} from "@/lib/outline-board";

// 친구 개요 모음(2026-10-10): 이름 카드 모음 → 누르면 한 명씩 전체 화면.
// 1분마다 저절로(다른 탭이면 멈춤), `지금 새로 고침` 은 5초 쉼. 학생 상시 실시간 연결은 쓰지 않는다.

type OpenBoard = Extract<OutlineBoardPayload, { state: "open" }>;

export function OutlineBoardClient({
  token, initial, loadedAt, embedded = false,
}: {
  token: string;
  initial: OutlineBoardPayload | null;
  loadedAt: string;
  /** 학생 개요 화면의 모달 안(2026-10-10). 처음 자료 없이 열려 곧바로 불러온다. */
  embedded?: boolean;
}) {
  const [board, setBoard] = useState<OutlineBoardPayload | null>(initial);
  const [syncedAt, setSyncedAt] = useState<Date | null>(initial ? new Date(loadedAt) : null);
  const [loadError, setLoadError] = useState(initial || embedded ? "" : "개요를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.");
  const [refreshing, setRefreshing] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const [fresh, setFresh] = useState<Map<string, number>>(new Map());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date(loadedAt));
  const previousRef = useRef<OutlineBoardStudent[] | null>(initial?.state === "open" ? initial.students : null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const initialRef = useRef(initial);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => refreshRef.current(), OUTLINE_BOARD_REFRESH_MS);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    setRefreshing(true);
    try {
      const response = await fetch(withBasePath(`/board/${token}/data`), { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const next = readOutlineBoardResponse(await response.json());
      if (next.state === "open") {
        const changed = changedStudentKeys(previousRef.current, next.students);
        previousRef.current = next.students;
        if (changed.size > 0) {
          const stamp = Date.now();
          setFresh((current) => {
            const merged = new Map(current);
            changed.forEach((key) => merged.set(key, stamp));
            return merged;
          });
        }
      }
      setBoard(next);
      setSyncedAt(new Date());
      setLoadError("");
    } catch {
      setLoadError("새로 고치지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setRefreshing(false);
      setNow(new Date());
      schedule();
    }
  }, [token, schedule]);

  useEffect(() => {
    refreshRef.current = () => { void refresh(); };
  }, [refresh]);

  // 1분 자동. 다른 탭·화면 꺼짐이면 멈추고, 돌아오면 곧바로 한 번. 모달은 열리자마자 한 번 읽는다.
  useEffect(() => {
    if (!initialRef.current) {
      const first = setTimeout(() => refreshRef.current(), 0);
      return () => clearTimeout(first);
    }
  }, []);

  useEffect(() => {
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshRef.current();
      else if (timerRef.current) clearTimeout(timerRef.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule]);

  // 새 표시(노란 테두리)는 2분 뒤 사라진다.
  useEffect(() => {
    if (fresh.size === 0) return;
    const id = setTimeout(() => {
      const cutoff = Date.now() - OUTLINE_BOARD_FRESH_MS;
      setFresh((current) => new Map([...current].filter(([, at]) => at > cutoff)));
    }, 15_000);
    return () => clearTimeout(id);
  }, [fresh]);

  function manualRefresh() {
    if (coolingDown || refreshing) return;
    setCoolingDown(true);
    setTimeout(() => setCoolingDown(false), OUTLINE_BOARD_MANUAL_COOLDOWN_MS);
    void refresh();
  }

  if (!board && !loadError) {
    return <BoardNotice emoji="⏳" title="친구 개요를 불러오고 있어요" body="잠깐만 기다려 주세요." embedded={embedded} />;
  }
  if (!board) {
    return (
      <BoardNotice
        embedded={embedded}
        emoji="📡"
        title="개요를 불러오지 못했어요"
        body={loadError}
        action={<button type="button" className="lab-button lab-button--primary" onClick={manualRefresh} disabled={coolingDown || refreshing}>다시 불러오기</button>}
      />
    );
  }
  if (board.state === "expired") {
    return <BoardNotice emoji="⏰" title="기간이 끝났어요" body="이 친구 개요 모음은 닫혔어요. 선생님께 새 주소를 받아 주세요." embedded={embedded} />;
  }
  if (board.state !== "open") {
    return <BoardNotice emoji="🔒" title="열 수 없는 주소예요" body="닫혔거나 없는 친구 개요 모음이에요. 선생님께 새 주소를 받아 주세요." embedded={embedded} />;
  }

  const students = board.students;
  const selectedIndex = selectedKey ? students.findIndex((student) => student.key === selectedKey) : -1;

  return (
    <main className={`outline-board${embedded ? " outline-board--embedded" : ""}`}>
      <BoardHeader
        board={board}
        now={now}
        syncedAt={syncedAt}
        refreshing={refreshing}
        coolingDown={coolingDown}
        loadError={loadError}
        onRefresh={manualRefresh}
      />

      {students.length === 0 ? (
        <section className="outline-board__empty lab-panel">
          <p className="text-4xl" aria-hidden="true">🌱</p>
          <p className="font-bold text-[var(--ui-ink)]">아직 제출한 개요가 없어요</p>
          <p className="text-[var(--ui-ink-muted)]">친구가 개요를 제출하면 1분 안에 여기에 나타나요.</p>
        </section>
      ) : (
        <ul className="outline-board__grid" aria-label="제출한 친구 개요">
          {students.map((student) => (
            <li key={student.key}>
              <button
                type="button"
                className={`outline-board__card${fresh.has(student.key) ? " outline-board__card--fresh" : ""}`}
                onClick={() => setSelectedKey(student.key)}
              >
                <span className="outline-board__card-name">
                  <span className="outline-board__number">{student.number}번</span> {student.name}
                </span>
                <span className="outline-board__card-preview">{outlinePreview(student) || "개요를 열어 보세요"}</span>
                {fresh.has(student.key) && <span className="outline-board__fresh-tag">새로 들어옴</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedIndex >= 0 && (
        <OutlineViewer
          students={students}
          index={selectedIndex}
          freshAt={fresh.get(students[selectedIndex].key) ?? null}
          onMove={(nextIndex) => setSelectedKey(students[nextIndex]?.key ?? null)}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </main>
  );
}

function BoardHeader({
  board, now, syncedAt, refreshing, coolingDown, loadError, onRefresh,
}: {
  board: OpenBoard;
  now: Date;
  syncedAt: Date | null;
  refreshing: boolean;
  coolingDown: boolean;
  loadError: string;
  onRefresh: () => void;
}) {
  const remaining = boardRemaining(board.expiresAt, now);
  const deadline = formatBoardDeadline(board.expiresAt);
  const time = deadline.split(") ")[1] ?? deadline;
  return (
    <header className="outline-board__header lab-panel">
      <div className="min-w-0">
        <p className="outline-board__eyebrow">🌱 친구 개요 모음</p>
        <h1 className="outline-board__title">「{board.topic}」</h1>
        {deadline && (
          <p className={`outline-board__deadline${remaining?.urgent ? " outline-board__deadline--urgent" : ""}`}>
            {remaining?.label === "오늘 닫혀요"
              ? `오늘 ${time}에 닫혀요`
              : `이 페이지는 ${deadline}까지 열려요${remaining ? ` · ${remaining.label}` : ""}`}
          </p>
        )}
      </div>
      <div className="outline-board__sync">
        <p className="outline-board__count">제출 <strong>{board.students.length}</strong>명</p>
        <p className="outline-board__synced" aria-live="polite">
          {loadError || (syncedAt ? `마지막 반영 ${formatSyncedAt(syncedAt)}` : "")}
        </p>
        <button
          type="button"
          className="lab-button lab-button--primary"
          onClick={onRefresh}
          disabled={refreshing || coolingDown}
          title="1분마다 저절로 새로 고쳐요. 누르면 지금 바로 가져와요."
        >
          {refreshing ? "가져오는 중…" : coolingDown ? "잠깐만요" : "↻ 지금 새로 고침"}
        </button>
      </div>
    </header>
  );
}

function OutlineViewer({
  students, index, freshAt, onMove, onClose,
}: {
  students: OutlineBoardStudent[];
  index: number;
  freshAt: number | null;
  onMove: (index: number) => void;
  onClose: () => void;
}) {
  const student = students[index];
  const prev = index > 0 ? students[index - 1] : null;
  const next = index < students.length - 1 ? students[index + 1] : null;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  // 보기 창은 카드를 누른 뒤에만 그려져(서버 렌더 없음) 처음 값으로 바로 읽어도 된다.
  const [canFullscreen] = useState(() => typeof document !== "undefined" && Boolean(document.fullscreenEnabled));
  const [openedAt] = useState(() => Date.now());
  // 글자 크기는 이 기기에만 기억한다(브라우저 저장소가 막혀 있어도 기본 크기로 동작).
  const [fontStep, setFontStep] = useState(() => {
    try { return readFontStep(window.localStorage.getItem(OUTLINE_VIEWER_FONT_STORAGE_KEY)); }
    catch { return OUTLINE_VIEWER_FONT_DEFAULT_INDEX; }
  });

  const changeFont = useCallback((delta: number) => {
    setFontStep((current) => {
      const next = Math.min(OUTLINE_VIEWER_FONT_STEPS.length - 1, Math.max(0, current + delta));
      try { window.localStorage.setItem(OUTLINE_VIEWER_FONT_STORAGE_KEY, String(next)); } catch { /* 기억 못 해도 지금 화면은 바뀐다 */ }
      return next;
    });
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
      if (event.key === "ArrowLeft" && prev) onMove(index - 1);
      if (event.key === "ArrowRight" && next) onMove(index + 1);
      if (event.key === "+" || event.key === "=") changeFont(1);
      if (event.key === "-" || event.key === "_") changeFont(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, prev, next, onMove, onClose, changeFont]);

  // 노트북 화면에서 처음·가운데·끝 세 줄이 한 화면에 들어오게: 고른 크기로 그린 뒤 넘치는 줄이 있으면 그 학생만 조금씩 줄인다
  // (최저 OUTLINE_VIEWER_FIT_MIN). 그려지기 전에 DOM 의 글자 배율만 바꿔 깜빡이지 않는다. 휴대폰은 쌓아서 내려 보니 줄이지 않는다.
  const fitNoteRef = useRef<HTMLSpanElement | null>(null);
  const fitToScreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const chosen = OUTLINE_VIEWER_FONT_STEPS[fontStep];
    let scale: number = chosen;
    root.style.setProperty("--outline-font-scale", String(scale));
    if (!window.matchMedia("(max-width: 767px)").matches) {
      const columns = [...root.querySelectorAll<HTMLElement>(".outline-viewer__items")];
      const overflowing = () => columns.some((column) => column.scrollHeight > column.clientHeight + 1);
      while (overflowing() && scale > OUTLINE_VIEWER_FIT_MIN) {
        scale = Math.max(OUTLINE_VIEWER_FIT_MIN, Math.round((scale - 0.04) * 100) / 100);
        root.style.setProperty("--outline-font-scale", String(scale));
      }
    }
    if (fitNoteRef.current) {
      fitNoteRef.current.textContent = scale < chosen ? `화면에 맞춰 ${Math.round(scale * 100)}%` : "";
    }
  }, [fontStep]);

  useLayoutEffect(() => {
    fitToScreen();
  }, [fitToScreen, student]);

  useEffect(() => {
    window.addEventListener("resize", fitToScreen);
    return () => window.removeEventListener("resize", fitToScreen);
  }, [fitToScreen]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void rootRef.current?.requestFullscreen().catch(() => {});
  }

  const editedWhileOpen = freshAt !== null && freshAt > openedAt;

  return (
    <div
      ref={rootRef}
      className="outline-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${student.number}번 ${student.name} 개요`}
      onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchX.current;
        touchX.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (start === null || end === undefined) return;
        if (end - start > 70 && prev) onMove(index - 1);
        if (start - end > 70 && next) onMove(index + 1);
      }}
    >
      <div className="outline-viewer__bar">
        <button ref={closeRef} type="button" className="lab-button lab-button--quiet" onClick={onClose}>✕ 닫기</button>
        <p className="outline-viewer__who">
          <span className="outline-board__number">{student.number}번</span> {student.name}
          {editedWhileOpen && <span className="outline-board__fresh-tag">방금 고쳐졌어요</span>}
        </p>
        <div className="outline-viewer__tools">
          <div className="outline-viewer__font" role="group" aria-label="글자 크기">
            <button type="button" className="lab-button" onClick={() => changeFont(-1)} disabled={fontStep === 0} aria-label="글자 작게">가−</button>
            <span className="outline-viewer__font-value">{Math.round(OUTLINE_VIEWER_FONT_STEPS[fontStep] * 100)}%</span>
            <span ref={fitNoteRef} className="outline-viewer__fit-note" aria-live="polite" />
            <button type="button" className="lab-button" onClick={() => changeFont(1)} disabled={fontStep === OUTLINE_VIEWER_FONT_STEPS.length - 1} aria-label="글자 크게">가+</button>
          </div>
          <p className="outline-viewer__pos">{index + 1} / {students.length}</p>
        </div>
      </div>

      <div className="outline-viewer__body">
        {OUTLINE_BOARD_SECTIONS.map((section) => (
          <section
            key={section}
            className="outline-viewer__section"
            // 한 줄 안의 질문은 옆으로 나란히(최대 3개) — 위아래로 쌓아도 한 화면에 들어오게.
            style={{ "--outline-item-cols": Math.max(1, Math.min(3, student.sections[section].length)) } as React.CSSProperties}
          >
            <h2 className="outline-viewer__section-title">{section}</h2>
            {student.sections[section].length === 0 ? (
              <p className="outline-viewer__blank">비어 있어요</p>
            ) : (
              <ul className="outline-viewer__items">
                {student.sections[section].map((item, itemIndex) => (
                  <li key={`${section}-${itemIndex}`}>
                    {item.label && <span className="outline-viewer__label">{item.label}</span>}
                    <span className="outline-viewer__answer">{item.answer}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="outline-viewer__nav">
        <button type="button" className="lab-button" onClick={() => prev && onMove(index - 1)} disabled={!prev}>
          ◀ 이전{prev && <span className="outline-viewer__peer"> ({prev.number}번 {prev.name})</span>}
        </button>
        {canFullscreen && (
          <button type="button" className="lab-button lab-button--quiet outline-viewer__fullscreen" onClick={toggleFullscreen}>
            ⛶ 칠판 전체 화면
          </button>
        )}
        <button type="button" className="lab-button" onClick={() => next && onMove(index + 1)} disabled={!next}>
          다음{next && <span className="outline-viewer__peer"> ({next.number}번 {next.name})</span>} ▶
        </button>
      </div>
    </div>
  );
}

function BoardNotice({ emoji, title, body, action, embedded = false }: { emoji: string; title: string; body: string; action?: React.ReactNode; embedded?: boolean }) {
  return (
    <main className={`outline-board outline-board--notice${embedded ? " outline-board--embedded" : ""}`}>
      <section className="outline-board__empty lab-panel">
        <p className="text-5xl" aria-hidden="true">{emoji}</p>
        <h1 className="text-xl font-bold text-[var(--ui-ink)]">{title}</h1>
        <p className="text-[var(--ui-ink-muted)]">{body}</p>
        {action}
      </section>
    </main>
  );
}
