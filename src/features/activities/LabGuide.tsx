"use client";

import { useState, type ReactNode } from "react";
import { ACTIVITY_GUIDES, LAB_GUIDE_FLOW, LAB_GUIDE_NOTES } from "./guide";

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

/**
 * 글쓰기 연구소 사용 도움말.
 *
 * 내용은 `guide.ts` 한 곳에 있고 이 파일은 그리기만 한다.
 * 상단 메뉴 `도움말`과 활동 만들기 화면의 `❓ 활동 도움말` 창이 **같은 것을 본다**.
 *
 * 네 활동을 한 줄로 늘어놓으니 글자가 작아 눈에 들어오지 않았다(2026-08-20 사용자 지적).
 * **한 번에 하나만** 크게 보여 주고, 활동을 고르는 탭을 위에 둔다.
 * 그리고 `결과를 어떻게 쓰는가`를 가장 크게 둔다 — 활동을 왜 하는지가 거기 있다.
 */
export function LabGuide({ compact = false }: { compact?: boolean }) {
  const [activeId, setActiveId] = useState(ACTIVITY_GUIDES[0]?.id);
  const active = ACTIVITY_GUIDES.find((guide) => guide.id === activeId) ?? ACTIVITY_GUIDES[0];

  return (
    <div className={`break-keep ${compact ? "space-y-5" : "space-y-8"}`}>
      <div className="lab-panel border-blue-100 bg-blue-50 p-6">
        <h2 className="text-xl font-bold text-slate-800">✏️ 글쓰기 연구소는 이렇게 씁니다</h2>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-600">
          글을 쓰기 <strong>전에</strong> 생각을 여는 네 가지 활동입니다. 학생이 만든 결과는 아지트 글쓰기로 이어져,
          같은 자료를 보고 글을 씁니다.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-500">모든 활동에 공통</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span>🧭</span> ① 연구소는 이렇게 돌아갑니다
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {LAB_GUIDE_FLOW.map((step) => (
            <div key={step.title} className="lab-panel p-4">
              <p className="text-sm font-bold text-blue-700">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{renderInline(step.body)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-500">활동마다 다릅니다 — 눌러서 하나씩 보세요</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span>🚀</span> ② 네 활동은 무엇에 쓰나
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
            <p className="mt-2 text-base leading-relaxed text-emerald-950">{renderInline(active.resultUse)}</p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-gray-500">이럴 때 씁니다</p>
              <ul className="mt-2 space-y-1.5 text-base leading-relaxed text-gray-700">
                {active.whenToUse.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gray-300">·</span>
                    <span>{renderInline(item)}</span>
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
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-gray-50 p-5">
            <p className="text-sm font-bold text-gray-500">선생님이 정하는 것</p>
            <p className="mt-2 text-base leading-relaxed text-gray-700">{renderInline(active.teacherSetup)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-600">네 활동 모두에 해당합니다</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-800">
            <span>⚠️</span> ③ 꼭 알아 둘 것
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {LAB_GUIDE_NOTES.map((note) => (
            <div key={note.title} className="lab-panel border-amber-100 bg-amber-50/40 p-5">
              <p className="flex items-center gap-2 text-base font-bold text-amber-900">
                <span aria-hidden="true">{note.icon}</span>
                {note.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-950/80">{renderInline(note.body)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
