import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/+$/, "");

if (basePath && (!basePath.startsWith("/") || basePath.includes("?") || basePath.includes("#"))) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be an absolute path such as /lab");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.219.102", "192.168.219.117", "helper.xn--vz0ba242ncqcba79xhwx.site"],
  output: "standalone",
  basePath,
  // 배포 버전 어긋남 보호(2026-10-11): 배포 전에 열어 둔 화면이 새 서버로 이동하면 저절로 새로 고친다.
  // 없으면 옛 화면의 요청이 "Failed to find Server Action" 으로 실패해 불러오는 중에 멈출 수 있었다.
  // 빌드 때 커밋 해시(BUILD_VERSION → NEXT_PUBLIC_BUILD_VERSION, Dockerfile)를 쓴다. 개발 중에는 비어 있어 꺼진다.
  deploymentId: process.env.NEXT_PUBLIC_BUILD_VERSION || undefined,
};

export default nextConfig;
