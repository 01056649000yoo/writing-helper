"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoomBasics } from "@/app/actions/room-actions";

/**
 * 활동의 이름·주제를 고친다.
 *
 * **내용(개요 틀·질문 목록)은 여기서 고치지 않는다.** 학생이 이미 낸 답이 항목 id 로 붙어 있어,
 * 항목을 바꾸면 그 답이 어디에도 안 붙는 기록이 된다. 이름·주제는 답과 짝지어지지 않아 안전하다.
 */
export function EditRoomButton({
  roomId,
  title,
  topic,
  topicDescription,
}: {
  roomId: string;
  title: string;
  topic: string;
  topicDescription: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ title, topic, topicDescription });
  const [error, setError] = useState("");
  const router = useRouter();

  function openEditor(event: React.MouseEvent) {
    // 카드 전체가 링크라 부모로 번지면 활동 화면이 열린다.
    event.preventDefault();
    event.stopPropagation();
    setForm({ title, topic, topicDescription });
    setError("");
    setOpen(true);
  }

  async function handleSave() {
    if (pending) return;
    setPending(true);
    setError("");
    const result = await updateRoomBasics(roomId, form);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={openEditor}
        className="text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
        title="활동 이름·주제 수정"
      >
        ✏️ 수정
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
          >
            <h3 className="text-lg font-bold text-gray-800">활동 수정</h3>
            <p className="mt-1 text-xs text-gray-500">
              이름과 주제만 고칠 수 있어요. 활동 내용은 학생이 낸 답과 짝지어져 있어 바꾸지 않습니다.
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">활동 이름</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">주제</span>
              <input
                value={form.topic}
                onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">설명 (선택)</span>
              <textarea
                value={form.topicDescription}
                onChange={(event) => setForm((prev) => ({ ...prev, topicDescription: event.target.value }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>

            {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={pending || form.title.trim().length === 0}
                className="flex-1 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
