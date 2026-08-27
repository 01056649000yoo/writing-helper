"use client";

import { useEffect } from "react";

export type QuestionBoardSelection = {
  id: string;
  remixedQuestion: string;
};

type Props = {
  studentNumber: number;
  studentName: string;
  selections: QuestionBoardSelection[];
  onClose: () => void;
};

/**
 * 질문 칠판을 교실 화면 가득 띄운다.
 *
 * 칠판 안의 글자는 `text-lg` 정도라 교사가 보기에는 충분해도 교실 뒤에서는 안 읽힌다.
 * 친구들과 함께 볼 때는 이 화면을 띄운다.
 *
 * 글자 크기는 **질문 수에 따라** 정한다 — 한 개면 크게, 다섯 개면 그만큼 줄여
 * 스크롤 없이 한 화면에 담는다. 폭(vw)과 높이(vh) 중 작은 쪽을 따르므로
 * 낮은 화면(노트북·720p 프로젝터)에서도 넘치지 않는다.
 */
export function QuestionBoardFullscreen({ studentNumber, studentName, selections, onClose }: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const count = Math.max(selections.length, 1);
  // 질문은 문장이라 급식 이름보다 길다 — 개수가 늘면 더 빨리 줄여야 한 화면에 담긴다.
  const questionSize =
    count <= 1 ? "clamp(1.75rem, min(4.4vw, 8vh), 4.5rem)"
      : count === 2 ? "clamp(1.5rem, min(3.4vw, 5.6vh), 3.4rem)"
        : count === 3 ? "clamp(1.35rem, min(2.8vw, 4.2vh), 2.8rem)"
          : count === 4 ? "clamp(1.2rem, min(2.4vw, 3.4vh), 2.3rem)"
            : "clamp(1.05rem, min(2vw, 2.8vh), 2rem)";
  const numberSize =
    count <= 2 ? "clamp(1.1rem, min(2vw, 3.4vh), 2rem)" : "clamp(.95rem, min(1.5vw, 2.2vh), 1.5rem)";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#173f35] p-[clamp(16px,2.4vw,40px)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${studentNumber}번 ${studentName} 질문 크게 보기`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/20 pb-[clamp(8px,1.4vh,18px)]">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200 sm:text-sm">질문 칠판</p>
          <h2 className="mt-1 font-bold leading-tight text-white text-[clamp(1.4rem,min(3vw,4.4vh),2.6rem)]">
            {studentNumber}번 {studentName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
        >
          닫기 (Esc)
        </button>
      </header>

      {/* min-h-0 이 없으면 이 칸이 내용만큼 늘어나 목록이 화면 밖으로 나간다. */}
      <ol className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(8px,1.6vh,22px)] overflow-auto py-[clamp(10px,2vh,28px)]">
        {selections.map((selection, index) => (
          <li
            key={selection.id}
            className="flex items-start gap-[clamp(10px,1.4vw,20px)] rounded-[clamp(14px,1.6vw,24px)] border border-white/15 bg-black/10 px-[clamp(14px,2vw,32px)] py-[clamp(10px,1.6vh,22px)]"
          >
            <span
              className="shrink-0 font-bold text-emerald-100"
              style={{ fontSize: numberSize }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <p
              className="font-medium leading-[1.45] text-white [word-break:keep-all]"
              style={{ fontSize: questionSize }}
            >
              {selection.remixedQuestion}
            </p>
          </li>
        ))}
      </ol>

      <p className="shrink-0 text-center text-xs text-emerald-200/80 sm:text-sm">
        아무 곳이나 눌러도 닫히지 않아요. 오른쪽 위 닫기 단추나 Esc 를 눌러 주세요.
      </p>
    </div>
  );
}
