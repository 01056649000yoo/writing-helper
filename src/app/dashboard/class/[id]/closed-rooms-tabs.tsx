"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteRoomButton } from "./delete-room-button";
import { DeleteScienceRoomButton } from "./delete-science-room-button";
import { DeleteMoralsRoomButton } from "./delete-morals-room-button";
import { TRACK_META } from "@/types/science";
import { MORALS_TRACK_META } from "@/types/morals";

interface UnifiedRoom {
  kind: "writing" | "science" | "morals";
  id: string;
  title: string;
  topic: string;
  subject_type?: string | null;
  inquiry_track?: "basic" | "integrated" | null;
  track?: "reflection" | "judgement";
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface ClosedRoomsTabsProps {
  closedRooms: UnifiedRoom[];
  now: number;
}

type TabType = "all" | "writing" | "science" | "morals";

export function ClosedRoomsTabs({ closedRooms, now }: ClosedRoomsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const writingRooms = closedRooms.filter((r) => r.kind === "writing");
  const scienceRooms = closedRooms.filter((r) => r.kind === "science");
  const moralsRooms = closedRooms.filter((r) => r.kind === "morals");

  const getFilteredRooms = () => {
    switch (activeTab) {
      case "writing":
        return writingRooms;
      case "science":
        return scienceRooms;
      case "morals":
        return moralsRooms;
      default:
        return closedRooms;
    }
  };

  const filtered = getFilteredRooms();

  function cardEmoji(room: UnifiedRoom): string {
    if (room.kind === "science") return "🔬";
    if (room.kind === "morals") return "🪞";
    return subjectEmoji(room.subject_type ?? null);
  }

  function subjectEmoji(type: string | null) {
    if (!type) return "✏️";
    const map: Record<string, string> = {
      "생활문": "📖",
      "일기": "📓",
      "편지": "✉️",
      "독서감상문": "📚",
      "기행문": "🗺️",
      "관찰기록문": "🔬",
      "이야기 글": "🌈",
      "설명하는 글": "🔍",
      "주장하는 글": "💬",
      "소개하는 글": "🙋",
      "동시": "🎵",
      "보고서": "📋",
    };
    return map[type] ?? "✏️";
  }

  function kindLabel(room: UnifiedRoom): string {
    if (room.kind === "writing") return "글쓰기";
    if (room.kind === "science")
      return room.inquiry_track ? `과학 · ${TRACK_META[room.inquiry_track].label}` : "과학";
    return room.track ? `도덕 · ${MORALS_TRACK_META[room.track].label}` : "도덕";
  }

  function kindChipColor(room: UnifiedRoom): string {
    if (room.kind === "science") return "bg-cyan-50 text-cyan-700 border border-cyan-100";
    if (room.kind === "morals") return "bg-rose-50 text-rose-700 border border-rose-100";
    return "bg-indigo-50 text-indigo-600 border border-indigo-100";
  }

  function renderDeleteBtn(room: UnifiedRoom) {
    if (room.kind === "writing") return <DeleteRoomButton roomId={room.id} />;
    if (room.kind === "science") return <DeleteScienceRoomButton roomId={room.id} />;
    return <DeleteMoralsRoomButton roomId={room.id} />;
  }

  return (
    <div className="space-y-5">
      {/* 종료 세션 타이틀 & 탭 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>⚫</span> 종료된 활동 세션 ({closedRooms.length})
        </h2>
        
        {/* 과목/종류별 탭 리스트 */}
        <div className="flex flex-wrap gap-1 bg-gray-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            전체 ({closedRooms.length})
          </button>
          <button
            onClick={() => setActiveTab("writing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "writing"
                ? "bg-indigo-500 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ✏️ 글쓰기 ({writingRooms.length})
          </button>
          <button
            onClick={() => setActiveTab("science")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "science"
                ? "bg-cyan-600 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🔬 과학 ({scienceRooms.length})
          </button>
          <button
            onClick={() => setActiveTab("morals")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "morals"
                ? "bg-rose-500 text-white shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🪞 도덕 ({moralsRooms.length})
          </button>
        </div>
      </div>

      {/* 리스트 출력 */}
      {filtered.length === 0 ? (
        <div className="bg-white/40 border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-base font-medium">
            {activeTab === "writing" && "종료된 글쓰기 활동 세션이 없습니다."}
            {activeTab === "science" && "종료된 과학 탐구 활동 세션이 없습니다."}
            {activeTab === "morals" && "종료된 도덕 성찰 활동 세션이 없습니다."}
            {activeTab === "all" && "종료된 활동 세션이 전혀 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((room) => {
            const href =
              room.kind === "writing" ? `/dashboard/room/${room.id}` :
              room.kind === "science" ? `/dashboard/science/${room.id}` :
              `/dashboard/morals/${room.id}`;

            return (
              <div
                key={`${room.kind}-${room.id}`}
                className="relative bg-white/60 rounded-2xl hover:bg-white transition-all duration-200 opacity-80 hover:opacity-100 border border-transparent hover:border-gray-150 hover:shadow-xs group"
              >
                <Link href={href} className="block p-6">
                  <div className="flex items-start gap-3 mb-2 pr-16">
                    <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {cardEmoji(room)}
                    </span>
                    <h3 className="font-semibold text-gray-700 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                      {room.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">주제: {room.topic}</p>
                  
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${kindChipColor(room)}`}>
                      {kindLabel(room)}
                    </span>
                    {room.kind === "writing" && room.subject_type && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                        {room.subject_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-3 font-medium">
                    {new Date(room.created_at).toLocaleDateString("ko-KR")} 개설
                  </p>
                </Link>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderDeleteBtn(room)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
