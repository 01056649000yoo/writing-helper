"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyStudent } from "@/app/actions/student-actions";

type ActivityType = "outline_builder" | "question_generator" | "question_voting" | "one_line_share" | "word_game";

type EntryShellProps = {
  roomId: string;
  topic: string;
};

export function RoomEntryClient({
  roomId,
  activityType,
  topic,
}: EntryShellProps & {
  activityType: ActivityType;
}) {
  if (activityType === "question_generator") {
    return <QuestionGeneratorEntry roomId={roomId} topic={topic} />;
  }

  if (activityType === "question_voting") {
    return <QuestionVotingEntry roomId={roomId} topic={topic} />;
  }

  if (activityType === "one_line_share") {
    return <OneLineShareEntry roomId={roomId} topic={topic} />;
  }

  if (activityType === "word_game") {
    return <WordGameEntry roomId={roomId} topic={topic} />;
  }

  return <OutlineBuilderEntry roomId={roomId} topic={topic} />;
}

function OutlineBuilderEntry({ roomId, topic }: EntryShellProps) {
  return (
    <EntryShell
      roomId={roomId}
      topic={topic}
      shellClassName="from-yellow-50 to-orange-100"
      topicClassName="bg-orange-50 text-orange-700"
      buttonClassName="bg-orange-400 hover:bg-orange-500"
      inputFocusClassName="focus:border-orange-400"
      emoji="✏️"
      title="아지트 글쓰기 연구소"
      subtitle="내 번호와 이름을 입력하고 글 개요 만들기를 시작해요"
      helper="질문에 차근차근 답하면 내 글의 뼈대를 만들 수 있어요."
      buttonLabel="개요 만들기 시작"
    />
  );
}

function QuestionGeneratorEntry({ roomId, topic }: EntryShellProps) {
  return (
    <EntryShell
      roomId={roomId}
      topic={topic}
      shellClassName="from-sky-50 to-cyan-100"
      topicClassName="bg-sky-50 text-sky-700"
      buttonClassName="bg-sky-500 hover:bg-sky-600"
      inputFocusClassName="focus:border-sky-400"
      emoji="❓"
      title="질문 만들기 놀이터"
      subtitle="내 번호와 이름을 입력하고 나에게 맞는 방법으로 질문을 만들어요"
      helper="직접 질문을 만들 수도 있고, 질문 카드의 도움을 받아 바꿔볼 수도 있어요."
      buttonLabel="질문 만들러 가기"
    />
  );
}

function QuestionVotingEntry({ roomId, topic }: EntryShellProps) {
  return (
    <EntryShell
      roomId={roomId}
      topic={topic}
      shellClassName="from-violet-50 to-indigo-100"
      topicClassName="bg-violet-50 text-violet-700"
      buttonClassName="bg-violet-500 hover:bg-violet-600"
      inputFocusClassName="focus:border-violet-400"
      emoji="🗳️"
      title="좋은 질문 고르기"
      subtitle="내 번호와 이름을 입력하고 가장 좋은 질문을 골라요"
      helper="친구들이 만든 질문을 읽고 가장 생각해보고 싶은 질문을 선택해요."
      buttonLabel="질문 고르러 가기"
    />
  );
}

function OneLineShareEntry({ roomId, topic }: EntryShellProps) {
  return (
    <EntryShell
      roomId={roomId}
      topic={topic}
      shellClassName="from-rose-50 to-pink-100"
      topicClassName="bg-rose-50 text-rose-700"
      buttonClassName="bg-rose-500 hover:bg-rose-600"
      inputFocusClassName="focus:border-rose-400"
      emoji="💬"
      title="한줄모아"
      subtitle="내 번호와 이름을 입력하고 핵심단어를 담은 한 줄을 나눠요"
      helper="한 줄을 쓰고 나면 친구 문장을 읽으며 좋아요로 반응할 수 있어요."
      buttonLabel="한줄모아 시작"
    />
  );
}

function WordGameEntry({ roomId, topic }: EntryShellProps) {
  return (
    <EntryShell
      roomId={roomId}
      topic={topic}
      shellClassName="from-sky-50 to-indigo-100"
      topicClassName="bg-sky-50 text-sky-700"
      buttonClassName="bg-indigo-500 hover:bg-indigo-600"
      inputFocusClassName="focus:border-indigo-400"
      emoji="🎯"
      title="스피드 매치"
      subtitle="번호와 이름을 입력하고 제한 시간 안에 필수 어휘를 빠르게 맞혀 보세요"
      helper="힌트와 회복 보너스가 있어서 끝까지 도전하기 좋아요."
      buttonLabel="게임 시작"
    />
  );
}

function EntryShell({
  roomId,
  topic,
  shellClassName,
  topicClassName,
  buttonClassName,
  inputFocusClassName,
  emoji,
  title,
  subtitle,
  helper,
  buttonLabel,
}: EntryShellProps & {
  shellClassName: string;
  topicClassName: string;
  buttonClassName: string;
  inputFocusClassName: string;
  emoji: string;
  title: string;
  subtitle: string;
  helper: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");

    try {
      const fd = new FormData(e.currentTarget);
      const number = parseInt(String(fd.get("number")));
      const name = String(fd.get("name")).trim();

      const result = await verifyStudent(roomId, number, name);

      if (result.error) {
        setError(result.error);
        setPending(false);
        return;
      }

      if (!result.sessionId) {
        setError("학생 세션을 만들지 못했습니다. 선생님께 다시 확인해주세요.");
        setPending(false);
        return;
      }

      if (result.status === "done") {
        router.push(`/room/${roomId}/result?session=${result.sessionId}`);
      } else {
        router.push(`/room/${roomId}/activity?session=${result.sessionId}`);
      }
    } catch {
      setError("입장 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setPending(false);
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${shellClassName} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{emoji}</div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">{subtitle}</p>
          {topic && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${topicClassName}`}>
              오늘 주제: <strong>{topic}</strong>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">{helper}</p>
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
              className={`w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-2xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none ${inputFocusClassName}`}
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
              className={`w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none ${inputFocusClassName}`}
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
            className={`w-full py-4 text-white rounded-2xl font-bold text-lg disabled:opacity-50 transition-colors ${buttonClassName}`}
          >
            {pending ? "확인 중..." : `${buttonLabel} 🚀`}
          </button>
        </form>
      </div>
    </div>
  );
}
