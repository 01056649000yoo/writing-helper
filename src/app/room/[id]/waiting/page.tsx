"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkQueueStatus, triggerQueueProcess } from "@/app/actions/student-actions";

export default function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queueId = searchParams.get("queue") ?? "";
  const sessionId = searchParams.get("session") ?? "";

  const [roomId, setRoomId] = useState("");
  const [position, setPosition] = useState<number | null>(null);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    params.then(p => setRoomId(p.id));
  }, [params]);

  // 점 애니메이션
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // 2초마다 폴링
  useEffect(() => {
    if (!queueId || !roomId) return;

    // 서버 대기열 처리기 호출 (서버 액션 — 시크릿 브라우저 노출 없음)
    async function triggerQueue() {
      try { await triggerQueueProcess(); } catch {}
    }

    async function poll() {
      const status = await checkQueueStatus(queueId, sessionId);
      if (!status) return;
      setPosition(status.position);
      if (status.status === "done") {
        router.push(`/room/${roomId}/result?session=${sessionId}`);
      }
      if (status.status === "error") {
        router.push(`/room/${roomId}/activity?session=${sessionId}&retry=1`);
      }
    }

    triggerQueue();
    poll();
    const interval = setInterval(() => { triggerQueue(); poll(); }, 2000);
    return () => clearInterval(interval);
  }, [queueId, roomId, sessionId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
        <div className="text-6xl mb-6 animate-bounce">🤖</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          개요를 만들고 있어요{dots}
        </h1>
        <p className="text-gray-500 text-sm mb-6">AI가 열심히 생각하고 있어요!</p>

        {position && position > 1 && (
          <div className="bg-orange-50 rounded-2xl p-4 mb-4">
            <p className="text-orange-700 text-sm font-medium">현재 {position}번째 순서예요</p>
            <p className="text-orange-500 text-xs mt-1">잠깐만 기다려주세요 🌟</p>
          </div>
        )}

        <div className="flex justify-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 bg-orange-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-6">창을 닫지 말고 기다려주세요 😊</p>
      </div>
    </div>
  );
}
