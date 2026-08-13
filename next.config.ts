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
};

export default nextConfig;
