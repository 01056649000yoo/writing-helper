"use client";

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
  // 도움말은 2026-08-20에 상단 메뉴(`/dashboard/guide`)로 옮겼다. 여기는 학급 목록만 그린다.

  return (
    <div className="space-y-6">
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
    </div>
  );
}
