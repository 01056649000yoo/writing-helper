"use client";

import { useState } from "react";

const STEPS = [
  {
    number: 1,
    emoji: "🏫",
    title: "학급 만들기",
    color: "indigo",
    items: [
      "대시보드에서 '+ 새 학급 만들기' 버튼을 누릅니다.",
      "학급 이름(예: 4학년 2반)과 학년 수준(저·중·고학년)을 선택합니다.",
      "학생 명단 칸에 이름을 한 줄씩 입력합니다. Enter로 다음 칸 이동, 이름을 복사해서 붙여넣기도 됩니다.",
      "'학급 만들기' 버튼을 눌러 저장합니다.",
    ],
  },
  {
    number: 2,
    emoji: "🔑",
    title: "API 키 입력하기",
    color: "amber",
    items: [
      "대시보드 우측 상단 'API 키 설정' 버튼을 클릭합니다.",
      "또는 '/dashboard/api-key' 페이지로 이동합니다.",
      "OpenAI 홈페이지(platform.openai.com)에서 API 키를 발급받습니다.",
      "발급받은 키(sk-로 시작)를 입력 후 저장합니다.",
      "키가 정상 등록되면 상단 버튼이 '✅ API 키 설정됨'으로 바뀝니다.",
    ],
  },
  {
    number: 3,
    emoji: "✏️",
    title: "활동 시작하기",
    color: "green",
    items: [
      "학급을 클릭해 학급 상세 페이지로 이동합니다.",
      "'+ 새 활동 시작하기' 버튼을 누릅니다.",
      "글쓰기 종류(일기, 편지, 독서감상문 등)와 제목·주제를 입력합니다.",
      "활동 세션이 열리면 QR 코드와 참여 링크가 생성됩니다.",
      "학생들이 QR을 스캔하거나 링크로 접속해 글을 작성합니다.",
    ],
  },
  {
    number: 4,
    emoji: "📊",
    title: "결과 활용하기",
    color: "purple",
    items: [
      "활동 페이지에서 학생별 제출 현황을 실시간으로 확인합니다.",
      "학생 이름을 클릭하면 작성한 글을 바로 볼 수 있습니다.",
      "AI 피드백 버튼으로 GPT가 생성한 맞춤형 글쓰기 피드백을 확인합니다.",
      "활동이 끝나면 '활동 종료' 버튼으로 세션을 닫고, 결과는 기록으로 남습니다.",
      "종료된 활동 세션은 학급 페이지 하단에서 다시 열람할 수 있습니다.",
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; badge: string; border: string; dot: string }> = {
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-400",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
    border: "border-green-200",
    dot: "bg-green-400",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-400",
  },
};

export function ManualModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-base text-gray-500 hover:text-indigo-600 px-4 py-2.5 hover:underline transition-colors"
      >
        사용 메뉴얼
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 px-8 pt-7 pb-5 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">📖 사용 메뉴얼</h2>
                <p className="text-base text-gray-500 mt-1">아지트 글쓰기 연구소 사용법</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4 mt-0.5"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="px-8 py-6 space-y-5">
              {STEPS.map((step) => {
                const c = colorMap[step.color];
                return (
                  <div key={step.number} className={`rounded-2xl border ${c.border} ${c.bg} p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${c.badge}`}>
                        STEP {step.number}
                      </span>
                      <span className="text-xl">{step.emoji}</span>
                      <h3 className={`text-lg font-bold ${c.text}`}>{step.title}</h3>
                    </div>
                    <ol className="space-y-2">
                      {step.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                          <span className="text-base text-gray-700 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}

              <p className="text-center text-sm text-gray-400 pb-2">
                문의 사항은 담당 선생님께 연락해주세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
