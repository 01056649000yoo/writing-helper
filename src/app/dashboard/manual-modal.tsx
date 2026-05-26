"use client";

import { useState } from "react";

const STEPS = [
  {
    number: 1,
    emoji: "🔑",
    title: "API 키 설정법",
    color: "amber",
    items: [
      "대시보드 우측 상단 'API 키 설정 필요' 뱃지 또는 'API 키 설정' 메뉴를 누릅니다.",
      "OpenAI Platform(platform.openai.com)에서 발급받은 API 키(sk-...로 시작)를 입력창에 등록합니다.",
      "보관소(Vault)에 안전하게 암호화되어 저장되며, 등록 즉시 AI 기능(개요 짜기 등)이 활성화됩니다.",
    ],
  },
  {
    number: 2,
    emoji: "🃏",
    title: "질문 카드 설정법",
    color: "indigo",
    items: [
      "대시보드 우측 상단 '🃏 질문 카드 설정' 메뉴를 클릭해 설정 페이지로 진입합니다.",
      "학생들이 '질문 만들기' 활동에서 사용할 수 있는 질문 카드 묶음과 역할군(Role)을 자유롭게 조립합니다.",
      "각 카드 세트 내부에 다채로운 발문 힌트(프롬프트)를 등록하여 학생들의 글쓰기 비계(Scaffolding)를 준비합니다.",
    ],
  },
  {
    number: 3,
    emoji: "🏫",
    title: "학급 및 학생 등록",
    color: "green",
    items: [
      "대시보드 '내 학급 목록' 탭에서 '+ 새 학급 만들기' 버튼을 클릭합니다.",
      "학급 이름(예: 5학년 3반)과 학년 수준(저·중·고학년)을 선택합니다.",
      "학생 명단 칸에 이름을 한 줄씩 입력하여 저장하며, 이 명단은 학생 로그인 대조군으로 활용됩니다.",
    ],
  },
  {
    number: 4,
    emoji: "✏️",
    title: "글쓰기 활동 꾸러미 시작",
    color: "purple",
    items: [
      "학급 페이지에서 '+ 새 활동 시작하기'를 눌러 '글쓰기 활동 꾸러미' 4개 모듈 중 개설할 활동을 선택합니다.",
      "개요 짜기, 질문 만들기, 좋은 질문 고르기, 한줄모아 중 원하는 모듈을 골라 규칙을 설정하고 시작합니다.",
      "생성된 QR 코드 또는 단축 접속 코드를 학생들과 공유하여 참여시키고, 실시간으로 현황을 모니터링합니다.",
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
