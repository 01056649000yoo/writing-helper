import { createSupabaseAdminClient } from "./supabase-server";

const VAULT_SECRET_PREFIX = "writing_helper_gpt_key_";

export async function saveApiKey(userId: string, apiKey: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const secretName = `${VAULT_SECRET_PREFIX}${userId}`;

  const { data, error } = await admin.rpc("wh_vault_upsert_secret", {
    p_secret: apiKey,
    p_name: secretName,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

export async function getApiKey(vaultSecretId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("wh_vault_get_secret", {
    p_id: vaultSecretId,
  });

  if (error || !data) return null;
  return data as string;
}

export async function hasApiKey(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const secretName = `${VAULT_SECRET_PREFIX}${userId}`;

  const { data } = await admin.rpc("wh_vault_has_secret", { p_name: secretName });
  return Boolean(data);
}
