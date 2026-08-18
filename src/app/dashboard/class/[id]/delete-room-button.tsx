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
      className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50 shadow-2xs flex items-center gap-1"
      title="활동 세션 삭제"
    >
      {pending ? "삭제 중..." : "🗑️ 삭제"}
    </button>
  );
}
