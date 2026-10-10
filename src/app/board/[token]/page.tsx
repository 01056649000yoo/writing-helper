import type { Metadata } from "next";
import { loadOutlineBoard } from "@/lib/outline-board-server";
import type { OutlineBoardPayload } from "@/lib/outline-board";
import { OutlineBoardClient } from "./board-client";

// 친구 개요 모음 공개 페이지(2026-10-10). 주소를 아는 사람은 누구나 본다(선생님 결정).
// 미리보기(카톡 등)에는 이름·내용 없이 제목만, 검색에는 올리지 않는다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "친구 개요 모음 | 글쓰기 연구소",
  description: "친구들이 제출한 개요를 함께 봐요.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: { title: "친구 개요 모음", description: "친구들이 제출한 개요를 함께 봐요." },
};

export default async function OutlineBoardPage({ params }: PageProps<"/board/[token]">) {
  const { token } = await params;
  let initial: OutlineBoardPayload | null = null;
  try {
    initial = await loadOutlineBoard(token);
  } catch {
    initial = null;
  }
  // 서버가 읽은 시각을 넘겨 `마지막 반영`·남은 기간이 서버와 브라우저에서 같게 그려지게 한다.
  return <OutlineBoardClient token={token} initial={initial} loadedAt={new Date().toISOString()} />;
}
