"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveWordGameProgress, submitWordGame } from "@/app/actions/student-actions";
import type { WordGameConfig, WordGameSubmission } from "@/features/activities/types";

type WordGamePlayerProps = {
  roomId: string;
  sessionId: string;
  topic: string;
  config: WordGameConfig;
  existingSubmission: WordGameSubmission | null;
  serverStartedAt: string;
};

export function WordGamePlayer({
  roomId,
  sessionId,
  topic,
  config,
  existingSubmission,
  serverStartedAt,
}: WordGamePlayerProps) {
  const router = useRouter();
  const questions = config.questions;
  const [currentIndex, setCurrentIndex] = useState(existingSubmission?.currentIndex ?? 0);
  const [answers, setAnswers] = useState(existingSubmission?.answers ?? []);
  const [usedHints, setUsedHints] = useState(existingSubmission?.usedHints ?? 0);
  const [score, setScore] = useState(existingSubmission?.score ?? 0);
  const [correctCount, setCorrectCount] = useState(existingSubmission?.correctCount ?? 0);
  const [wrongCount, setWrongCount] = useState(existingSubmission?.wrongCount ?? 0);
  const startedAt = serverStartedAt;
  const [alreadyExpired] = useState(
    () => getNowMs() - new Date(serverStartedAt).getTime() >= config.timeLimit * 1000
  );
  const [remainingSeconds, setRemainingSeconds] = useState(config.timeLimit);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [revealedChoices, setRevealedChoices] = useState<string[] | null>(null);
  const [feedback, setFeedback] = useState<null | { correct: boolean; answer: string }>(null);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);
  const questionStartRef = useRef<number>(0);
  const finishedRef = useRef(false);

  const currentQuestion = questions[currentIndex] ?? null;
  const teamLabel = useMemo(() => {
    if (config.mode !== "team") return null;
    return currentIndex % 2 === 0 ? "팀 점수 반영 중" : "우리 팀 추격 중";
  }, [config.mode, currentIndex]);

  useEffect(() => {
    startTimeRef.current = new Date(serverStartedAt).getTime();
    questionStartRef.current = getNowMs();
  }, [serverStartedAt]);

  useEffect(() => {
    if (alreadyExpired) {
      void handleFinish(config.timeLimit * 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyExpired]);

  async function handleFinish(forcedElapsedMs?: number, cachedSubmission?: WordGameSubmission) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSubmitting(true);

    const finalSubmission = cachedSubmission ?? {
      answers,
      startedAt,
      completedAt: getNowIso(),
      elapsedMs: forcedElapsedMs ?? (getNowMs() - startTimeRef.current),
      usedHints,
      currentIndex: questions.length,
      totalQuestions: questions.length,
      teamId: null,
      score,
      correctCount,
      wrongCount,
    } satisfies WordGameSubmission;

    const result = await submitWordGame(sessionId, roomId, finalSubmission);
    if (result.error) {
      finishedRef.current = false;
      setSubmitting(false);
      return;
    }

    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  useEffect(() => {
    if (finishedRef.current) return;
    const interval = window.setInterval(() => {
      const elapsed = getNowMs() - startTimeRef.current;
      const nextRemaining = Math.max(0, config.timeLimit - Math.floor(elapsed / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining === 0) {
        void handleFinish(elapsed);
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [config.timeLimit]);

  async function persistProgress(nextSubmission: WordGameSubmission) {
    startTransition(() => {
      void saveWordGameProgress(sessionId, roomId, nextSubmission);
    });
  }

  function buildSubmission(
    nextAnswers: WordGameSubmission["answers"],
    nextScore: number,
    nextCorrectCount: number,
    nextWrongCount: number,
    nextIndex: number,
    elapsedOverride: number
  ) {
    return {
      answers: nextAnswers,
      startedAt,
      completedAt: null,
      elapsedMs: elapsedOverride,
      usedHints,
      currentIndex: nextIndex,
      totalQuestions: questions.length,
      teamId: null,
      score: nextScore,
      correctCount: nextCorrectCount,
      wrongCount: nextWrongCount,
    } satisfies WordGameSubmission;
  }

  async function handleSelectChoice(choice: string) {
    if (!currentQuestion || feedback || submitting) return;
    const isCorrect = choice === currentQuestion.answer;
    const now = getNowMs();
    const responseMs = now - questionStartRef.current;
    const nextAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        selectedChoice: choice,
        isCorrect,
        usedHint: Boolean(revealedChoices),
        answeredAt: new Date().toISOString(),
        responseMs,
      },
    ];
    const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
    const nextWrongCount = wrongCount + (isCorrect ? 0 : 1);
    const nextScore = score + (isCorrect ? (revealedChoices ? 70 : 100) : 0);
    const nextIndex = currentIndex + 1;

    setSelectedChoice(choice);
    setFeedback({ correct: isCorrect, answer: currentQuestion.answer });
    setAnswers(nextAnswers);
    setCorrectCount(nextCorrectCount);
    setWrongCount(nextWrongCount);
    setScore(nextScore);

    const nextSubmission = buildSubmission(
      nextAnswers,
      nextScore,
      nextCorrectCount,
      nextWrongCount,
      nextIndex,
      now - startTimeRef.current
    );
    await persistProgress(nextSubmission);

    window.setTimeout(() => {
      if (nextIndex >= questions.length) {
        void handleFinish(getNowMs() - startTimeRef.current, nextSubmission);
        return;
      }
      setSelectedChoice(null);
      setRevealedChoices(null);
      setFeedback(null);
      questionStartRef.current = getNowMs();
      setCurrentIndex(nextIndex);
    }, 700);
  }

  function handleHint() {
    if (!currentQuestion || revealedChoices || !config.allowHints) return;
    const firstIncorrect = currentQuestion.choices.find((choice) => choice !== currentQuestion.answer);
    const visible = currentQuestion.choices.filter((choice) => choice === currentQuestion.answer || choice === firstIncorrect);
    setRevealedChoices(visible.length >= 2 ? visible : currentQuestion.choices.slice(0, 2));
    setUsedHints((prev) => prev + 1);
  }

  if (alreadyExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="rounded-3xl bg-white p-8 shadow-xl text-center">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-base font-bold text-gray-700">게임이 이미 종료되었습니다</p>
          <p className="mt-2 text-sm text-gray-500">결과 화면으로 이동할게요.</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="rounded-3xl bg-white p-8 shadow-xl text-center">
          <p className="text-sm text-gray-500">문제를 불러오는 중이에요.</p>
        </div>
      </div>
    );
  }

  const visibleChoices = revealedChoices ?? currentQuestion.choices;
  const progressPercent = Math.round((Math.min(currentIndex, questions.length) / Math.max(questions.length, 1)) * 100);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe,transparent_35%),linear-gradient(135deg,#eff6ff,#eef2ff)] p-4">
      <div className="mx-auto max-w-4xl space-y-4 pt-4 pb-10">
        <div className="rounded-[2rem] border border-sky-100 bg-white/95 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-500">Speed Match</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{topic || "필수 어휘 스피드 매치"}</h1>
              {teamLabel && <p className="mt-1 text-sm text-indigo-600">{teamLabel}</p>}
            </div>
            <div className="flex gap-2 text-sm">
              <Badge label={`남은 시간 ${remainingSeconds}초`} tone="sky" />
              <Badge label={`점수 ${score}`} tone="amber" />
              <Badge label={`${currentIndex + 1}/${questions.length} 문제`} tone="slate" />
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">{currentQuestion.category} · 난이도 {currentQuestion.level}</p>
                <h2 className="mt-3 text-xl font-bold leading-relaxed text-slate-900">{currentQuestion.prompt}</h2>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">뜻을 보고 단어 고르기</span>
            </div>

            <div className="mt-6 grid gap-3">
              {visibleChoices.map((choice) => {
                const isPicked = selectedChoice === choice;
                const isCorrectChoice = feedback?.answer === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => void handleSelectChoice(choice)}
                    disabled={Boolean(feedback) || submitting}
                    className={[
                      "rounded-2xl border px-5 py-4 text-left text-lg font-semibold transition-all",
                      isCorrectChoice
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : isPicked
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50",
                    ].join(" ")}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${feedback.correct ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {feedback.correct ? "정답이에요! 팀 점수에도 반영되고 있어요." : `아쉽지만 정답은 "${feedback.answer}"이에요.`}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] bg-white p-5 shadow-xl">
              <p className="text-sm font-bold text-slate-800">내 진행 현황</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <SmallStat label="정답" value={String(correctCount)} tone="emerald" />
                <SmallStat label="오답" value={String(wrongCount)} tone="rose" />
                <SmallStat label="힌트" value={String(usedHints)} tone="amber" />
                <SmallStat label="남은 문제" value={String(Math.max(questions.length - currentIndex - (feedback ? 1 : 0), 0))} tone="indigo" />
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-5 shadow-xl">
              <p className="text-sm font-bold text-slate-800">도움 장치</p>
              <button
                type="button"
                onClick={handleHint}
                disabled={!config.allowHints || Boolean(revealedChoices) || Boolean(feedback)}
                className="mt-3 w-full rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                보기 좁히기 힌트
              </button>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                힌트를 쓰면 정답 점수는 조금 줄지만, 끝까지 완주하면 팀 보너스에 계속 기여해요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getNowMs() {
  return Date.now();
}

function getNowIso() {
  return new Date().toISOString();
}

function Badge({ label, tone }: { label: string; tone: "sky" | "amber" | "slate" }) {
  const styles = {
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return <span className={`rounded-full px-3 py-1.5 font-semibold ${styles}`}>{label}</span>;
}

function SmallStat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "amber" | "indigo" }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];

  return (
    <div className={`rounded-2xl px-4 py-3 ${styles}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
