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
  integratedRoster?: boolean;
}

const AGIT_HOME_URL = process.env.NEXT_PUBLIC_AGIT_APP_URL
  ?? "https://끄적끄적아지트.site";

export function DashboardTabs({ classes, integratedRoster = false }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"classes" | "manual">("classes");

  return (
    <div className="space-y-6">
      {/* 탭 헤더 */}
      <div className="flex overflow-x-auto border-b border-gray-200" aria-label="대시보드 보기">
        <button
          type="button"
          aria-pressed={activeTab === "classes"}
          onClick={() => setActiveTab("classes")}
          className={`flex min-h-11 shrink-0 items-center gap-2 px-5 py-3 font-semibold text-base border-b-2 transition-all ${
            activeTab === "classes"
              ? "border-blue-600 text-blue-600 bg-blue-50"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🏫 내 학급 목록
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "manual"}
          onClick={() => setActiveTab("manual")}
          className={`flex min-h-11 shrink-0 items-center gap-2 px-5 py-3 font-semibold text-base border-b-2 transition-all ${
            activeTab === "manual"
              ? "border-blue-600 text-blue-600 bg-blue-50"
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
            {integratedRoster ? (
              <a href={AGIT_HOME_URL} className="lab-button lab-button--quiet">
                아지트에서 학급 관리
              </a>
            ) : (
              <Link
                href="/dashboard/class/new"
                className="lab-button lab-button--primary"
              >
                + 새 학급 만들기
              </Link>
            )}
          </div>

          {integratedRoster && (
            <div className="lab-panel border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
              아지트의 학급과 학생 명단을 그대로 사용합니다. 아지트에서 학생을 추가하거나 수정하면
              연구소에도 별도 동기화 없이 바로 반영됩니다.
            </div>
          )}

          {classes.length === 0 ? (
            <div className="lab-panel lab-empty">
              <div className="text-6xl mb-5">🏫</div>
              <p className="text-xl text-gray-500 font-medium">
                {integratedRoster ? "아지트에 등록된 학급이 없습니다." : "아직 만든 학급이 없습니다."}
              </p>
              <p className="text-base text-gray-400 mt-2">
                {integratedRoster
                  ? "아지트에서 학급과 학생을 등록하면 이곳에 바로 나타납니다."
                  : "학급을 만들고 학생 명단을 등록하면 바로 활동을 시작할 수 있어요."}
              </p>
              {integratedRoster ? (
                <a href={AGIT_HOME_URL} className="lab-button lab-button--primary mt-6">
                  아지트로 돌아가기
                </a>
              ) : (
                <Link
                  href="/dashboard/class/new"
                  className="lab-button lab-button--primary mt-6"
                >
                  첫 학급 만들기
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/dashboard/class/${cls.id}`}
                  className="lab-panel p-7 hover:shadow-md hover:border-blue-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
                      🏫
                    </span>
                    <span className="lab-chip">
                      {cls.grade_level}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-xl group-hover:text-blue-600 transition-colors">
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
          <div className="lab-panel border-blue-100 bg-blue-50 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-800">✏️ 글쓰기 활동 꾸러미 사용 안내</h2>
            <p className="text-base text-slate-600 mt-2 leading-relaxed max-w-3xl">
              아지트 글쓰기 연구소의 대표 기능인 <strong>글쓰기 활동 꾸러미</strong>의 설정 및 5가지 핵심 활동 사용 가이드입니다.
            </p>
            <div className="mt-4 flex gap-3">
              <span className="lab-chip">
                준비 단계: 질문 카드 설정
              </span>
              <span className="lab-chip">
                활동 구성: 5종 글쓰기 연계 활동
              </span>
            </div>
          </div>

          {/* 설정 가이드 섹션 */}
          <div className="grid gap-6">
            {/* 질문 카드 설정 */}
            <div className="lab-panel p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🃏</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">1. 질문 카드 설정 방법</h3>
                  <p className="text-sm text-gray-400">학생들의 글감 구성을 돕는 카드 리스트 조립</p>
                </div>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 1</span>
                  <span>상단 메뉴의 <strong className="text-blue-600 font-semibold">질문 카드</strong>를 눌러 관리 페이지로 이동합니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 2</span>
                  <span>기본 제공되는 카드 묶음 외에, 수업에 특화된 <strong className="font-semibold text-gray-700">새 질문 카드 묶음</strong>이나 <strong className="font-semibold text-gray-700">학생 역할(Role)</strong> 카드를 직접 제작할 수 있습니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded text-xs mt-0.5 shrink-0">Step 3</span>
                  <span>질문 카드 묶음에 들어갈 개별 세부 문항(프롬프트)들을 한 줄씩 추가하여 구성해 둡니다. 이는 이후 <strong>질문 만들기</strong> 활동의 템플릿 카드가 됩니다.</span>
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

          {/* 다섯 가지 글쓰기 꾸러미 핵심 활동 설명 */}
          <div className="space-y-5">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>🚀</span> 글쓰기 활동 꾸러미 5가지 핵심 활동
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* 글 개요 짜기 */}
              <div className="lab-panel p-6 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl font-bold">1</span>
                  <h4 className="text-lg font-bold text-gray-800">글 개요 짜기 (Outline Builder)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  학생이 학년과 글 종류에 맞는 질문에 답하면서 처음·가운데·끝의 흐름을 직접 구성합니다. 완성된 개요는 이후 아지트 글쓰기에서 불러와 글의 뼈대로 활용할 수 있도록 연동할 예정입니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">글 종류, 대상 학년, 개요 질문</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-indigo-600 font-semibold">학생 답변 기반 개요 구성</span>
                  </div>
                </div>
              </div>

              {/* 질문 만들기 */}
              <div className="lab-panel p-6 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-purple-50 text-purple-600 rounded-xl font-bold">2</span>
                  <h4 className="text-lg font-bold text-gray-800">질문 만들기 (Question Generator)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  주제 글쓰기에 앞서 학생이 질문 카드를 고르고 오늘 주제에 알맞게 바꾸거나, 직접 질문을 만들며 질문 생성 능력을 기릅니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold">선택 질문 카드 묶음 활성화, 최대 카드 수</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-purple-600 font-semibold">비계(Scaffolding) 카드 선택에 기반한 메타인지 향상</span>
                  </div>
                </div>
              </div>

              {/* 좋은 질문 고르기 */}
              <div className="lab-panel p-6 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl font-bold">3</span>
                  <h4 className="text-lg font-bold text-gray-800">좋은 질문 고르기 (Question Voting)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  질문 만들기 활동에서 동료 학생들이 제출한 익명화된 전체 질문 중, 교사가 설정한 평가 기준에 부합하는 질문을 고르며 평가 및 분석적 사고를 경험합니다.
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
              <div className="lab-panel p-6 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-rose-50 text-rose-600 rounded-xl font-bold">4</span>
                  <h4 className="text-lg font-bold text-gray-800">한줄모아 (One Line Share)</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  교과 차시 정리와 피드백에 활용하는 공유 보드입니다. 교사가 정한 핵심 단어를 한 문장에 자연스럽게 넣고, 친구 문장에 하트를 보내며 함께 생각을 나눕니다.
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
              <div className="lab-panel p-6 hover:shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl px-3 py-1 bg-amber-50 text-amber-600 rounded-xl font-bold">5</span>
                  <h4 className="text-lg font-bold text-gray-800">한자 활용 문장 만들기</h4>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  교사가 만든 한자 카드에서 단어와 관련 어휘를 읽고, 그 단어의 뜻을 살린 한 문장을 만들어 친구들과 공유합니다.
                </p>
                <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 font-medium">교사 권장 설정</span>
                    <span className="text-gray-700 font-semibold text-right">한자 단어, 뜻, 관련 어휘</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 font-medium">특화 포인트</span>
                    <span className="text-amber-600 font-semibold text-right">한자 어휘를 실제 문장에 활용</span>
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
