import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withBasePath } from "@/lib/app-path";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // 오픈 리다이렉트 방지: 반드시 내부 경로(/)로 시작해야 함
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(new URL(withBasePath("/login?error=missing_code"), appOrigin));
  }

  const cookieStore = await cookies();
  const url = process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(withBasePath(`/login?error=${encodeURIComponent(error.message)}`), appOrigin));
  }

  return NextResponse.redirect(new URL(withBasePath(next), appOrigin));
}
