"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function StudentResultQr({
  shareUrl,
  studentName,
  studentNumber,
}: {
  shareUrl: string;
  studentName: string;
  studentNumber: number;
}) {
  const [qrSmall, setQrSmall] = useState("");
  const [qrLarge, setQrLarge] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { width: 120, margin: 1, color: { dark: "#166534", light: "#ffffff" } })
      .then(setQrSmall);
    QRCode.toDataURL(shareUrl, { width: 400, margin: 2, color: { dark: "#166534", light: "#ffffff" } })
      .then(setQrLarge);
  }, [shareUrl]);

  function copyUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.focus(); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 shrink-0">
        <p className="text-xs text-gray-400 font-medium">학생 결과 QR</p>
        {qrSmall ? (
          <button
            onClick={() => setExpanded(true)}
            className="bg-green-50 border border-green-200 rounded-2xl p-2 hover:border-green-400 hover:shadow-md transition-all group"
            title="클릭하면 크게 볼 수 있어요"
          >
            <img src={qrSmall} alt="학생 결과 QR" className="w-20 h-20" />
            <p className="text-xs text-green-600 text-center mt-1 group-hover:font-medium">크게 보기</p>
          </button>
        ) : (
          <div className="w-24 h-24 bg-gray-100 rounded-2xl animate-pulse" />
        )}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-0.5">개인 결과 QR</p>
              <h3 className="text-xl font-bold text-gray-800">
                {studentNumber}번 {studentName}
              </h3>
            </div>
            {qrLarge && <img src={qrLarge} alt="QR 확대" className="w-full max-w-xs rounded-2xl" />}
            <p className="text-xs text-gray-400 text-center">
              학생이 이 QR을 스캔하면 개요를 바로 복사할 수 있어요
            </p>
            <button
              onClick={copyUrl}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {copied ? "✅ 링크 복사됨" : "🔗 링크 복사"}
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
