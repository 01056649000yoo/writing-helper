import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

/*
 * 본문 글꼴을 아지트와 맞춘다(2026-08-24).
 *
 * 예전에는 Geist 를 앞에 뒀는데 Geist 에는 한글 글리프가 없어 한글만 Noto Sans KR 로 넘어갔다.
 * 그래서 한글은 같아 보여도 **숫자와 영문만 두 앱이 다르게** 보였다.
 * 아지트가 쓰는 굵기(400~900)를 그대로 받는다 — 굵기가 없으면 브라우저가 억지로 굵게 그려
 * 같은 900 이라도 모양이 달라진다.
 */
const notoSansKr = Noto_Sans_KR({
  variable: "--font-ui-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "끄적끄적 아지트 | 글쓰기 연구소",
  description: "끄적끄적 아지트의 교실 글쓰기 활동 연구소",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script defer src="https://umami.xn--vz0ba242ncqcba79xhwx.site/script.js" data-website-id="db787ba7-05d5-481b-824f-54bd47ecd3de"></script>
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
          상호명: 끄적끄적아지트 · 운영책임자: 유승현 · 문의:{" "}
          <a className="font-medium text-slate-600 underline-offset-2 hover:underline" href="mailto:yshgg@naver.com">
            yshgg@naver.com
          </a>
        </footer>
      </body>
    </html>
  );
}
