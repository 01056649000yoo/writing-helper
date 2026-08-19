"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStudentResult, toggleHanjaWritingReaction, toggleOneLineReaction } from "@/app/actions/student-actions";
import { OneLineShareBoard, OneLineShareTopThree } from "@/components/one-line-share-board";
import { deterministicShuffle } from "@/lib/anonymous-order";
import {
  QuestionVotingCompactList,
  QuestionVotingTopThree,
} from "@/components/question-voting-ranking-summary";
import type {
  ActivityType,
  HanjaWritingBoardEntry,
  HanjaWritingConfig,
  OneLineShareBoardEntry,
  OneLineShareConfig,
  OutlineTemplateAnswer,
  QuestionGeneratorSubmission,
  QuestionVotingConfig,
  QuestionVotingSubmission,
} from "@/features/activities/types";

export default function StudentResultPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const [outlineAnswers, setOutlineAnswers] = useState<OutlineTemplateAnswer[]>([]);
  const [studentName, setStudentName] = useState("");
  const [topic, setTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("outline_builder");
  const [questionSubmission, setQuestionSubmission] = useState<QuestionGeneratorSubmission | null>(null);
  const [anonymousPeerQuestions, setAnonymousPeerQuestions] = useState<Array<{ id: string; order: number; questionOrder: number; text: string }>>([]);
  const [questionVotingSubmission, setQuestionVotingSubmission] = useState<QuestionVotingSubmission | null>(null);
  const [questionVotingConfig, setQuestionVotingConfig] = useState<QuestionVotingConfig | null>(null);
  const [questionVotingRanking, setQuestionVotingRanking] = useState<Array<{ questionId: string; text: string; votes: number }>>([]);
  const [questionVotingClosed, setQuestionVotingClosed] = useState(false);
  const [oneLineShareConfig, setOneLineShareConfig] = useState<OneLineShareConfig | null>(null);
  const [oneLineShareEntry, setOneLineShareEntry] = useState<{ entryId: string; content: string; containsKeywords: boolean; createdAt: string; updatedAt: string } | null>(null);
  const [oneLineShareBoard, setOneLineShareBoard] = useState<OneLineShareBoardEntry[]>([]);
  const [oneLineShareClosed, setOneLineShareClosed] = useState(false);
  const [hanjaWritingConfig, setHanjaWritingConfig] = useState<HanjaWritingConfig | null>(null);
  const [hanjaWritingEntry, setHanjaWritingEntry] = useState<{ contents: string[] } | null>(null);
  const [hanjaWritingBoard, setHanjaWritingBoard] = useState<HanjaWritingBoardEntry[]>([]);
  const [reactionPendingEntryId, setReactionPendingEntryId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  useEffect(() => {
    if (!sessionId || !roomId) return;
    getStudentResult(sessionId, roomId).then((data) => {
      if (!data) {
        setLoadError("내 활동 결과만 확인할 수 있어요.");
        setLoaded(true);
        return;
      }

      const rawAnswers = (data as { outlineAnswers?: unknown }).outlineAnswers;
      setOutlineAnswers(
        Array.isArray(rawAnswers)
          ? (rawAnswers as OutlineTemplateAnswer[]).filter(
              (a) => a && typeof a === "object" && (a.section === "처음" || a.section === "가운데" || a.section === "끝")
            )
          : []
      );
      setStudentName(data.studentName ?? "");
      setTopic(data.topic ?? "");
      setActivityType((data.activityType as ActivityType) ?? "outline_builder");
      setQuestionSubmission(data.questionGeneratorSubmission ?? null);
      setAnonymousPeerQuestions(data.anonymousPeerQuestions ?? []);
      setQuestionVotingSubmission(data.questionVotingSubmission ?? null);
      setQuestionVotingConfig(data.questionVotingConfig ?? null);
      setQuestionVotingRanking(data.questionVotingRanking ?? []);
      setQuestionVotingClosed(data.questionVotingClosed ?? false);
      setOneLineShareConfig(data.oneLineShareConfig ?? null);
      setOneLineShareEntry(data.oneLineShareEntry ?? null);
      setOneLineShareBoard(data.oneLineShareBoard ?? []);
      setOneLineShareClosed(data.oneLineShareClosed ?? false);
      setHanjaWritingConfig(data.hanjaWritingConfig ?? null);
      setHanjaWritingEntry(data.hanjaWritingEntry ?? null);
      setHanjaWritingBoard(data.hanjaWritingBoard ?? []);
      setLoaded(true);
    }).catch(() => {
      setLoadError("결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      setLoaded(true);
    });
  }, [sessionId, roomId]);

  const outlineText = useMemo(() => {
    if (outlineAnswers.length === 0) return "";
    const order: OutlineTemplateAnswer["section"][] = ["처음", "가운데", "끝"];
    return order
      .map((section) => {
        const items = outlineAnswers.filter((a) => a.section === section);
        if (items.length === 0) return null;
        const lines = items.map((a) => `- ${a.label}: ${a.answer}`).join("\n");
        return `[${section}]\n${lines}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }, [outlineAnswers]);

  const currentText = useMemo(() => {
    if (activityType === "question_generator") {
      return questionSubmission?.selections.map((selection) => selection.remixedQuestion).join("\n") ?? "";
    }
    return outlineText;
  }, [activityType, outlineText, questionSubmission]);

  const selectedVotingQuestions = useMemo(() => {
    if (!questionVotingSubmission || !questionVotingConfig) return [];
    const questionMap = new Map(questionVotingConfig.sourceQuestions.map((question) => [question.id, question.text] as const));
    return questionVotingSubmission.selectedQuestionIds.map((questionId) => ({
      id: questionId,
      text: questionMap.get(questionId) ?? "질문을 찾을 수 없어요.",
    }));
  }, [questionVotingConfig, questionVotingSubmission]);

  const usedReactionCount = useMemo(
    () => oneLineShareBoard.filter((entry) => entry.likedByCurrentSession).length,
    [oneLineShareBoard],
  );
  const peerOneLineEntries = useMemo(
    () => oneLineShareBoard.filter((entry) => !entry.isMine),
    [oneLineShareBoard],
  );
  const hanjaReactionCount = useMemo(
    () => hanjaWritingBoard.filter((entry) => entry.likedByCurrentSession).length,
    [hanjaWritingBoard],
  );
  const peerHanjaEntries = useMemo(
    () => hanjaWritingBoard.filter((entry) => !entry.isMine),
    [hanjaWritingBoard],
  );
  const myHanjaEntries = useMemo(
    () => hanjaWritingBoard.filter((entry) => entry.isMine).sort((left, right) => left.sentenceIndex - right.sentenceIndex),
    [hanjaWritingBoard],
  );
  const topHanjaEntries = useMemo(
    () => peerHanjaEntries.slice(0, 5),
    [peerHanjaEntries],
  );
  const shuffledPeerHanjaEntries = useMemo(
    () => deterministicShuffle(
      peerHanjaEntries,
      `${roomId}:${sessionId}:hanja-peer-order`,
      (entry) => entry.entryId,
    ),
    [peerHanjaEntries, roomId, sessionId],
  );

  function copyCurrentText() {
    if (!currentText) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(currentText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
      return;
    }

    const el = document.createElement("textarea");
    el.value = currentText;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⏳</div>
          <p className="text-gray-500">결과를 불러오고 있어요...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-5xl" aria-hidden="true">🔒</div>
          <h1 className="text-xl font-bold text-gray-800">결과를 열 수 없어요</h1>
          <p className="mt-3 text-sm text-gray-600">{loadError}</p>
          <Link
            href={roomId ? `/room/${roomId}` : "/"}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 font-bold text-white"
          >
            활동 입장으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (activityType === "question_generator" && questionSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
        <div className="w-full max-w-[1200px] mx-auto pt-8 pb-16 space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🃏</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">질문 완성!</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    <strong className="text-sky-600">{studentName}</strong>의{" "}
                    <strong>{topic}</strong> 질문 만들기 활동
                  </p>
                </div>
              </div>
              {/* 제출 뒤 고치는 길을 맨 위에 둔다 — 결과를 보고 바로 고치고 싶어진다. */}
              <Link
                href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
                className="rounded-2xl bg-sky-500 px-6 py-3 text-center font-bold text-white transition-colors hover:bg-sky-600"
              >
                ✏️ 질문 고치기
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          {questionSubmission.selections.map((selection, index) => (
            <div key={selection.id} className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-sky-600 uppercase tracking-wide">
                    질문 {index + 1}
                  </p>
                  <h2 className="text-lg font-bold text-gray-800 mt-1">{selection.cardSetLabel}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {selection.method === "direct" ? "직접 질문 만들기" : "질문 카드로 바꾸기"}
                  </p>
                </div>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  내 질문
                </span>
              </div>

              {selection.originalPrompt && (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{selection.originalPrompt}</p>
                </div>
              )}

              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-xs font-semibold text-sky-700 mb-2">오늘 주제에 맞게 바꾼 질문</p>
                <p className="text-base font-medium text-sky-950 leading-relaxed">{selection.remixedQuestion}</p>
              </div>

            </div>
          ))}
          </div>

          <button
            onClick={copyCurrentText}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
              copied ? "bg-green-500 text-white" : "bg-white text-sky-700 border border-sky-200 hover:bg-sky-50"
            }`}
          >
            {copied ? "✅ 복사됐어요!" : "📋 내 질문 복사하기"}
          </button>

          <div className="bg-white rounded-3xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">우리 반 질문 함께 보기</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">친구들이 만든 질문</h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                익명 공개
              </span>
            </div>

            {anonymousPeerQuestions.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-violet-50 px-4 py-4 text-sm leading-relaxed text-violet-700">
                아직 다른 친구 질문이 없어요. 친구들이 제출하면 여기에 익명으로 함께 보입니다.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {anonymousPeerQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-xs font-semibold text-violet-600">친구 질문 {index + 1}</p>
                    <p className="mt-2 text-sm leading-relaxed text-violet-950">{question.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activityType === "question_voting" && questionVotingSubmission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-2">🗳️</div>
            <h1 className="text-2xl font-bold text-gray-800">좋은 질문 평가 완료!</h1>
            <p className="text-gray-500 mt-1 text-sm">
              <strong className="text-violet-600">{studentName}</strong>의{" "}
              <strong>{topic}</strong> 활동 결과
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">내가 고른 질문</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">좋은 질문으로 선택한 질문</h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                {selectedVotingQuestions.length}개 선택
              </span>
            </div>

            {selectedVotingQuestions.map((question, index) => (
              <div key={question.id} className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs font-semibold text-violet-600">선택한 질문 {index + 1}</p>
                <p className="mt-2 text-base font-medium leading-relaxed text-violet-950">{question.text}</p>
              </div>
            ))}
          </div>

          {!questionVotingClosed && (
            <Link
              href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
              className="block w-full rounded-2xl border border-violet-200 bg-white py-4 text-center font-bold text-violet-700 transition-colors hover:bg-violet-50"
            >
              ✏️ 선택 다시 수정하기
            </Link>
          )}

          {questionVotingClosed && questionVotingRanking.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-500">최종 결과</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-800">우리 반이 고른 좋은 질문</h2>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  활동 종료
                </span>
              </div>
              <QuestionVotingTopThree ranking={questionVotingRanking} />
              <QuestionVotingCompactList ranking={questionVotingRanking} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activityType === "one_line_share" && oneLineShareConfig && oneLineShareEntry) {
    async function handleToggleReaction(entryId: string) {
      setReactionPendingEntryId(entryId);
      const result = await toggleOneLineReaction(sessionId, roomId, entryId);
      if (result.entries) {
        setOneLineShareBoard(result.entries);
      }
      setReactionPendingEntryId(null);
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4">
        <div className="max-w-3xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-2">💬</div>
            <h1 className="text-2xl font-bold text-gray-800">한줄모아</h1>
            <p className="text-gray-500 mt-1 text-sm">
              <strong className="text-rose-600">{studentName}</strong>의{" "}
              <strong>{topic}</strong> 활동 결과
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rose-500">내가 쓴 한 줄</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">오늘의 한 문장</h2>
              </div>
              {oneLineShareEntry.containsKeywords && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  핵심단어 포함
                </span>
              )}
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-base font-medium leading-relaxed text-rose-950">{oneLineShareEntry.content}</p>
            </div>
          </div>

          {peerOneLineEntries.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-500">우리 반 한줄모아</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-800">친구들이 쓴 한 줄</h2>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  좋아요 {usedReactionCount}/{oneLineShareConfig.maxReactionsPerStudent}
                </span>
              </div>
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                내 한 줄은 위에서 확인하고, 여기서는 친구들 문장만 편하게 읽으면서 좋아요를 남길 수 있어요.
              </div>
              <OneLineShareTopThree entries={peerOneLineEntries} />
              <OneLineShareBoard
                entries={peerOneLineEntries}
                interactive
                closed={oneLineShareClosed}
                maxReactionsPerStudent={oneLineShareConfig.maxReactionsPerStudent}
                currentReactionCount={usedReactionCount}
                onToggleLike={handleToggleReaction}
                pendingEntryId={reactionPendingEntryId}
              />
            </div>
          )}

          <Link
            href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
            className="block w-full rounded-2xl border border-rose-200 bg-white py-4 text-center font-bold text-rose-700 transition-colors hover:bg-rose-50"
          >
            ✏️ 한 줄 다시 수정하기
          </Link>

        </div>
      </div>
    );
  }

  if (activityType === "hanja_writing" && hanjaWritingConfig) {
    const card = hanjaWritingConfig.card;
    async function handleToggleHanjaReaction(targetSessionId: string, targetSentenceIndex: number, entryId: string) {
      setReactionPendingEntryId(entryId);
      const result = await toggleHanjaWritingReaction(sessionId, roomId, targetSessionId, targetSentenceIndex);
      if (result.entries) {
        setHanjaWritingBoard(result.entries);
      }
      setReactionPendingEntryId(null);
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <div className="max-w-3xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-2">📜</div>
            <h1 className="text-2xl font-bold text-gray-800">문장 완성!</h1>
            <p className="text-gray-500 mt-1 text-sm">
              <strong className="text-amber-600">{studentName}</strong>의 한자 활용 문장
            </p>
          </div>

          {hanjaWritingEntry && (
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-amber-600">내가 만든 문장 ({card.word})</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                    받은 좋아요 합계 {myHanjaEntries.reduce((sum, entry) => sum + entry.likeCount, 0)}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {hanjaWritingEntry.contents.map((content, index) => {
                    const myEntry = myHanjaEntries.find((entry) => entry.sentenceIndex === index);
                    return (
                    <div key={`my-hanja-${index}`} className="rounded-2xl bg-white/80 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-amber-700">문장 {index + 1}</p>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          ❤️ {myEntry?.likeCount ?? 0}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-medium leading-relaxed text-gray-900">{content}</p>
                    </div>
                    );
                  })}
                </div>
              </div>
              <Link
                href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
                className="mt-3 block w-full rounded-2xl border border-amber-200 bg-white py-3 text-center font-semibold text-amber-700 hover:bg-amber-50"
              >
                ✏️ 문장 다시 수정하기
              </Link>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-6">
            {topHanjaEntries.length > 0 && (
              <div className="mb-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Best 5</p>
                    <p className="mt-1 text-base font-bold text-gray-800">좋아요를 많이 받은 문장</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                    상위 {topHanjaEntries.length}문장
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {topHanjaEntries.map((entry, index) => (
                    <div key={`top-hanja-${entry.entryId}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-700">#{index + 1} 인기 문장</p>
                          <p className="mt-2 text-sm leading-relaxed text-gray-800">{entry.content}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          ❤️ {entry.likeCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-gray-800">친구들이 쓴 문장</p>
                <p className="mt-1 text-xs text-gray-500">문장을 읽고 마음에 드는 문장에 좋아요를 남겨 보세요.</p>
              </div>
              <span className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-semibold">
                누른 좋아요 {hanjaReactionCount}/{hanjaWritingConfig.maxReactionsPerStudent}
              </span>
            </div>
            <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              내 문장은 위에서 확인하고, 여기서는 친구들 문장만 반응할 수 있어요.
            </div>
            {shuffledPeerHanjaEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">아직 다른 친구의 문장이 없어요. 조금만 기다려 보세요.</p>
            ) : (
              <div className="space-y-3">
                {shuffledPeerHanjaEntries.map((entry, index) => {
                  const atMax = hanjaReactionCount >= hanjaWritingConfig.maxReactionsPerStudent;
                  const disabled = reactionPendingEntryId === entry.entryId
                    || (atMax && !entry.likedByCurrentSession);
                  return (
                  <div key={entry.entryId} className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500">친구 문장 {index + 1}</p>
                        <p className="mt-2 text-sm leading-relaxed text-gray-800">{entry.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleHanjaReaction(entry.sessionId, entry.sentenceIndex, entry.entryId)}
                        disabled={disabled}
                        title={atMax && !entry.likedByCurrentSession ? `좋아요는 ${hanjaWritingConfig.maxReactionsPerStudent}개까지 누를 수 있어요` : undefined}
                        className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                          entry.likedByCurrentSession
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {reactionPendingEntryId === entry.entryId
                          ? "저장 중..."
                          : `좋아요 ${entry.likeCount}`}
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] text-gray-400">
                      {new Date(entry.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (outlineAnswers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-gray-500">아직 보여줄 결과가 없어요.</p>
        </div>
      </div>
    );
  }

  const sectionOrder: OutlineTemplateAnswer["section"][] = ["처음", "가운데", "끝"];
  const groupedAnswers = sectionOrder
    .map((section) => ({
      section,
      items: outlineAnswers.filter((a) => a.section === section),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="w-full max-w-[1200px] mx-auto pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800">개요 완성!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            <strong className="text-orange-600">{studentName}</strong>의{" "}
            <strong>{topic}</strong> 글쓰기 개요
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {groupedAnswers.map(({ section, items }, sectionIndex) => (
            <div key={section} className={`p-5 ${sectionIndex < groupedAnswers.length - 1 ? "border-b border-gray-100" : ""}`}>
              <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-3">
                ✏️ {section}
              </p>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-orange-50/60 px-4 py-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">{item.label}</p>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{item.answer || "(비어 있음)"}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={copyCurrentText}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors ${
            copied ? "bg-green-500 text-white" : "bg-orange-400 text-white hover:bg-orange-500"
          }`}
        >
          {copied ? "✅ 복사됐어요!" : "📋 개요 복사하기"}
        </button>

        <Link
          href={`/room/${roomId}/activity?session=${sessionId}&edit=1`}
          className="block w-full rounded-2xl border-2 border-orange-200 bg-white py-4 text-center font-bold text-orange-700 hover:bg-orange-50 transition-colors"
        >
          ✏️ 개요 다시 만들기
        </Link>

        <p className="text-center text-xs text-gray-400">
          이 개요를 보면서 글을 완성해봐요 ✍️
        </p>
      </div>
    </div>
  );
}
