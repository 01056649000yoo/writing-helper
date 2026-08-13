import { NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { withBasePath } from "@/lib/app-path";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(withBasePath("/login?error=missing_token"), appOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(withBasePath(`/login?error=${encodeURIComponent(error.message)}`), appOrigin)
    );
  }

  return NextResponse.redirect(new URL(withBasePath(next), appOrigin));
}
