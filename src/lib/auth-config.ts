export const SHARED_AUTH_COOKIE_NAME = "sb-agit-auth-token";

export const SHARED_AUTH_COOKIE_OPTIONS = {
  name: SHARED_AUTH_COOKIE_NAME,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export const getServerAuthCookieOptions = () => (
  process.env.LAB_SSO_ENABLED === "true" ? SHARED_AUTH_COOKIE_OPTIONS : undefined
);

export const BROWSER_AUTH_COOKIE_OPTIONS = (
  process.env.NEXT_PUBLIC_LAB_SSO_ENABLED === "true" ? SHARED_AUTH_COOKIE_OPTIONS : undefined
);
