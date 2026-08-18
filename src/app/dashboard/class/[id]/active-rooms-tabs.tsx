"use client";

import { useState } from "react";
import Link from "next/link";
import { EditRoomButton } from "./edit-room-button";

interface UnifiedRoom {
  kind: "writing";
  id: string;
  title: string;
  topic: string;
  subject_type?: string | null;
  activity_type?: string | null;
  is_active: boolean;
  created_at: string;
  topic_description?: string;
}

interface ActiveRoomsTabsProps {
  activeRooms: UnifiedRoom[];
  classId: string;
}

type TabType =
  | "all"
  | "outline_builder"
  | "question_generator"
  | "question_voting"
  | "one_line_share";

const WRITING_ACTIVITY_TYPES = [
  "outline_builder",
  "question_generator",
  "question_voting",
  "one_line_share",
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
      return { label: "개요짜기", emoji: "📝", activeBg: "bg-indigo-600 text-white shadow-xs" };
    case "question_generator":
      return { label: "질문 만들기", emoji: "🃏", activeBg: "bg-violet-600 text-white shadow-xs" };
    case "question_voting":
      return { label: "좋은 질문 고르기", emoji: "🗳️", activeBg: "bg-amber-600 text-white shadow-xs" };
    case "one_line_share":
      return { label: "한 줄 모아", emoji: "💬", activeBg: "bg-rose-600 text-white shadow-xs" };
  }
}

export function ActiveRoomsTabs({ activeRooms, classId }: ActiveRoomsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const writingByActivity: Record<WritingActivityType, UnifiedRoom[]> = {
    outline_builder: [],
    question_generator: [],
    question_voting: [],
    one_line_share: [],
  };

  for (const room of activeRooms) {
    if (room.kind !== "writing") continue;
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    if (writingByActivity[type]) {
      writingByActivity[type].push(room);
    }
  }

  const getFilteredRooms = () => {
    if (activeTab === "all") return activeRooms;
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
      "생활문": "📖", "일기": "📓", "편지": "✉️", "독서감상문": "📚",
      "기행문": "🗺️", "관찰기록문": "🔬", "이야기 글": "🌈",
      "설명하는 글": "🔍", "주장하는 글": "💬", "소개하는 글": "🙋",
      "동시": "🎵", "보고서": "📋",
    };
    return map[type] ?? "✏️";
  }

  function kindLabel(room: UnifiedRoom): string {
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    switch (type) {
      case "outline_builder": return "글 개요짜기";
      case "question_generator": return "질문 만들기";
      case "question_voting": return "좋은 질문 고르기";
      case "one_line_share": return "한 줄 모아";
    }
  }

  function kindChipColor(room: UnifiedRoom): string {
    const type = isWritingActivityType(room.activity_type) ? room.activity_type : "outline_builder";
    switch (type) {
      case "outline_builder": return "bg-indigo-50 text-indigo-600 border border-indigo-100";
      case "question_generator": return "bg-violet-50 text-violet-700 border border-violet-100";
      case "question_voting": return "bg-amber-50 text-amber-700 border border-amber-100";
      case "one_line_share": return "bg-rose-50 text-rose-700 border border-rose-100";
    }
  }

  function cardAccentBorder(room: UnifiedRoom): string {
    switch (room.activity_type) {
      case "question_generator": return "border-violet-300 hover:border-violet-400";
      case "question_voting": return "border-amber-300 hover:border-amber-400";
      case "one_line_share": return "border-rose-300 hover:border-rose-400";
      case "outline_builder":
      default: return "border-indigo-300 hover:border-indigo-400";
    }
  }

  const inactiveTabClass = "text-gray-500 hover:text-gray-700";

  function tabClass(target: TabType, activeBg: string): string {
    return `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
      activeTab === target ? activeBg : inactiveTabClass
    }`;
  }

  function emptyMessage(): string {
    if (activeTab === "all") return "진행 중인 활동 세션이 없습니다.";
    return `진행 중인 ${activityTabMeta(activeTab).label} 세션이 없습니다.`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>🟢</span> 진행 중인 활동 세션 ({activeRooms.length})
        </h2>

        <div className="flex flex-wrap gap-1 bg-gray-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={tabClass("all", "bg-white text-gray-800 shadow-xs")}
          >
            전체 ({activeRooms.length})
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
        <div className="lab-panel lab-empty p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-base text-gray-400">{emptyMessage()}</p>
          <Link
            href={`/dashboard/room/new?class_id=${classId}`}
            className="inline-block mt-3 text-indigo-600 text-sm font-semibold hover:underline"
          >
            새 활동 시작하기 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((room) => {
            const href = `/dashboard/room/${room.id}`;

            return (
              <div
                key={room.id}
                className={`relative bg-white rounded-2xl shadow-2xs hover:shadow-md transition-shadow border-l-4 ${cardAccentBorder(room)} border-gray-200`}
              >
                <div className="absolute top-2.5 right-2.5 z-10 flex gap-1">
                  <EditRoomButton
                    roomId={room.id}
                    title={room.title}
                    topic={room.topic}
                    topicDescription={room.topic_description ?? ""}
                  />
                </div>
                <Link href={href} className="block p-5">
                  <span className="block text-2xl">{cardEmoji(room)}</span>
                  <h3 className="mt-2 font-bold text-gray-800 text-sm leading-snug line-clamp-2 pr-12">{room.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-1">주제: {room.topic}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      진행 중
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${kindChipColor(room)}`}>
                      {kindLabel(room)}
                    </span>
                    {room.subject_type && String(room.subject_type) !== "null" && String(room.subject_type).trim() !== "" && (
                      <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{room.subject_type}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-400 font-medium">
                    {new Date(room.created_at).toLocaleDateString("ko-KR")} 개설
                  </p>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
