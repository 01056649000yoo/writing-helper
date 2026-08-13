import "server-only";

import { getActivityDefinition } from "@/features/activities/registry";
import { isActivityType } from "@/features/activities/types";
import { isIntegratedLab } from "@/lib/lab-roster";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function persistPortableResult(
  admin: AdminClient,
  sessionId: string,
  roomId: string,
) {
  if (!isIntegratedLab()) return true;

  const [sessionRes, roomRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, room_id, status, answers, submission, result")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("id, title, topic, activity_type, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  const session = sessionRes.data;
  const room = roomRes.data;
  const activityType = room?.activity_type ?? "outline_builder";
  if (
    !session
    || !["in_progress", "done"].includes(session.status)
    || !room
    || !isActivityType(activityType)
  ) {
    return false;
  }

  const definition = getActivityDefinition(activityType);
  const content = definition.integration.toPortableResult({
    config: room.activity_config,
    submission: session.submission,
    result: session.result,
    answers: session.answers,
  });
  const chunks = content.chunks
    .map((chunk) => ({
      ...chunk,
      id: chunk.id.trim().slice(0, 100),
      text: chunk.text.trim().slice(0, 10000),
      label: chunk.label?.trim().slice(0, 300),
    }))
    .filter((chunk) => chunk.id && chunk.text);

  if (chunks.length === 0 || chunks.length > 100) return false;

  const { error } = await admin
    .schema("writing_helper")
    .rpc("upsert_portable_result_v1", {
      p_session_id: sessionId,
      p_activity_type: activityType,
      p_activity_version: definition.version,
      p_schema_version: definition.integration.schemaVersion,
      p_result_kind: definition.integration.resultKind,
      p_title: room.title?.trim() || room.topic?.trim() || definition.label,
      p_topic: room.topic?.trim() ?? "",
      p_chunks: chunks,
      p_metadata: {
        activityLabel: definition.label,
        ...(content.metadata ?? {}),
      },
    });

  if (error) {
    console.error("[portable-results] upsert failed", error.code ?? "unknown");
    return false;
  }

  return true;
}
