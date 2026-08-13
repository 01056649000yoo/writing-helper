"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { withoutBasePath } from "@/lib/app-path";

const primaryItems = [
  { href: "/dashboard", label: "학급·활동", section: "home" },
  { href: "/dashboard/settings", label: "질문 카드", section: "settings" },
  { href: "/dashboard/hanja-wordbook", label: "한자 단어집", section: "hanja" },
] as const;

function isCurrentSection(pathname: string, section: (typeof primaryItems)[number]["section"]) {
  if (section === "settings") return pathname.startsWith("/dashboard/settings");
  if (section === "hanja") return pathname.startsWith("/dashboard/hanja-wordbook");
  return pathname === "/dashboard"
    || pathname.startsWith("/dashboard/class")
    || pathname.startsWith("/dashboard/room");
}

export function DashboardNav() {
  const pathname = withoutBasePath(usePathname());

  return (
    <nav className="lab-shell__nav" aria-label="연구소 주요 메뉴">
      {primaryItems.map((item) => {
        const active = isCurrentSection(pathname, item.section);
        return (
          <Link
            key={item.href}
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
