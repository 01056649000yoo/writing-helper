"use client";

import { deleteClass } from "@/app/actions/class-actions";

export function DeleteClassButton({ classId }: { classId: string }) {
  async function handleDelete() {
    if (!confirm("학급을 삭제하면 연결된 활동 세션 데이터도 함께 삭제됩니다. 계속할까요?")) return;
    await deleteClass(classId);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="w-full py-2 text-sm text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
      학급 삭제
    </button>
  );
}
