import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MAX_PROMPT_LENGTH = 10_000;

export async function callAgitAi(labActorId: string, prompt: string): Promise<string> {
  const endpoint = process.env.AGIT_AI_INTERNAL_URL?.trim();
  const labAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const normalizedPrompt = prompt.trim();

  if (!endpoint || !labAnonKey) {
    throw new Error("아지트 AI 연결 설정을 확인해주세요.");
  }
  if (!normalizedPrompt) throw new Error("AI에게 전달할 내용이 없습니다.");
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error("AI에게 전달할 내용이 너무 깁니다.");
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const accessToken = sessionData.session?.access_token;
  if (!userData.user || userData.user.id !== labActorId || !accessToken) {
    throw new Error("로그인 정보를 다시 확인해주세요.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      "X-Lab-Auth": `Bearer ${accessToken}`,
      "X-Lab-Anon-Key": labAnonKey,
    },
    body: JSON.stringify({ type: "LAB_GENERAL", prompt: normalizedPrompt }),
  });

  const result = await response.json().catch(() => ({})) as { text?: unknown; error?: unknown };
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "아지트 AI 응답을 받지 못했습니다.");
  }
  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("아지트 AI 응답이 비어있습니다.");
  }
  return result.text.trim();
}

export function parseAiJsonObject(value: string): Record<string, unknown> {
  const withoutFence = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답 형식을 확인할 수 없습니다.");
  const parsed = JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("AI 응답 형식을 확인할 수 없습니다.");
  }
  return parsed as Record<string, unknown>;
}
