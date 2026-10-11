import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// 로그인한 연구소 선생님 확인을 한 요청 안에서 한 번만 한다(2026-10-11).
// 선생님 방 화면 하나에서 방 정보·명단·친구 개요 모음 등이 저마다 확인해 같은 요청에 4~5번
// (로그인 서버 + 선생님 확인 RPC) 오갔다. React cache 는 요청마다 새로 비워져 다른 사람과 섞이지 않는다.
export const getCachedCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  if (process.env.LAB_SSO_ENABLED === "true") {
    const { data: access, error: accessError } = await supabase.rpc("ensure_lab_teacher_profile_v1");
    if (accessError || access?.version !== 1 || access?.allowed !== true) return null;
  }

  return user;
});
