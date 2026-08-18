/**
 * 활동 내용 화면이 함께 쓰는 조각들.
 *
 * 활동마다 보여 줄 것은 다르지만 **생김새는 같아야** 교사가 활동을 오갈 때 헤매지 않는다.
 * 새 활동을 만들 때도 이 조각들로 쌓으면 자동으로 같은 결이 된다.
 */

export function DetailSection({ title, hint, children }: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** 번호가 붙은 항목 목록. 개요 항목·질문 후보처럼 순서가 뜻을 갖는 것에 쓴다. */
export function NumberedList({ items }: { items: Array<{ key: string; text: string; note?: string }> }) {
  if (items.length === 0) return <EmptyLine>아직 없습니다.</EmptyLine>;
  return (
    <ol className="space-y-1.5">
      {items.map((item, index) => (
        <li key={item.key} className="flex gap-2 text-sm text-gray-700">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[0.68rem] font-bold text-gray-500">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 leading-relaxed">
            {item.text}
            {item.note && <span className="ml-1.5 text-xs text-gray-400">{item.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 낱말·기준처럼 짧은 것들을 알약으로 늘어놓는다. */
export function ChipList({ items, tone = "gray" }: { items: string[]; tone?: "gray" | "indigo" | "amber" }) {
  if (items.length === 0) return <EmptyLine>없음</EmptyLine>;
  const toneClass = tone === "indigo"
    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
    : tone === "amber"
      ? "bg-amber-50 text-amber-800 border-amber-100"
      : "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

/** `이름 — 값` 한 줄들. 문항 수·합격선처럼 숫자 설정에 쓴다. */
export function FactRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <dl className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="shrink-0 text-gray-500">{row.label}</dt>
          <dd className="min-w-0 text-right font-semibold text-gray-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400">{children}</p>;
}
