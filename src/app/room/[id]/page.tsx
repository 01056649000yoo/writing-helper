import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isActivityType, type ActivityType } from "@/features/activities/types";
import { RoomEntryClient } from "./room-entry-client";

export default async function RoomEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: roomId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, topic, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    notFound();
  }

  const activityType: ActivityType = room.activity_type == null
    ? "outline_builder"
    : isActivityType(room.activity_type)
      ? room.activity_type
      : notFound();

  return (
    <RoomEntryClient
      roomId={roomId}
      activityType={activityType}
      topic={room.topic ?? ""}
    />
  );
}
