"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyStudent, getStudentRoomEntry } from "@/app/actions/student-actions";

type ActivityType = "outline_builder" | "question_generator" | "question_voting";

type EntryMeta = {
  emoji: string;
  title: string;
  subtitle: string;
  helper: string;
  buttonLabel: string;
};

const ENTRY_META: Record<ActivityType, EntryMeta> = {
  outline_builder: {
    emoji: "✏️",
    title: "끄적끄적아지트",
    subtitle: "내 번호와 이름을 입력하고 글 개요 만들기를 시작해요",
    helper: "질문에 차근차근 답하면 내 글의 뼈대를 만들 수 있어요.",
    buttonLabel: "개요 만들기 시작",
  },
  question_generator: {
    emoji: "🃏",
    title: "질문 카드 놀이터",
    subtitle: "내 번호와 이름을 입력하고 질문 카드를 골라봐요",
    helper: "마음에 드는 질문 카드를 골라 오늘 주제에 맞는 나만의 질문으로 바꿔볼 거예요.",
    buttonLabel: "질문 카드 고르기",
  },
  question_voting: {
    emoji: "🗳️",
    title: "좋은 질문 고르기",
    subtitle: "내 번호와 이름을 입력하고 가장 좋은 질문을 골라요",
    helper: "친구들이 만든 질문을 읽고 가장 생각해보고 싶은 질문을 선택해요.",
    buttonLabel: "질문 고르러 가기",
  },
};

export default function RoomEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = use(params);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>("outline_builder");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    let active = true;

    getStudentRoomEntry(roomId).then((data) => {
      if (!active || !data) return;
      const type = data.activity_type;
      if (type === "question_generator" || type === "question_voting") {
        setActivityType(type);
      } else {
        setActivityType("outline_builder");
      }
      setTopic(data.topic ?? "");
    });

    return () => {
      active = false;
    };
  }, [roomId]);

  const entryMeta = useMemo(() => ENTRY_META[activityType], [activityType]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const number = parseInt(String(fd.get("number")));
    const name = String(fd.get("name")).trim();

    const result = await verifyStudent(roomId, number, name);

    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    if (result.status === "done") {
      router.push(`/room/${roomId}/result?session=${result.sessionId}`);
    } else {
      router.push(`/room/${roomId}/activity?session=${result.sessionId}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{entryMeta.emoji}</div>
          <h1 className="text-2xl font-bold text-gray-800">{entryMeta.title}</h1>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">{entryMeta.subtitle}</p>
          {topic && (
            <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
              오늘 주제: <strong>{topic}</strong>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">{entryMeta.helper}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">출석 번호</label>
            <input
              name="number"
              type="number"
              required
              min={1}
              max={50}
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-2xl font-bold text-center focus:outline-none focus:border-orange-400"
              placeholder="15"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              name="name"
              type="text"
              required
              autoComplete="off"
              className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-xl font-bold text-center focus:outline-none focus:border-orange-400"
              placeholder="홍길동"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-2">⚠️</p>
              <p className="text-red-600 text-sm whitespace-pre-line font-medium">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-4 bg-orange-400 text-white rounded-2xl font-bold text-lg hover:bg-orange-500 disabled:opacity-50 transition-colors"
          >
            {pending ? "확인 중..." : `${entryMeta.buttonLabel} 🚀`}
          </button>
        </form>
      </div>
    </div>
  );
}
