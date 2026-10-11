"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import {
  closeOutlineBoard,
  extendOutlineBoard,
  openOutlineBoard,
} from "@/app/actions/outline-board-actions";
import {
  SAMLINK_DISPLAY_HOST,
  boardRemaining,
  formatBoardDeadline,
  samlinkShortUrl,
  type TeacherOutlineBoard,
} from "@/lib/outline-board";

// 친구 개요 모음 — 선생님 방 화면 상자(2026-10-10).
// 주소는 샘링크 5글자·1주. 기간은 여기 `1주 늘리기` 로, 샘링크를 아지트 계정에 연결한 선생님은 샘링크 `내 링크` 에서도.
const AGIT_HOME_URL = process.env.NEXT_PUBLIC_AGIT_APP_URL ?? "https://끄적끄적아지트.site";
const SAMLINK_MANAGE_URL = `${AGIT_HOME_URL.replace(/\/$/, "")}/?samlink-connect=1`;

type Confirming = "renew" | "close" | null;

export function OutlineBoardPanel({ roomId, initialBoard }: { roomId: string; initialBoard: TeacherOutlineBoard | null }) {
  const [board, setBoard] = useState<TeacherOutlineBoard | null>(initialBoard);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [qrSmall, setQrSmall] = useState("");
  const [qrLarge, setQrLarge] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const shortUrl = board ? samlinkShortUrl(board.slug) : "";
  const isOpen = board?.state === "open";

  useEffect(() => {
    if (!shortUrl || !isOpen) return;
    QRCode.toDataURL(shortUrl, { width: 240, margin: 2, color: { dark: "#166534", light: "#ffffff" } }).then(setQrSmall);
    QRCode.toDataURL(shortUrl, { width: 1400, margin: 3, color: { dark: "#166534", light: "#ffffff" } }).then(setQrLarge);
  }, [shortUrl, isOpen]);

  function run(action: () => Promise<{ board: TeacherOutlineBoard | null; error?: string }>, done: string) {
    setError("");
    setMessage("");
    setConfirming(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setBoard(result.board);
      setMessage(done);
    });
  }

  function copy() {
    const finish = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shortUrl).then(finish).catch(() => {});
    }
  }

  const remaining = boardRemaining(board?.expiresAt ?? null);
  const deadline = formatBoardDeadline(board?.expiresAt ?? null);

  return (
    <section className="lab-panel p-5 space-y-4" aria-labelledby="outline-board-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="outline-board-heading" className="text-base font-bold text-gray-800">👀 친구 개요 모음</h2>
          <p className="text-sm text-gray-500 mt-1">
            학생들이 <strong>제출한</strong> 개요를 번호·이름과 함께 모아 보여 줘요. 친구들과 돌려 보며 토의할 때 쓰세요.
          </p>
          {/* 학생이 들어오는 길 세 가지(2026-10-11 선생님 요청: 학생 대시보드에서도 볼 수 있다는 안내가 없었다) */}
          <ul className="mt-2 space-y-1 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">
            <li>📋 <strong>학생 대시보드</strong> — 아지트 <strong>글쓰기 연구소</strong> 목록과 개요 쓰는 화면·완성 화면에 <strong>친구 개요 보기</strong>가 생겨요(종료한 활동도 공유 기간 동안 보여요).</li>
            <li>🔗 <strong>주소</strong> — 샘링크 짧은 주소를 칠판에 적어 주면 아무 기기에서나 열 수 있어요.</li>
            <li>📱 <strong>QR 코드</strong> — QR을 크게 띄우면 태블릿으로 찍어 바로 들어와요.</li>
          </ul>
        </div>
        {isOpen && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">공유 중</span>}
      </div>

      {!board && (
        <div className="space-y-2">
          <p className="text-sm text-amber-700">켜면 샘링크 짧은 주소(1주)가 만들어져요. 주소를 아는 사람은 누구나 볼 수 있어요.</p>
          <button type="button" className="lab-button lab-button--primary" disabled={pending}
            onClick={() => run(() => openOutlineBoard(roomId), "친구 개요 모음을 열었어요. 학생들에게 주소나 QR을 보여 주세요.")}>
            {pending ? "만드는 중…" : "친구 개요 모음 켜기"}
          </button>
        </div>
      )}

      {board && !isOpen && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            {board.state === "expired"
              ? "기간이 끝나 닫혔어요. 새 주소를 만들면 다시 열 수 있어요."
              : "샘링크에서 지웠거나 멈춘 주소예요. 새 주소를 만들면 다시 열 수 있어요."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="lab-button lab-button--primary" disabled={pending}
              onClick={() => run(() => openOutlineBoard(roomId), "새 주소를 만들었어요.")}>새 주소 만들기</button>
            <button type="button" className="lab-button lab-button--quiet" disabled={pending}
              onClick={() => run(() => closeOutlineBoard(roomId), "친구 개요 모음을 껐어요.")}>공유 끄기</button>
          </div>
        </div>
      )}

      {board && isOpen && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {qrSmall && (
            <button type="button" onClick={() => setQrOpen(true)} title="크게 보기"
              className="shrink-0 self-center bg-white p-2 rounded-2xl border border-green-100 hover:border-green-400 hover:shadow-md transition-all">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSmall} alt="친구 개요 모음 QR 코드" className="w-32 h-32" />
            </button>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-wide text-green-800 break-all">
                {SAMLINK_DISPLAY_HOST}/{board.slug}
              </span>
              <button type="button" className="lab-button" onClick={copy}>{copied ? "✅ 복사됨" : "복사"}</button>
              <a className="lab-button" href={shortUrl} target="_blank" rel="noreferrer">페이지 열기 ↗</a>
            </div>
            {deadline && (
              <p className={`text-sm font-semibold ${remaining?.urgent ? "text-amber-700" : "text-gray-600"}`}>
                {deadline}까지 열려요{remaining ? ` · ${remaining.label}` : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="lab-button" disabled={pending}
                onClick={() => run(() => extendOutlineBoard(roomId), "1주 늘렸어요. 같은 주소를 계속 쓸 수 있어요.")}>1주 늘리기</button>
              <button type="button" className="lab-button" disabled={pending} onClick={() => setConfirming("renew")}>새 주소 만들기</button>
              <button type="button" className="lab-button lab-button--danger" disabled={pending} onClick={() => setConfirming("close")}>공유 끄기</button>
            </div>
            {confirming && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2" role="alert">
                <p className="text-sm text-amber-800">
                  {confirming === "renew"
                    ? "새 주소를 만들면 지금 주소는 바로 닫혀요. 학생들에게 새 주소를 다시 알려 주어야 해요."
                    : "끄면 지금 주소로는 더 이상 볼 수 없어요. 다시 켜면 새 주소가 만들어져요."}
                </p>
                <div className="flex gap-2">
                  <button type="button" className={`lab-button ${confirming === "close" ? "lab-button--danger" : "lab-button--primary"}`} disabled={pending}
                    onClick={() => confirming === "renew"
                      ? run(() => openOutlineBoard(roomId), "새 주소를 만들었어요. 옛 주소는 닫혔어요.")
                      : run(() => closeOutlineBoard(roomId), "친구 개요 모음을 껐어요.")}>
                    {confirming === "renew" ? "새 주소 만들기" : "끄기"}
                  </button>
                  <button type="button" className="lab-button lab-button--quiet" onClick={() => setConfirming(null)}>그만두기</button>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500">
              기간은 샘링크 <strong>내 링크</strong>에서도 바꿀 수 있어요.{" "}
              <a className="underline text-green-700" href={SAMLINK_MANAGE_URL} target="_blank" rel="noreferrer">샘링크에서 관리하기 ↗</a>
              {" "}(처음이면 아지트 계정으로 한 번 연결돼요)
            </p>
          </div>
        </div>
      )}

      {(message || error) && (
        <p className={`text-sm ${error ? "text-red-600" : "text-green-700"}`} aria-live="polite">{error || message}</p>
      )}

      {qrOpen && qrLarge && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-6" role="dialog" aria-modal="true" aria-label="친구 개요 모음 QR 크게 보기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrLarge} alt="친구 개요 모음 QR 코드" className="max-h-[70vh] w-auto max-w-full" />
          <p className="text-4xl sm:text-6xl font-black tracking-wide text-green-800 break-all text-center">{SAMLINK_DISPLAY_HOST}/{board?.slug}</p>
          <button type="button" className="lab-button" onClick={() => setQrOpen(false)}>✕ 닫기</button>
        </div>
      )}
    </section>
  );
}
