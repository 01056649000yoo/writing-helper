import type { Metadata } from "next";

// 옛 개요 QR 공유 페이지는 닫았다(2026-10-10). 로그인 없이 학생 한 명의 개요를 보여 주던 주소라,
// 통합 연구소에서 QR 단추를 숨긴 뒤에도 주소만 알면 열렸다. 친구들과 함께 보기는 `친구 개요 모음`(/board)으로.
export const metadata: Metadata = {
  title: "닫힌 주소 | 글쓰기 연구소",
  robots: { index: false, follow: false },
};

export default function ClosedSharePage() {
  return (
    <main className="outline-board outline-board--notice">
      <section className="outline-board__empty lab-panel">
        <p className="text-5xl" aria-hidden="true">🔒</p>
        <h1 className="text-xl font-bold text-[var(--ui-ink)]">더 이상 쓰지 않는 주소예요</h1>
        <p className="text-[var(--ui-ink-muted)]">
          친구들의 개요는 선생님이 알려 주는 <strong>친구 개요 모음</strong> 주소에서 함께 볼 수 있어요.
        </p>
      </section>
    </main>
  );
}
