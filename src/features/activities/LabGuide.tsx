"use client";

import { useState, type ReactNode } from "react";
import { ACTIVITY_GUIDES, LAB_GUIDE_FLOW, LAB_GUIDE_NOTES, LAB_GUIDE_UPDATED } from "./guide";
import { splitGuideLead } from "@/lib/guide-fold";

/** `**굵게**` 와 `` `코드` `` 만 알아보는 아주 작은 표시기. 안내 문구를 HTML 로 넣지 않으려고 둔다. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      // 낱말 가운데서 잘리면 조각나 보인다 — 칩 하나는 통째로 넘긴다.
      return <code key={index} className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[0.95em] text-gray-800">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

/** 긴 항목은 첫 문장만 보이고 `더 보기` 로 나머지를 연다. */
function FoldText({ text }: { text: string }) {
  const { lead, rest } = splitGuideLead(text);
  const [open, setOpen] = useState(false);
  if (!rest) return <>{renderInline(text)}</>;
  return (
    <>
      {renderInline(lead)}
      {open && <> {renderInline(rest)}</>}{" "}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
      >
        {open ? "접기" : "더 보기"}
      </button>
    </>
  );
}

/**
 * 글쓰기 연구소 사용 도움말.
 *
 * 내용은 `guide.ts` 한 곳에 있고 이 파일은 그리기만 한다.
 * 상단 메뉴 `도움말`과 활동 만들기 화면의 `❓ 활동 도움말` 창이 **같은 것을 본다**.
 *
 * 네 활동을 한 줄로 늘어놓으니 글자가 작아 눈에 들어오지 않았다(2026-08-20 사용자 지적).
 * **한 번에 하나만** 크게 보여 주고, 활동을 고르는 탭을 위에 둔다.
 * 그리고 `결과를 어떻게 쓰는가`를 가장 크게 둔다 — 활동을 왜 하는지가 거기 있다.
 *
 * 넓은 화면(2026-10-20)은 **두 열**이다. 왼쪽은 활동과 상관없이 늘 같은 것(연구소 흐름·꼭 알아 둘 것),
 * 오른쪽은 고른 활동의 설명이다. 활동을 바꿔도 왼쪽이 그대로라 좌우가 비지 않고, 창 안(`compact`)과
 * 좁은 화면은 한 열로 쌓는다.
 */
