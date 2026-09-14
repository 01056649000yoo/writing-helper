"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withoutBasePath } from "@/lib/app-path";

const LAST_CLASS_ID_KEY = "lab_last_active_class_id";

function isCurrentSection(pathname: string, section: "home" | "settings" | "guide") {
  if (section === "settings") return pathname.startsWith("/dashboard/settings");
  if (section === "guide") return pathname.startsWith("/dashboard/guide");
  return pathname === "/dashboard"
    || pathname.startsWith("/dashboard/class")
    || pathname.startsWith("/dashboard/room");
}

export function DashboardNav() {
  const pathname = withoutBasePath(usePathname());
  const searchParams = useSearchParams();
  const [savedClassId, setSavedClassId] = useState<string | null>(null);

  const classMatch = pathname.match(/^\/dashboard\/class\/([^/]+)/);
  const currentClassId = classMatch?.[1] ?? searchParams?.get("class_id") ?? null;

  useEffect(() => {
    if (currentClassId) {
      try {
        localStorage.setItem(LAST_CLASS_ID_KEY, currentClassId);
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem(LAST_CLASS_ID_KEY);
        if (saved) {
          // 비동기 콜백으로 전달하여 렌더 루프 방지
          queueMicrotask(() => setSavedClassId(saved));
        }
      } catch {}
    }
  }, [currentClassId]);

  const activeClassId = currentClassId ?? savedClassId;
  const homeHref = activeClassId ? `/dashboard/class/${activeClassId}` : "/dashboard";

  /*
   * 아지트의 업무 메뉴는 `아이콘 + 이름` 이다(2026-09-14). 두 화면을 오갈 때 메뉴가 다르게
   * 보이지 않도록 같은 모양으로 맞춘다. 아이콘은 뜻을 돕는 장식이라 화면 낭독에서는 숨긴다.
   */
  const primaryItems = [
    { href: homeHref, label: "학급·활동", icon: "🏫", section: "home" as const },
    { href: "/dashboard/settings", label: "질문 카드", icon: "🗂️", section: "settings" as const },
    // 도움말은 상단에 둔다 — 학급 안에서 활동을 만드는 자리에서도 열려야 한다(2026-08-20).
    { href: "/dashboard/guide", label: "도움말", icon: "❓", section: "guide" as const },
  ];

  return (
    <nav className="lab-shell__nav" aria-label="연구소 주요 메뉴">
      {primaryItems.map((item) => {
        const active = isCurrentSection(pathname, item.section);
        return (
          <Link
            key={item.section}
            href={item.href}
            className="lab-nav-link"
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}


export function DashboardBrandLink() {
  const pathname = withoutBasePath(usePathname());
  const searchParams = useSearchParams();
  const [savedClassId, setSavedClassId] = useState<string | null>(null);

  const classMatch = pathname.match(/^\/dashboard\/class\/([^/]+)/);
  const currentClassId = classMatch?.[1] ?? searchParams?.get("class_id") ?? null;

  useEffect(() => {
    if (currentClassId) {
      try {
        localStorage.setItem(LAST_CLASS_ID_KEY, currentClassId);
      } catch {}
    } else {
      try {
        const saved = localStorage.getItem(LAST_CLASS_ID_KEY);
        if (saved) {
          queueMicrotask(() => setSavedClassId(saved));
        }
      } catch {}
    }
  }, [currentClassId]);

  const activeClassId = currentClassId ?? savedClassId;
  const homeHref = activeClassId ? `/dashboard/class/${activeClassId}` : "/dashboard";

  return (
    <Link href={homeHref} className="lab-brand" aria-label="글쓰기 연구소 대시보드">
      <span className="lab-brand__mark" aria-hidden="true">✏️</span>
      <span>
        <span className="lab-brand__eyebrow">끄적끄적 아지트</span>
        <span className="lab-brand__title">글쓰기 연구소</span>
      </span>
    </Link>
  );
}
