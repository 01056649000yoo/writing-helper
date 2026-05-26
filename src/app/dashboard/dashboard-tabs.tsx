"use client";

import { useState } from "react";
import Link from "next/link";

interface ClassItem {
  id: string;
  name: string;
  grade_level: string;
  created_at: string;
}

interface DashboardTabsProps {
  classes: ClassItem[];
}

export function DashboardTabs({ classes }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"classes" | "manual">("classes");

  return (
    <div className="space-y-6">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("classes")}
          className={`flex items-center gap-2 px-6 py-3.5 font-semibold text-lg border-b-2 transition-all cursor-pointer ${
            activeTab === "classes"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🏫 내 학급 목록
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex items-center gap-2 px-6 py-3.5 font-semibold text-lg border-b-2 transition-all cursor-pointer ${
            activeTab === "manual"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📖 활동별 설명서 (글쓰기 꾸러미)
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "classes" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">내 학급 목록</h2>
            <Link
              href="/dashboard/class/new"
              className="px-6 py-3 rounded-xl font-semibold text-base bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm"
            >
              + 새 학급 만들기
            </Link>
          </div>

          {classes.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-100">
              <div className="text-6xl mb-5">🏫</div>
              <p className="text-xl text-gray-500 font-medium">아직 만든 학급이 없습니다.</p>
              <p className="text-base text-gray-400 mt-2">
                학급을 만들고 학생 명단을 등록하면 바로 활동을 시작할 수 있어요.
              </p>
              <Link
                href="/dashboard/class/new"
                className="inline-block mt-6 px-8 py-3.5 bg-indigo-500 text-white rounded-xl text-base font-semibold hover:bg-indigo-600 transition-colors"
              >
                첫 학급 만들기
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/dashboard/class/${cls.id}`}
                  className="bg-white rounded-2xl p-7 shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-indigo-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
                      🏫
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium">
                      {cls.grade_level}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-xl group-hover:text-indigo-600 transition-colors">
                    {cls.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-3">
                    {new Date(cls.created_at).toLocaleDateString("ko-KR")} 개설
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* 가이드 소개 헤더 */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-md">
            <h2 className="text-2xl font-bold">✏️ 아지트 글쓰기 활동 꾸러미 완전 정복</h2>
            <p className="text-base text-indigo-100 mt-2 leading-relaxed max-w-3xl">
              아지트 글쓰기 연구소의 대표 기능인 <strong>'글쓰기 활동 꾸러미'</strong>의 설정 및 4가지 핵심 활동 사용 가이드입니다. 
              API 키와 질문 카드를 완벽하게 준비한 뒤, 순차적이고 체계적인 학생 글쓰기 활동을 운영해 보세요.
            </p>
            <div className="mt-4 flex gap-3">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                준비 단계: API 및 질문 카드 설정
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">
                활동 구성: 4종 글쓰기 연계 활동
              </span>
            </div>
          </div>

          {/* 설정 가이드 섹션 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* API 키 설정 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔑</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">1. GPT API 키 설정 방법</h3>
                  <p className="text-sm text-gray-400">AI 자동 글 개요 및 초고 생성을 위한 필수 준비</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 1</span>
                  <span>대시보드 우측 상단의 <strong className="text-indigo-600 font-semibold">🔑 API 키 설정</strong> 버튼을 누르거나 <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs border border-gray-200">/dashboard/api-key</code> 페이지로 이동합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 2</span>
                  <span>OpenAI 공식 홈페이지(platform.openai.com)에서 발급받은 <strong className="font-semibold text-gray-700">sk-...</strong> 형태의 API Key를 입력창에 넣고 등록합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 3</span>
                  <span>정상적으로 등록되면 대시보드 표시가 <span className="text-green-600 font-bold">✅ API 키 설정됨</span>으로 바뀌며, 글 개요 짜기 시 GPT 프롬프트가 가동됩니다.</span>
                </li>
              </ul>
              <div className="mt-5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
                <span className="text-base shrink-0">💡</span>
                <p className="text-xs text-amber-800 leading-normal">
                  교사 개인이 소유한 API 키를 데이터베이스 전용 보관소(Vault)에 안전하게 암호화하여 저장하므로, 학생이나 외부로 유출될 염려가 전혀 없습니다.
                </p>
              </div>
            </div>

            {/* 질문 카드 설정 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🃏</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">2. 질문 카드 설정 방법</h3>
                  <p className="text-sm text-gray-400">학생들의 글감 구성을 돕는 카드 리스트 조립</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 1</span>
                  <span>대시보드 우측 상단 <strong className="text-indigo-600 font-semibold">🃏 질문 카드 설정</strong> 버튼을 눌러 관리 페이지로 진입합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 2</span>
                  <span>기본 제공되는 카드 묶음 외에, 수업에 특화된 <strong className="font-semibold text-gray-700">새 질문 카드 묶음</strong>이나 <strong className="font-semibold text-gray-700">학생 역할(Role)</strong> 카드를 직접 제작할 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 3</span>
                  <span>질문 카드 묶음에 들어갈 개별 세부 문항(프롬프트)들을 한 줄씩 추가하여 구성해 둡니다. 이는 이후 <strong>'질문 만들기'</strong> 활동의 템플릿 카드가 됩니다.</span>
                </li>
              </ul>
              <div className="mt-5 p-3.5 bg-green-50 border border-green-100 rounded-xl flex gap-2">
                <span className="text-base shrink-0">👍</span>
                <p className="text-xs text-green-800 leading-normal">
                  다양한 질문 카드 세트를 풍부하게 등록해 두면, 학생들이 글쓰기 아이디어를 발굴하고 예리한 질문을 생성하는 데 강력한 비계(Scaffolding) 역할을 해 줍니다.
                </p>
              </div>
            </div>
          </div>

          {/* 4가지 글쓰기 꾸러미 핵심 활동 설명 */}
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>🚀</span> 글쓰기 활동 꾸러미 4대 모듈 안내
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* 글 개요 짜기 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl font-bold">1</span>
                  <h4 className="text-lg font-bold text-gray-800">글 개요 짜기 (Outline Builder)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  학생들이 각자의 수준(저학년·중학년·고학년 / low·mid·high)에 맞는 세부 문항에 카드 선택 혹은 단답 입력을 수행하면, GPT가 답변을 취합하여 **개별 학생 맞춤형 개요 및 문단별 초고**를 작성합니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">글 종류, 대상 학년, 개요 분량, 초고 생성 활성화</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-indigo-600 font-semibold">AI 자동 대기열 병렬 처리 & 맞춤형 글 다듬기</span>
                  </div>
                </div>
              </div>

              {/* 질문 만들기 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-purple-50 text-purple-600 rounded-xl font-bold">2</span>
                  <h4 className="text-lg font-bold text-gray-800">질문 만들기 (Question Generator)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  주제 글쓰기에 앞서 학생들이 마음에 드는 질문 카드(비계)를 한 개 이상 골라 오늘 주제에 알맞게 단어를 바꾸는 **질문 리믹스(Remix)** 및 **직접 발문** 활동을 통해 질문 생성 능력을 증진시킵니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">선택 질문 카드 묶음 활성화, 최대 카드 수, 이유 작성 여부</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-purple-600 font-semibold">비계(Scaffolding) 카드 선택에 기반한 메타인지 향상</span>
                  </div>
                </div>
              </div>

              {/* 좋은 질문 고르기 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl font-bold">3</span>
                  <h4 className="text-lg font-bold text-gray-800">좋은 질문 고르기 (Question Voting)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  '질문 만들기' 활동에서 동료 학생들이 제출한 익명화된 전체 질문 풀(Pool)에서, 교사가 설정한 평가 기준에 부합하는 질문을 골라내고 선택 이유를 작성함으로써 **평가 및 분석적 사고**를 경험합니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">소스 질문 활동방 연동, 질문 평가 조건(한 줄씩), 최대 선택 개수</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-emerald-600 font-semibold">익명 친구 질문 풀 평가를 통한 동료 검토 및 리터러시 강화</span>
                  </div>
                </div>
              </div>

              {/* 한줄모아 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-rose-50 text-rose-600 rounded-xl font-bold">4</span>
                  <h4 className="text-lg font-bold text-gray-800">한줄모아 (One Line Share)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  교과 차시 정리 및 피드백용으로 활용 가능한 실시간 보드입니다. 교사가 정한 필수 **핵심 단어(Keywords)**를 한 문장 속에 자연스럽게 구성하여 짧은 소감을 올리고, 실시간으로 하트를 주며 상호 공감합니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">한 줄 질문 제목 및 안내, 콤마 분리 핵심단어, 1인당 하트 제한 수</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-rose-600 font-semibold">필수 키워드 자동 매칭 문장 검증 & 실시간 하트 리액션</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
