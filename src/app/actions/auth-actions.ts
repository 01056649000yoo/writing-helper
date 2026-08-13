"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";

type AuthResult = { error?: string; success?: boolean; email?: string };

const isSsoEnabled = () => process.env.LAB_SSO_ENABLED === "true";

function isValidSchoolName(schoolName: string) {
  return schoolName.length >= 2 && schoolName.length <= 60;
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  if (isSsoEnabled() || process.env.LAB_ALLOW_SIGNUP === "false") {
    return { error: "통합 연구소는 끄적끄적 아지트에서 승인된 교사만 이용할 수 있습니다." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();

  if (!email || !password || !name || !schoolName) return { error: "모든 항목을 입력해주세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
  if (!isValidSchoolName(schoolName)) return { error: "학교 이름을 2자 이상 60자 이하로 입력해주세요." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      school_name: schoolName,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "이미 가입된 이메일입니다." };
    }
    return { error: error.message };
  }
  if (!data.user) return { error: "회원가입에 실패했습니다." };

  const insertProfile = await admin
    .schema("writing_helper")
    .from("teacher_profiles")
    .insert({ user_id: data.user.id, name });
  if (insertProfile.error) return { error: "교사 정보를 저장하지 못했습니다." };

  const supabase = await createSupabaseServerClient();
  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (signInResult.error) return { error: "가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 화면에서 다시 로그인해주세요." };

  return { success: true };
}

export async function signIn(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  if (isSsoEnabled()) {
    return { error: "통합 연구소는 끄적끄적 아지트에서 로그인한 승인 교사 계정으로 이용합니다." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  if (isSsoEnabled()) {
    return { error: "통합 연구소의 계정과 로그인은 끄적끄적 아지트에서 관리합니다." };
  }

  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { error: "이메일을 입력해주세요." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: "비밀번호 재설정 메일을 보내지 못했습니다." };

  return { success: true, email };
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  if (isSsoEnabled()) {
    return { error: "통합 연구소의 계정과 로그인은 끄적끄적 아지트에서 관리합니다." };
  }

  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!password || !passwordConfirm) return { error: "새 비밀번호를 모두 입력해주세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
  if (password !== passwordConfirm) return { error: "비밀번호 확인이 일치하지 않습니다." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: "비밀번호를 변경하지 못했습니다. 메일 링크를 다시 열어 시도해주세요." };

  await supabase.auth.signOut();
  return { success: true };
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  if (isSsoEnabled()) {
    const { data: access, error: accessError } = await supabase.rpc("ensure_lab_teacher_profile_v1");
    if (accessError || access?.version !== 1 || access?.allowed !== true) return null;
  }

  return user;
}

export async function getTeacherProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}
