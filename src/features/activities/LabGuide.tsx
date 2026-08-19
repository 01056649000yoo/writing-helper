import type { ReactNode } from "react";
import { ACTIVITY_GUIDES, LAB_GUIDE_FLOW, LAB_GUIDE_NOTES } from "./guide";

/** `**굵게**` 와 `` `코드` `` 만 알아보는 아주 작은 표시기. 안내 문구를 HTML 로 넣지 않으려고 둔다. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="text-gray-800">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-gray-100 px-1 text-gray-700">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

/**
 * 글쓰기 연구소 사용 도움말 화면.
 *
 * 내용은 `guide.ts` 한 곳에 있고 이 파일은 그리기만 한다.
 * 대시보드 안내 탭과 활동 만들기 화면의 `도움말` 창이 **같은 것을 본다**.
 */
export function LabGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-5" : "space-y-8"}>
      <div className="lab-panel border-blue-100 bg-blue-50 p-6">
        <h2 className="text-xl font-bold text-slate-800">✏️ 글쓰기 연구소는 이렇게 씁니다</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          글을 쓰기 <strong>전에</strong> 생각을 여는 네 가지 활동입니다. 학생이 만든 결과는 아지트 글쓰기로 이어져,
          같은 자료를 보고 글을 씁니다.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>🧭</span> 활동이 도는 순서
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAB_GUIDE_FLOW.map((step) => (
            <div key={step.title} className="lab-panel p-4">
              <p className="text-sm font-bold text-blue-700">{step.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>🚀</span> 네 가지 활동은 무엇에 쓰나
        </h3>
        <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
          {ACTIVITY_GUIDES.map((guide) => (
            <div key={guide.id} className="lab-panel p-5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{guide.emoji}</span>
                <h4 className="text-base font-bold text-gray-800">{guide.name}</h4>
              </div>
              <p className="mt-2.5 text-sm font-semibold leading-relaxed text-gray-700">{guide.purpose}</p>

              <div className="mt-4 space-y-3 text-xs leading-relaxed">
                <div>
                  <p className="font-bold text-gray-500">이럴 때 씁니다</p>
                  <ul className="mt-1 space-y-1 text-gray-600">
                    {guide.whenToUse.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <span className="text-gray-300">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="font-bold text-gray-500">학생이 하는 일</p>
                  <ol className="mt-1 space-y-1 text-gray-600">
                    {guide.studentFlow.map((item, index) => (
                      <li key={item} className="flex gap-1.5">
                        <span className="shrink-0 font-bold text-blue-500">{index + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-bold text-emerald-700">결과는 이렇게 이어집니다</p>
                  <p className="mt-1 text-emerald-900">{guide.resultUse}</p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="font-bold text-gray-500">선생님이 정하는 것</p>
                  <p className="mt-1 text-gray-700">{guide.teacherSetup}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <span>⚠️</span> 미리 알아 두면 좋은 것
        </h3>
        <ul className="lab-panel space-y-2.5 p-5 text-sm leading-relaxed text-gray-600">
          {LAB_GUIDE_NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="shrink-0 text-amber-500">•</span>
              <span>{renderInline(note)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
