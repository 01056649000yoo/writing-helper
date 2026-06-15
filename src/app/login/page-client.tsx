"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth-actions";
import { BUILD_LABEL } from "@/lib/build-version";

const loginInputClass =
  // 기본 스타일
  "w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-base text-gray-900 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 " +
  "transition-all placeholder:text-gray-400 " +
  // 브라우저 자동완성 시 배경이 노란색/흰색으로 바뀌는 것을 회색(bg-gray-50)으로 마스킹
  "[&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_rgb(249_250_251)] " +
  "[&:-webkit-autofill]:[-webkit-text-fill-color:#111827] " +
  "[&:-webkit-autofill:focus]:[box-shadow:inset_0_0_0_1000px_rgb(255_255_255)] " +
  "[&:-webkit-autofill]:caret-gray-900 " +
  "[&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]";

export default function LoginPageClient() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center p-4 md:p-10">
      <div className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-bold text-slate-600 shadow-lg backdrop-blur">
        {BUILD_LABEL}
      </div>

      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col md:flex-row min-h-[600px] md:min-h-[750px]">
        <div className="w-full md:w-5/12 bg-indigo-600 p-10 md:p-16 text-white flex flex-col relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-blue-400 rounded-full blur-3xl opacity-30" />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3 mb-8">
              <div className="text-5xl md:text-6xl">✏️</div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/95 text-amber-950 text-xs font-bold tracking-wider px-3 py-1.5 shadow-md ring-1 ring-amber-300/50">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700 animate-pulse" />
                BETA
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
              아지트
              <br />
              글쓰기 연구소
            </h1>
            <p className="text-indigo-100 text-lg md:text-xl font-medium opacity-90 leading-relaxed">
              아이들의 생각이 쑥쑥 자라나는
              <br />
              지능형 글쓰기 도우미 플랫폼
            </p>
          </div>

          <div className="mt-12 md:mt-auto relative z-10 space-y-8">
            <MiniFeatureCard emoji="🔍" title="글의 뼈대 만들기" desc="AI 질문을 활용하여 탄탄한 개요 작성" />
            <MiniFeatureCard emoji="✍️" title="질문 카드 만들기" desc="마음에 드는 카드를 골라 나만의 질문 생성" />
            <MiniFeatureCard emoji="✅" title="질문 고르기" desc="친구들의 좋은 질문에 투표하기" />
            <MiniFeatureCard emoji="📱" title="한줄 모아" desc="실시간 생각 공유와 모아보기" />

            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-xs font-semibold text-indigo-200 tracking-wider uppercase">추가 활동</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <CompactFeatureCard
                  emoji="📜"
                  title="글쓰기 문해력 활동"
                  desc="한자 활용 문장 만들기처럼 단어의 뜻을 깊이 살피고 문장으로 확장하는 활동"
                />
                <CompactFeatureCard
                  emoji="📚"
                  title="과목별 글쓰기 활동"
                  desc="과학, 사회, 도덕 등 교과 수업과 연결해 설명하고 추론하는 글쓰기 활동"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-7/12 p-10 md:p-20 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-3xl font-bold text-gray-900">안녕하세요!</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold tracking-wider px-2 py-0.5">
                  BETA
                </span>
              </div>
              <p className="text-lg text-gray-500">교사 계정으로 로그인하여 시작하세요.</p>
            </div>

            <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
              <span className="text-amber-500 text-base shrink-0 mt-0.5">🧪</span>
              <p className="text-xs leading-relaxed text-amber-800">
                <strong>지금은 베타 버전</strong>이에요. 기능을 만들어가며 함께 다듬는 중이라 일부 화면이 바뀌거나 점검 중일 수 있어요. 불편한 점은 언제든 알려주세요!
              </p>
            </div>

            <form action={formAction} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 ml-1">이메일</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={loginInputClass}
                  placeholder="teacher@school.kr"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-sm font-semibold text-gray-700">비밀번호</label>
                  <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                    비밀번호 찾기
                  </Link>
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={loginInputClass}
                  placeholder="비밀번호 입력"
                />
              </div>

              {state?.error && (
                <div className="flex items-center gap-3 text-red-500 text-sm bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-2">
                  <span className="text-lg">⚠️</span>
                  {state.error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-indigo-200"
              >
                {pending ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    로그인 중...
                  </div>
                ) : (
                  "로그인"
                )}
              </button>
            </form>

            <div className="mt-10 pt-10 border-t border-gray-50 text-center">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 flex items-start gap-3 text-left">
                <span className="text-amber-500 text-lg">💡</span>
                <p className="text-sm text-amber-700 leading-relaxed font-medium">
                  <strong>끄적끄적아지트</strong>와는 별개의 시스템입니다.
                  <br />
                  이용을 위해 <strong>새로운 회원가입</strong>이 필요합니다.
                </p>
              </div>
              <p className="text-gray-500">
                아직 계정이 없으신가요?{" "}
                <Link href="/signup" className="text-indigo-600 font-bold hover:underline underline-offset-4 ml-1">
                  회원가입
                </Link>
              </p>
            </div>

            <a
              href="https://xn--vz0ba242ncqcba79xhwx.site"
              className="mt-6 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-left transition-colors hover:border-sky-200 hover:bg-sky-100"
            >
              <span>
                <span className="block text-sm font-bold text-sky-900">끄적끄적아지트로 이동</span>
                <span className="mt-1 block text-xs text-sky-700">글쓰기 활동하러 이동하기</span>
              </span>
              <span className="text-lg font-semibold text-sky-700">→</span>
            </a>

            <p className="text-center text-xs text-gray-300 mt-8 font-medium">
              v2.1.0 • AZIT WRITING LAB • {BUILD_LABEL}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniFeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-5 group cursor-default">
      <div className="w-12 h-12 shrink-0 bg-white/10 rounded-xl flex items-center justify-center text-2xl group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
        {emoji}
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-indigo-100 opacity-80 leading-snug">{desc}</p>
      </div>
    </div>
  );
}

function CompactFeatureCard({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{emoji}</span>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-100/85">{desc}</p>
        </div>
      </div>
    </div>
  );
}
