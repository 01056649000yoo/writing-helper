const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

export const APP_BASE_PATH = rawBasePath === "/"
  ? ""
  : rawBasePath.replace(/\/+$/, "");

export function withBasePath(pathname: string) {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || !APP_BASE_PATH) {
    return pathname;
  }
  if (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname;
  }
  return `${APP_BASE_PATH}${pathname}`;
}

export function withoutBasePath(pathname: string) {
  if (!APP_BASE_PATH) return pathname;
  if (pathname === APP_BASE_PATH) return "/";
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }
  return pathname;
}
