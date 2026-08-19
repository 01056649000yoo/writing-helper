import type { ReactNode } from "react";

/**
 * 번호·아이콘을 담는 **동그란 배지** 하나.
 *
 * 화면마다 손으로 쓰다 보니 클래스가 조금씩 달랐고, 개요 짜기의 `처음/가운데/끝` 번호는
 * `inline-block` 과 `flex` 를 함께 써서 **가운데 정렬이 깨져 있었다**(2026-08-20 사용자 지적).
 * 두 개 모두 display 유틸리티라 나중에 정의된 하나만 이기고 다른 하나는 조용히 무시된다.
 *
 * 그래서 자리를 하나로 모은다. **여기서는 display 를 `inline-flex` 하나만 쓴다.**
 */
export type BadgeCircleSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<BadgeCircleSize, string> = {
  sm: "h-5 w-5 text-[0.68rem]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
};

export function BadgeCircle({
  children,
  size = "md",
  className = "bg-gray-100 text-gray-600",
  title,
}: {
  children: ReactNode;
  size?: BadgeCircleSize;
  /** 색만 넘긴다(예: `bg-orange-100 text-orange-500`). 크기·정렬은 이 컴포넌트가 정한다. */
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      aria-hidden={title ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none ${SIZE_CLASS[size]} ${className}`}
    >
      {children}
    </span>
  );
}