export function LabGuide({ compact = false }: { compact?: boolean }) {
  const [activeId, setActiveId] = useState(ACTIVITY_GUIDES[0]?.id);
  const active = ACTIVITY_GUIDES.find((guide) => guide.id === activeId) ?? ACTIVITY_GUIDES[0];

  const intro = (
    <div className="lab-panel border-blue-100 bg-blue-50 p-6">
      <h2 className="text-xl font-bold text-slate-800">✏️ 글쓰기 연구소는 이렇게 씁니다</h2>
      <p className="mt-2 text-base leading-relaxed text-slate-600">
        글을 쓰기 <strong>전에</strong> 생각을 여는 네 가지 활동입니다. 학생이 만든 결과는 아지트 글쓰기로 이어져,
        같은 자료를 보고 글을 씁니다.
      </p>
      <p className="mt-3 text-sm font-semibold text-slate-500">현재 기능 기준 · {LAB_GUIDE_UPDATED}</p>
    </div>
  );

  const flow = (
    <section className="space-y-3" aria-label="연구소가 돌아가는 순서">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-500">모든 활동에 공통</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>🧭</span> 연구소는 이렇게 돌아갑니다
        </h3>
      </div>
      <ol className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
        {LAB_GUIDE_FLOW.map((step) => (
          <li key={step.title} className="lab-panel p-4">
            <p className="text-sm font-bold text-blue-700">{step.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600"><FoldText text={step.body} /></p>
          </li>
        ))}
      </ol>
    </section>
  );

  const notes = (
    <section className="space-y-3" aria-label="꼭 알아 둘 것">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-600">네 활동 모두에 해당합니다</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>⚠️</span> 꼭 알아 둘 것
        </h3>
      </div>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
        {LAB_GUIDE_NOTES.map((note) => (
          <details key={note.title} className="lab-panel group border-amber-100 bg-amber-50/40 px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-amber-900">
              <span aria-hidden="true">{note.icon}</span>
              <span className="flex-1">{note.title}</span>
              <span aria-hidden="true" className="text-sm text-amber-700 transition-transform group-open:rotate-90">▶</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-amber-950/80">{renderInline(note.body)}</p>
          </details>
        ))}
      </div>
    </section>
  );

  const activities = (
    <section className="space-y-4" aria-label="활동별 설명">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-500">활동마다 다릅니다 — 눌러서 하나씩 보세요</p>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>🚀</span> 네 활동은 무엇에 쓰나
        </h3>
      </div>

      {/* 활동 고르기 — 한 번에 하나만 크게 본다. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="활동 고르기">
        {ACTIVITY_GUIDES.map((guide) => {
          const selected = guide.id === active.id;
          return (
            <button
              key={guide.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(guide.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 transition-all ${
                selected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="text-3xl">{guide.emoji}</span>
              <span className={`text-sm font-bold ${selected ? "text-blue-700" : "text-gray-700"}`}>
                {guide.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="lab-panel p-6" role="tabpanel">
        <p className="text-lg font-bold leading-relaxed text-gray-900">
          {active.emoji} {active.purpose}
        </p>

        {/* 결과가 어디로 가는지를 가장 크게 둔다 — 활동을 왜 하는지가 여기 있다. */}
        <div className="mt-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">결과는 이렇게 이어집니다</p>
          <p className="mt-2 text-base leading-relaxed text-emerald-950"><FoldText key={active.id} text={active.resultUse} /></p>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-gray-500">이럴 때 씁니다</p>
            <ul className="mt-2 space-y-1.5 text-base leading-relaxed text-gray-700">
              {active.whenToUse.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-gray-300">·</span>
                  <span><FoldText text={item} /></span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-500">학생이 하는 일</p>
            <ol className="mt-2 space-y-1.5 text-base leading-relaxed text-gray-700">
              {active.studentFlow.map((item, index) => (
                <li key={item} className="flex gap-2">
                  <span className="shrink-0 font-bold text-blue-500">{index + 1}</span>
                  <span><FoldText text={item} /></span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 선생님이 정하는 것·부가 기능은 길어서 접어 둔다 — 핵심(결과·학생이 하는 일)만 한 화면에 보이게. */}
        <details key={`${active.id}-setup`} className="group mt-5 rounded-2xl bg-gray-50 px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-gray-700">
            <span aria-hidden="true">⚙️</span>
            <span className="flex-1">선생님이 정하는 것 보기</span>
            <span aria-hidden="true" className="text-sm text-gray-500 transition-transform group-open:rotate-90">▶</span>
          </summary>
          <p className="mt-3 text-base leading-relaxed text-gray-700">{renderInline(active.teacherSetup)}</p>
        </details>

        {active.extras?.map((extra) => (
          <details key={`${active.id}-${extra.title}`} className="group mt-3 rounded-2xl border-2 border-blue-100 bg-blue-50/50 px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-blue-800">
              <span aria-hidden="true">{extra.icon}</span>
              <span className="flex-1">{extra.title}</span>
              <span aria-hidden="true" className="text-sm text-blue-600 transition-transform group-open:rotate-90">▶</span>
            </summary>
            <p className="mt-3 text-base leading-relaxed text-gray-700">{renderInline(extra.body)}</p>
          </details>
        ))}
      </div>
    </section>
  );

  if (compact) {
    return (
      <div className="break-keep space-y-5">
        {intro}
        {flow}
        {activities}
        {notes}
      </div>
    );
  }

  return (
    <div className="break-keep space-y-6">
      {intro}
      <div className="lab-guide-columns">
        <aside className="lab-guide-columns__side space-y-8">
          {flow}
          {notes}
        </aside>
        <div className="lab-guide-columns__main">{activities}</div>
      </div>
    </div>
  );
}
