"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStudentOutlineBoard } from "@/app/actions/outline-board-actions";
import { OutlineBoardClient } from "@/app/board/[token]/board-client";
import {
  SAMLINK_DISPLAY_HOST,
  boardRemaining,
  formatBoardDeadline,
  type StudentOutlineBoard,
} from "@/lib/outline-board";

// 학생 개요 화면의 친구 개요 모음 띠(2026-10-10, 선생님 결정).
// 선생님이 켠 방에서만 보인다. 누르면 화면을 떠나지 않고 모달로 친구 개요 모음을 연다.
// 기간이 지나면 회색·줄 그은 주소·`기간이 끝났어요`, 선생님이 끄면 띠가 사라진다.
// 상태는 화면에 들어올 때·모달을 닫을 때만 다시 읽는다(학생 상시 폴링 없음). 모달 안 새로 고침은 판 화면이 1분마다.
export function OutlineBoardLink({
  sessionId, roomId, variant = "strip",
}: {
  sessionId: string;
  roomId: string;
  /** strip: 쓰는 화면 위쪽 띠 · card: 개요 완성 화면의 큰 상자 */
  variant?: "strip" | "card";
}) {
  const [board, setBoard] = useState<StudentOutlineBoard | null>(null);

  const load = useCallback(() => {
    if (!sessionId || !roomId) return;
    getStudentOutlineBoard(sessionId, roomId).then(setBoard).catch(() => {});
  }, [sessionId, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!board) return null;
  return <OutlineBoardLinkView board={board} variant={variant} onClosed={load} />;
}

/** 띠·상자와 모달. 불러오기와 나눠 두어 화면 확인(미리보기)에서 그대로 그린다. */
export function OutlineBoardLinkView({
  board, variant, onClosed,
}: {
  board: StudentOutlineBoard;
  variant: "strip" | "card";
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    onClosed?.();
    triggerRef.current?.focus();
  }, [onClosed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // 한 명씩 보기 창이 열려 있으면 그쪽 Esc 가 먼저다.
      if (event.key === "Escape" && !document.querySelector(".outline-viewer")) close();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const expired = board.state === "expired" || !boardRemaining(board.expiresAt);
  const remaining = boardRemaining(board.expiresAt);
  const deadline = formatBoardDeadline(board.expiresAt);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`outline-board-link outline-board-link--${variant}${expired ? " outline-board-link--expired" : ""}`}
        onClick={() => { setOpenedAt(new Date().toISOString()); setOpen(true); }}
        aria-haspopup="dialog"
      >
        <span className="outline-board-link__title">👀 친구 개요 모음</span>
        <span className="outline-board-link__url">{SAMLINK_DISPLAY_HOST}/{board.slug}</span>
        {expired ? (
          <span className="outline-board-link__badge">기간이 끝났어요</span>
        ) : (
          deadline && (
            <span className="outline-board-link__meta">
              {deadline}까지{remaining ? ` · ${remaining.label}` : ""}
            </span>
          )
        )}
        <span className="outline-board-link__go">{expired ? "열어 보기" : "친구 개요 보러 가기 →"}</span>
      </button>

      {open && (
        <div className="outline-board-modal" role="dialog" aria-modal="true" aria-label="친구 개요 모음">
          <div className="outline-board-modal__bar">
            <span className="font-bold text-[var(--ui-ink-strong)]">👀 친구 개요 모음 · {SAMLINK_DISPLAY_HOST}/{board.slug}</span>
            <button type="button" className="lab-button" onClick={close}>✕ 닫고 내 개요로</button>
          </div>
          <div className="outline-board-modal__body">
            <OutlineBoardClient token={board.token} initial={null} loadedAt={openedAt} embedded />
          </div>
        </div>
      )}
    </>
  );
}
