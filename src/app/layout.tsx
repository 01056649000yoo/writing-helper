import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "아지트 글쓰기 연구소",
  description: "초등학생 글쓰기 개요 도우미",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script defer src="https://umami.xn--vz0ba242ncqcba79xhwx.site/script.js" data-website-id="db787ba7-05d5-481b-824f-54bd47ecd3de"></script>
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white/80 px-4 py-4 text-center text-xs text-slate-500 backdrop-blur-sm">
          상호명: 끄적끄적아지트 · 운영책임자: 유승현 · 문의:{" "}
          <a className="font-medium text-slate-600 underline-offset-2 hover:underline" href="mailto:yshgg@naver.com">
            yshgg@naver.com
          </a>
        </footer>
      </body>
    </html>
  );
}
