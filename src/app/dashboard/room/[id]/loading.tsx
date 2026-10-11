// 이동 중 표시(2026-10-11): 서버가 새 화면을 만드는 동안 옛 화면에 머물러 느리게 느껴지던 것을 바로 알린다.
export default function Loading() {
  return (
    <main className="lab-page" aria-busy="true">
      <div className="lab-page__content flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ui-primary-border)] border-t-[var(--ui-primary)]" aria-hidden="true" />
        <p className="text-base font-semibold text-[var(--ui-ink-muted)]">화면을 여는 중이에요…</p>
      </div>
    </main>
  );
}
