"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRoom } from "@/app/actions/room-actions";

export function DeleteRoomButton({ roomId }: { roomId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); // Link 클릭 막기
    e.stopPropagation();
    if (!confirm("이 활동 세션을 삭제할까요?\n(학생 참여 기록도 함께 삭제됩니다)")) return;
    setPending(true);
    const result = await deleteRoom(roomId);
    if (result.error) {
      alert(result.error);
      setPending(false);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
      title="활동 세션 삭제"
    >
      {pending ? "삭제 중..." : "🗑 삭제"}
    </button>
  );
}
