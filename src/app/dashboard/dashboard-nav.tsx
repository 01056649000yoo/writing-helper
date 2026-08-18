"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withoutBasePath } from "@/lib/app-path";

const LAST_CLASS_ID_KEY = "lab_last_active_class_id";

function isCurrentSection(pathname: string, section: "home" | "settings" | "hanja") {
  if (section === "settings") return pathname.startsWith("/dashboard/settings");
  if (section === "hanja") return pathname.startsWith("/dashboard/hanja-wordbook");
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

  const primaryItems = [
    { href: homeHref, label: "학급·활동", section: "home" as const },
    { href: "/dashboard/settings", label: "질문 카드", section: "settings" as const },
    { href: "/dashboard/hanja-wordbook", label: "한자 단어집", section: "hanja" as const },
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
