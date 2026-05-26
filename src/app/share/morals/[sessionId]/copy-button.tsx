"use client";

import { useState } from "react";

export function MoralsCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  return (
    <>
      <button
        onClick={handleCopy}
        className={`w-full py-5 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-95 ${
          copied
            ? "bg-green-500 text-white shadow-green-200"
            : "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200"
        }`}
      >
        {copied ? "✅ 복사됐어요! 메모장에 붙여넣기 하세요" : "📋 도덕 글 복사하기"}
      </button>
      {copied && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 text-sm font-medium">
            📱 메모장 앱을 열고 붙여넣기(길게 누르기)를 해보세요!
          </p>
        </div>
      )}
    </>
  );
}
