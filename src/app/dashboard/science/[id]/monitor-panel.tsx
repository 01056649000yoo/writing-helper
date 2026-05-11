"use client";

import { useEffect, useState, startTransition } from "react";
import {
  getScienceRoomSessions,
  getScienceRoomReviews,
} from "@/app/actions/science-actions";
import {
  SENSE_META,
  REACTION_META,
  type ScienceSession,
  type ScienceReview,
  type ScienceReaction,
} from "@/types/science";

// ── helpers ─────────────────────────────────────────────────────────────────

function reactionCounts(
  sessionId: string,
  reviews: ScienceReview[],
): Record<ScienceReaction, number> {
  const all: ScienceReaction[] = ["agree", "differ", "discovery"];
  return Object.fromEntries(
    all.map((r) => [
      r,
      reviews.filter(
        (rv) => rv.target_session_id === sessionId && rv.reaction === r,
      ).length,
    ]),
  ) as Record<ScienceReaction, number>;
}

// ── StepBadge ────────────────────────────────────────────────────────────────

function StepBadge({ step, status }: { step: number; status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        ✅ 완료
      </span>
    );
  }
  const labels: Record<number, string> = {
    1: "1단계 관찰",
    2: "2단계 추론",
    3: "3단계 질문",
  };
  const colors: Record<number, string> = {
    1: "bg-sky-100 text-sky-700",
    2: "bg-violet-100 text-violet-700",
    3: "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${colors[step] ?? "bg-gray-100 text-gray-600"}`}
    >
      {labels[step] ?? `${step}단계`} 진행 중
    </span>
  );
}

// ── SessionCard ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  counts,
}: {
  session: ScienceSession;
  counts: Record<ScienceReaction, number>;
}) {
  const reached2 = session.current_step >= 2 || session.status === "done";
  const reached3 = session.current_step >= 3 || session.status === "done";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-800">
            {session.student_number}번
          </span>
          <span className="text-sm text-gray-500">{session.student_name}</span>
        </div>
        <StepBadge step={session.current_step} status={session.status} />
      </div>

      {/* body */}
      <div className="p-5 space-y-3">
        {/* 1단계 관찰 */}
        {reached2 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
              🔍 관찰
            </p>
            {session.before_state && (
              <p className="text-sm text-gray-600">
                <span className="text-xs text-gray-400">전 </span>
                {session.before_state}
              </p>
            )}
            {session.after_state && (
              <p className="text-sm text-gray-600">
                <span className="text-xs text-gray-400">후 </span>
                {session.after_state}
              </p>
            )}
            {session.sense_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {session.sense_tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full"
                  >
                    {SENSE_META[tag.sense]?.emoji} {tag.text}
                  </span>
                ))}
              </div>
            )}
            {session.measurements.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {session.measurements.map((m, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {m.label}: {m.value} {m.unit}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">관찰 작성 중...</p>
        )}

        {/* 2단계 추론 */}
        {reached3 && session.inference_text && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
              💡 추론
            </p>
            <p className="text-sm text-gray-600">{session.inference_text}</p>
            {session.counter_text && (
              <p className="text-sm text-gray-500 italic">
                반대 생각: {session.counter_text}
              </p>
            )}
          </div>
        )}

        {/* 3단계 질문 */}
        {session.status === "done" && session.question_text && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              ❓ 질문
            </p>
            <p className="text-sm text-gray-600">{session.question_text}</p>
          </div>
        )}

        {/* reactions */}
        {counts.agree + counts.differ + counts.discovery > 0 && (
          <div className="flex gap-2 pt-2 border-t border-gray-50">
            {(Object.entries(counts) as [ScienceReaction, number][]).map(
              ([r, n]) =>
                n > 0 ? (
                  <span
                    key={r}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${REACTION_META[r].color}`}
                  >
                    {REACTION_META[r].emoji} {n}
                  </span>
                ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScienceMonitorPanel (exported) ───────────────────────────────────────────

interface Props {
  roomId: string;
  isActive: boolean;
  initialSessions: ScienceSession[];
  initialReviews: ScienceReview[];
}

export default function ScienceMonitorPanel({
  roomId,
  isActive,
  initialSessions,
  initialReviews,
}: Props) {
  const [sessions, setSessions] = useState<ScienceSession[]>(initialSessions);
  const [reviews, setReviews] = useState<ScienceReview[]>(initialReviews);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    const run = async () => {
      const [newSessions, newReviews] = await Promise.all([
        getScienceRoomSessions(roomId),
        getScienceRoomReviews(roomId),
      ]);
      if (cancelled) return;
      startTransition(() => {
        setSessions(newSessions);
        setReviews(newReviews);
        setLastUpdated(new Date());
      });
    };

    const interval = setInterval(() => void run(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, isActive]);

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-white/70 p-10 text-center">
        <p className="text-4xl mb-3">🧑‍🔬</p>
        <p className="text-gray-500 text-sm">아직 참여한 학생이 없습니다.</p>
        {isActive && (
          <p className="text-xs text-gray-400 mt-1">
            학생이 접속하면 자동으로 업데이트됩니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-700">
          학생 활동 현황
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({sessions.length}명)
          </span>
        </h2>
        {isActive && lastUpdated && (
          <p className="text-xs text-gray-400">
            마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions
          .slice()
          .sort((a, b) => a.student_number - b.student_number)
          .map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              counts={reactionCounts(s.id, reviews)}
            />
          ))}
      </div>
    </div>
  );
}
