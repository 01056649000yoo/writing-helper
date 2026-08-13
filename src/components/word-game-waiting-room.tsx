"use client";

import { useEffect, useState } from "react";
import { getWordGameActivityStatus } from "@/app/actions/student-actions";

type WordGameWaitingRoomProps = {
  roomId: string;
  onStarted: (startedAt: string) => void;
};

export function WordGameWaitingRoom({ roomId, onStarted }: WordGameWaitingRoomProps) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const status = await getWordGameActivityStatus(roomId);
      if (cancelled || !status) return;
      if (status.closed) {
        setClosed(true);
        return;
      }
      if (status.status === "in_progress" && status.startedAt) {
        onStarted(status.startedAt);
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [roomId, onStarted]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-sky-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
        {closed ? (
          <>
            <div className="text-5xl mb-4">⛔</div>
            <h1 className="text-xl font-bold text-gray-800">활동이 종료되었습니다</h1>
            <p className="text-sm text-gray-500 mt-3">선생님이 활동을 종료했어요.</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4 animate-bounce">🏁</div>
            <h1 className="text-xl font-bold text-gray-800">선생님이 시작할 때까지 기다려주세요</h1>
            <p className="text-sm text-gray-500 mt-3">모든 친구들이 준비되면 게임이 시작돼요.</p>
          </>
        )}
      </div>
    </div>
  );
}
