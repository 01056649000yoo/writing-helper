"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { getRoomSessions } from "@/app/actions/room-actions";

type Student = { id: string; student_number: number; student_name: string };
type Session = {
  id: string;
  student_number: number;
  student_name: string;
  level: string | null;
  status: string;
};

function levelLabel(level: string) {
  return { low: "도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return {
    low: "bg-orange-100 text-orange-700",
    mid: "bg-blue-100 text-blue-700",
    high: "bg-green-100 text-green-700",
  }[level] ?? "";
}

function StudentQrModal({
  sessionId,
  studentName,
  studentNumber,
  onClose,
}: {
  sessionId: string;
  studentName: string;
  studentNumber: number;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/${sessionId}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#166534", light: "#ffffff" },
    }).then(setQrUrl);
  }, [shareUrl]);

  function copyUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.focus(); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-7 flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">개인 결과 QR</p>
          <h3 className="text-lg font-bold text-gray-800">
            {studentNumber}번 {studentName}
          </h3>
        </div>
        {qrUrl ? (
          <img src={qrUrl} alt="QR" className="w-48 h-48 rounded-xl" />
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
        )}
        <p className="text-xs text-gray-400 text-center">
          이 QR을 스캔하면 개요를 바로 복사할 수 있어요
        </p>
        <button
          onClick={copyUrl}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          🔗 링크 복사
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function LiveStudentPanel({
  roomId,
  students,
  isActive,
}: {
  roomId: string;
  students: Student[];
  isActive: boolean;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [qrTarget, setQrTarget] = useState<Session | null>(null);

  async function fetchSessions() {
    const data = await getRoomSessions(roomId);
    setSessions((data as Session[]) ?? []);
  }

  useEffect(() => {
    fetchSessions();
    if (!isActive) return;
    const interval = setInterval(fetchSessions, 4000);
    return () => clearInterval(interval);
  }, [roomId, isActive]);

  const doneSessions = sessions.filter(s => s.status === "done");
  const activeSessions = sessions.filter(s => s.status === "in_progress");
  const connectedNums = new Set(sessions.map(s => s.student_number));
  const notConnected = students.filter(s => !connectedNums.has(s.student_number));

  return (
    <>
      {qrTarget && (
        <StudentQrModal
          sessionId={qrTarget.id}
          studentName={qrTarget.student_name}
          studentNumber={qrTarget.student_number}
          onClose={() => setQrTarget(null)}
        />
      )}

      <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">학생 활동 현황</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 text-sm">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                접속 중 {activeSessions.length}명
              </span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                완료 {doneSessions.length}명
              </span>
              <span className="bg-gray-50 text-gray-500 px-3 py-1 rounded-full font-medium">
                전체 {students.length}명
              </span>
            </div>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                실시간
              </span>
            )}
          </div>
        </div>

        {/* 접속 중 */}
        {activeSessions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-blue-600 mb-2">✏️ 지금 활동 중</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeSessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-blue-300 font-mono w-5 shrink-0">{s.student_number}</span>
                  <span className="text-sm font-medium text-blue-800 truncate">{s.student_name}</span>
                  {s.level && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${levelStyle(s.level)}`}>
                      {levelLabel(s.level)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 완료 */}
        {doneSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-600">✅ 개요 완성</p>
              <p className="text-xs text-gray-400">QR 버튼 → 학생 개인 결과 QR</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {doneSessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-green-300 font-mono w-5 shrink-0">{s.student_number}</span>
                  <span className="text-sm font-medium text-green-800 truncate flex-1">{s.student_name}</span>
                  {/* QR 버튼 */}
                  <button
                    type="button"
                    onClick={() => setQrTarget(s)}
                    className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg font-medium transition-colors shrink-0"
                    title="개인 결과 QR 보기"
                  >
                    QR
                  </button>
                  {/* 결과 보기 링크 */}
                  <Link
                    href={`/dashboard/room/${roomId}/result/${s.id}`}
                    className="text-xs text-green-500 hover:text-green-700 shrink-0"
                  >
                    보기 →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미접속 */}
        {notConnected.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-2">⬜ 미접속 ({notConnected.length}명)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {notConnected.map(s => (
                <div key={s.id}
                  className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-300 font-mono w-4 shrink-0">{s.student_number}</span>
                  <span className="text-sm text-gray-500 truncate">{s.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">학생 명단이 없습니다.</p>
        )}

        {sessions.length === 0 && students.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-2 animate-pulse">
            학생이 QR 코드로 접속하면 여기에 표시돼요
          </p>
        )}
      </div>
    </>
  );
}
