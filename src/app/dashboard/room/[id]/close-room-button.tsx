"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeRoom } from "@/app/actions/room-actions";

// 활동 종료 확인(2026-10-11 선생님 결정): 종료하면 무엇이 바뀌는지 알리고 `확인` 을 눌러야 종료한다.
// 개요짜기는 종료 뒤 학생이 개요를 고칠 수 없고 보기만 한다. 친구 개요 모음은 공유 기간 동안 계속 보인다.
export function CloseRoomButton({
  roomId, isOutlineBuilder, boardOpen,
}: {
  roomId: string;
  isOutlineBuilder: boolean;
  boardOpen: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirmClose() {
    setError("");
    startTransition(async () => {
      const result = await closeRoom(roomId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="lab-button lab-button--danger" onClick={() => setConfirming(true)}>
        활동 종료하기
      </button>
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="close-room-title">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-xl">
            <h2 id="close-room-title" className="text-lg font-bold text-gray-800">🏁 활동을 종료할까요?</h2>
            <ul className="space-y-2 text-sm leading-relaxed text-gray-700">
              {isOutlineBuilder ? (
                <>
                  <li>• 종료하면 학생은 <strong>개요를 더 고칠 수 없고, 보기만</strong> 할 수 있어요.</li>
                  <li>• 아직 내지 않은 학생도 더는 쓸 수 없어요.</li>
                  <li>
                    • {boardOpen
                      ? <>지금 켜 둔 <strong>친구 개요 모음</strong>은 공유 기간 동안 학생 대시보드·주소·QR로 계속 볼 수 있어요.</>
                      : <>종료한 뒤에도 <strong>친구 개요 모음</strong>을 켜면 학생들이 서로의 개요를 볼 수 있어요.</>}
                  </li>
                </>
              ) : (
                <>
                  <li>• 종료하면 학생은 <strong>더 참여하거나 고칠 수 없어요.</strong></li>
                  <li>• 이미 낸 결과는 선생님 화면에서 계속 볼 수 있어요.</li>
                </>
              )}
              <li>• 종료한 활동은 다시 열 수 없어요.</li>
            </ul>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="lab-button lab-button--quiet" onClick={() => setConfirming(false)} disabled={pending}>그만두기</button>
              <button type="button" className="lab-button lab-button--danger" onClick={confirmClose} disabled={pending}>
                {pending ? "종료하는 중…" : "확인하고 종료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
