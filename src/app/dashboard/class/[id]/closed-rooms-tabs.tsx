"use client";

import { useState } from "react";
import Link from "next/link";
import { DeleteRoomButton } from "./delete-room-button";

interface UnifiedRoom {
  kind: "writing";
  id: string;
  title: string;
  topic: string;
  subject_type?: string | null;
  activity_type?: string | null;
  is_active: boolean;
  created_at: string;
  // 기한(expires_at)은 2026-08-19에 없앴다. 활동은 교사가 종료할 때까지 열려 있다.
  topic_description?: string;
}

interface ClosedRoomsTabsProps {
  closedRooms: UnifiedRoom[];
}

type TabType =
  | "all"
  | "outline_builder"
  | "question_generator"
  | "question_voting"
  | "one_line_share"
  | "hanja_writing";

const WRITING_ACTIVITY_TYPES = [
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
  "hanja_writing",
] as const;

type WritingActivityType = typeof WRITING_ACTIVITY_TYPES[number];

function isWritingActivityType(value: string | null | undefined): value is WritingActivityType {
  return value !== null && value !== undefined && (WRITING_ACTIVITY_TYPES as readonly string[]).includes(value);
}

function activityTabMeta(type: WritingActivityType): {
  label: string;
  emoji: string;
  activeBg: string;
} {
  switch (type) {
    case "outline_builder":
      return { label: "개요짜기", emoji: "📝", activeBg: "bg-indigo-500 text-white shadow-xs" };
    case "question_generator":
      return { label: "질문 만들기", emoji: "🃏", activeBg: "bg-violet-500 text-white shadow-xs" };
    case "question_voting":
      return { label: "좋은 질문 고르기", emoji: "🗳️", activeBg: "bg-amber-500 text-white shadow-xs" };
    case "one_line_share":
      return { label: "한 줄 모아", emoji: "💬", activeBg: "bg-rose-500 text-white shadow-xs" };
    case "hanja_writing":
      return { label: "한자 활용 문장", emoji: "📜", activeBg: "bg-amber-600 text-white shadow-xs" };
  }
}

export function ClosedRoomsTabs({ closedRooms }: ClosedRoomsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const writingByActivity: Record<WritingActivityType, UnifiedRoom[]> = {
    outline_builder: [],
    question_generator: [],
    question_voting: [],
    one_line_share: [],
    hanja_writing: [],
  };
  for (const room of closedRooms) {
    if (room.kind !== "writing") continue;
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    writingByActivity[type].push(room);
  }

  const getFilteredRooms = () => {
    if (activeTab === "all") return closedRooms;
    return writingByActivity[activeTab];
  };

  const filtered = getFilteredRooms();

  function cardEmoji(room: UnifiedRoom): string {
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    if (type !== "outline_builder") return activityTabMeta(type).emoji;
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
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    return activityTabMeta(type).label;
  }

  function kindChipColor(room: UnifiedRoom): string {
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    switch (type) {
      case "outline_builder":
        return "bg-indigo-50 text-indigo-600 border border-indigo-100";
      case "question_generator":
        return "bg-violet-50 text-violet-700 border border-violet-100";
      case "question_voting":
        return "bg-amber-50 text-amber-700 border border-amber-100";
      case "one_line_share":
        return "bg-rose-50 text-rose-700 border border-rose-100";
      case "hanja_writing":
        return "bg-amber-50 text-amber-700 border border-amber-100";
    }
  }

  function cardAccentBorder(room: UnifiedRoom): string {
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    switch (type) {
      case "outline_builder":
        return "border-indigo-300 hover:border-indigo-400";
      case "question_generator":
        return "border-violet-300 hover:border-violet-400";
      case "question_voting":
        return "border-amber-300 hover:border-amber-400";
      case "one_line_share":
        return "border-rose-300 hover:border-rose-400";
      case "hanja_writing":
        return "border-amber-300 hover:border-orange-400";
    }
  }

  function renderDeleteBtn(room: UnifiedRoom) {
    return <DeleteRoomButton roomId={room.id} />;
  }

  const inactiveTabClass = "text-gray-500 hover:text-gray-700";

  function tabClass(target: TabType, activeBg: string): string {
    return `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
      activeTab === target ? activeBg : inactiveTabClass
    }`;
  }

  function emptyMessage(): string {
    if (activeTab === "all") return "종료된 활동 세션이 전혀 없습니다.";
    return `종료된 ${activityTabMeta(activeTab).label} 세션이 없습니다.`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>⚫</span> 종료된 활동 세션 ({closedRooms.length})
        </h2>

        <div className="flex flex-wrap gap-1 bg-gray-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={tabClass("all", "bg-white text-gray-800 shadow-xs")}
          >
            전체 ({closedRooms.length})
          </button>
          {WRITING_ACTIVITY_TYPES.map((type) => {
            const meta = activityTabMeta(type);
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={tabClass(type, meta.activeBg)}
              >
                {meta.emoji} {meta.label} ({writingByActivity[type].length})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/40 border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-base font-medium">{emptyMessage()}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((room) => {
            const href = `/dashboard/room/${room.id}`;

            return (
              <div
                key={`${room.kind}-${room.id}`}
                className={`relative bg-white/60 rounded-2xl hover:bg-white transition-all duration-200 opacity-80 hover:opacity-100 border-l-4 ${cardAccentBorder(room)} hover:shadow-xs group`}
              >
                {/* 5열이라 폭이 좁다. 진행 중 카드와 같은 크기로 맞춘다. */}
                <Link href={href} className="block p-4">
                  <div className="flex items-start gap-2 pr-9">
                    <span className="text-xl shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {cardEmoji(room)}
                    </span>
                    <h3 className="font-semibold text-gray-700 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {room.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">주제: {room.topic}</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`text-[0.68rem] px-2 py-0.5 rounded-full font-medium ${kindChipColor(room)}`}>
                      {kindLabel(room)}
                    </span>
                    {room.subject_type && (
                      <span className="text-[0.68rem] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {room.subject_type}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[0.68rem] text-gray-400 font-medium">
                    {new Date(room.created_at).toLocaleDateString("ko-KR")} 개설
                  </p>
                </Link>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
