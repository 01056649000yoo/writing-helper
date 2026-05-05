"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeSection({ roomUrl, shortUrl }: { roomUrl: string; shortUrl?: string | null }) {
  const [qrSmall, setQrSmall] = useState("");
  const [qrLarge, setQrLarge] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"short" | "full" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const primaryUrl = shortUrl ?? roomUrl;

  useEffect(() => {
    QRCode.toDataURL(primaryUrl, { width: 240, margin: 2, color: { dark: "#3730a3", light: "#ffffff" } })
      .then(setQrSmall);
    QRCode.toDataURL(primaryUrl, { width: 600, margin: 3, color: { dark: "#3730a3", light: "#ffffff" } })
      .then(setQrLarge);
  }, [primaryUrl]);

  function copyUrl(target: "short" | "full", url: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget(null), 2000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.focus(); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    }
  }

  return (
    <>
      <div className="border-t border-gray-100 pt-6 mt-6">
        <p className="text-sm font-medium text-gray-700 mb-4 text-center">📱 학생들에게 QR 코드 또는 참여 링크를 보여주세요</p>
        <div className="flex flex-col items-center gap-4">
          {qrSmall && (
            <button
              onClick={() => setExpanded(true)}
              className="bg-white p-4 rounded-2xl shadow-inner border border-indigo-100 hover:border-indigo-400 hover:shadow-md transition-all group relative"
              title="클릭하면 크게 볼 수 있어요"
            >
              <img src={qrSmall} alt="QR 코드" className="w-48 h-48" />
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-indigo-700 bg-white/90 px-2 py-1 rounded-lg shadow">
                  🔍 크게 보기
                </span>
              </div>
            </button>
          )}
          <div className="grid gap-2 max-w-md w-full">
            {shortUrl && (
              <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-indigo-500 mb-0.5">단축 링크</p>
                  <span className="text-xs text-indigo-700 truncate block">{shortUrl}</span>
                </div>
                <button
                  onClick={() => copyUrl("short", shortUrl)}
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-800 whitespace-nowrap"
                >
                  {copiedTarget === "short" ? "✅ 복사됨" : "복사"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-gray-400 mb-0.5">원본 링크</p>
                <span className="text-xs text-gray-500 truncate block">{roomUrl}</span>
              </div>
              <button
                onClick={() => copyUrl("full", roomUrl)}
                className="text-xs text-indigo-500 font-medium hover:text-indigo-700 whitespace-nowrap"
              >
                {copiedTarget === "full" ? "✅ 복사됨" : "복사"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 확대 모달 */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800">📱 QR 코드 스캔</h2>
            {qrLarge && <img src={qrLarge} alt="QR 코드 확대" className="w-full max-w-xs" />}
            <p className="text-xs text-gray-500 text-center break-all">{primaryUrl}</p>
            <button
              onClick={() => setExpanded(false)}
              className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
