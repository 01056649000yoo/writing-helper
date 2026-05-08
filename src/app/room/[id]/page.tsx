import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { RoomEntryClient } from "./room-entry-client";

type ActivityType = "outline_builder" | "question_generator" | "question_voting";

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

  const activityType: ActivityType =
    room.activity_type === "question_generator" || room.activity_type === "question_voting"
      ? room.activity_type
      : "outline_builder";

  return (
    <RoomEntryClient
      roomId={roomId}
      activityType={activityType}
      topic={room.topic ?? ""}
    />
  );
}
