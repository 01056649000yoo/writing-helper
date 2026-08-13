import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { withBasePath } from "@/lib/app-path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const admin = createSupabaseAdminClient();

  const { data: link } = await admin
    .schema("writing_helper")
    .from("short_links")
    .select("target_path, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL(withBasePath("/login"), _request.url));
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.redirect(new URL(withBasePath(link.target_path), _request.url));
  }

  return NextResponse.redirect(new URL(withBasePath(link.target_path), _request.url));
}
