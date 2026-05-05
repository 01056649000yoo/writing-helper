"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center py-16 px-6">
      {/* 로그인 카드 */}
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-lg mb-20">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-3xl font-bold text-gray-800">아지트 글쓰기 연구소</h1>
          <p className="text-base text-gray-500 mt-2">교사 로그인</p>
        </div>
        <form action={formAction} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">이메일</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="teacher@school.kr" />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">비밀번호</label>
            <input name="password" type="password" required autoComplete="current-password"
              className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="비밀번호 입력" />
          </div>
          {state?.error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full py-4 bg-indigo-500 text-white rounded-xl font-semibold text-base hover:bg-indigo-600 disabled:opacity-50 transition-colors">
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="text-center text-base text-gray-500 mt-7">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-indigo-500 font-medium hover:underline">회원가입</Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-4">
          v2.0.0
        </p>
      </div>

      {/* 서비스 소개 섹션 */}
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-800">아지트 글쓰기 연구소와 함께라면</h2>
          <p className="text-lg text-gray-500 mt-3">아이들의 생각이 쑥쑥 자라나는 4가지 핵심 활동</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeatureCard
            emoji="🔍"
            title="글감 찾기"
            description="AI와 대화하며 나만의 특별하고 구체적인 글쓰기 주제를 발견해요."
            color="bg-blue-50 text-blue-600"
          />
          <FeatureCard
            emoji="✍️"
            title="질문 만들기"
            description="글의 뼈대를 세우는 핵심 질문들을 AI가 제안해 글쓰기를 도와줍니다."
            color="bg-indigo-50 text-indigo-600"
          />
          <FeatureCard
            emoji="✅"
            title="질문 고르기"
            description="친구들이 만든 좋은 질문을 함께 읽고 투표하며 생각을 넓혀요."
            color="bg-emerald-50 text-emerald-600"
          />
          <FeatureCard
            emoji="📱"
            title="한줄 모아"
            description="우리 반 친구들의 멋진 생각과 답변을 실시간으로 한곳에서 모아봐요."
            color="bg-purple-50 text-purple-600"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ emoji, title, description, color }: { emoji: string; title: string; description: string; color: string }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-white/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
      <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-3xl mb-5 shadow-inner`}>
        {emoji}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
      <p className="text-base text-gray-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
