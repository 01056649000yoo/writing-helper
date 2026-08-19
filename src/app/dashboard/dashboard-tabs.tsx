"use client";

import { useState } from "react";
import Link from "next/link";
import { LabGuide } from "@/features/activities/LabGuide";

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
          📖 도움말 (활동 4가지 사용법)
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
          <LabGuide />
        </div>
      )}
    </div>
  );
}
