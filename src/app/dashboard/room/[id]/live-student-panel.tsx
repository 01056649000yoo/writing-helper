"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { OneLineShareBoard, OneLineShareTopThree } from "@/components/one-line-share-board";
import {
  getOneLineShareRoomResults,
  getQuestionGeneratorRoomResults,
  getQuestionVotingRoomResults,
  getRoomSessions,
} from "@/app/actions/room-actions";
import {
  QuestionVotingCompactList,
  QuestionVotingTopThree,
} from "@/components/question-voting-ranking-summary";

type Student = { id: string; student_number: number; student_name: string };
type Session = {
  id: string;
  student_number: number;
  student_name: string;
  level: string | null;
  status: string;
};
type ActivityType = "outline_builder" | "question_generator" | "question_voting" | "one_line_share";
type QuestionResult = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  selections: Array<{
    id: string;
    method: "direct" | "card_remix";
    cardSetLabel: string;
    originalPrompt: string | null;
    remixedQuestion: string;
    reason?: string;
  }>;
};
type QuestionVotingRanking = Array<{
  questionId: string;
  text: string;
  votes: number;
  reasons: string[];
}>;
type OneLineShareResults = Array<{
  entryId: string;
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  likedByCurrentSession: boolean;
  isMine: boolean;
  containsKeywords: boolean;
  createdAt: string;
  updatedAt: string;
}>;

function levelLabel(level: string) {
  if (!level || level === "null") return "";
  return { low: "도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return {
    low: "bg-orange-100 text-orange-700",
    mid: "bg-blue-100 text-blue-700",
    high: "bg-green-100 text-green-700",
  }[level] ?? "";
}

function StudentQrModal({
  sessionId,
  studentName,
  studentNumber,
  onClose,
}: {
  sessionId: string;
  studentName: string;
  studentNumber: number;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/${sessionId}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#166534", light: "#ffffff" },
    }).then(setQrUrl);
  }, [shareUrl]);

  function copyUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.focus(); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-7 flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">개인 결과 QR</p>
          <h3 className="text-lg font-bold text-gray-800">
            {studentNumber}번 {studentName}
          </h3>
        </div>
        {qrUrl ? (
          <img src={qrUrl} alt="QR" className="w-48 h-48 rounded-xl" />
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
        )}
        <p className="text-xs text-gray-400 text-center">
          이 QR을 스캔하면 개요를 바로 복사할 수 있어요
        </p>
        <button
          onClick={copyUrl}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          🔗 링크 복사
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function QuestionResultsModal({
  results,
  onClose,
}: {
  results: QuestionResult[];
  onClose: () => void;
}) {
  const totalQuestions = results.reduce((sum, result) => sum + result.selections.length, 0);
  const [viewMode, setViewMode] = useState<"students" | "questions">("students");
  const flattenedQuestions = results.flatMap((result) =>
    result.selections.map((selection, index) => ({
      sessionId: result.sessionId,
      studentNumber: result.studentNumber,
      studentName: result.studentName,
      order: index + 1,
      selection,
    }))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-500">질문 만들기 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">학생 질문 모아보기</h3>
            <p className="text-sm text-gray-500 mt-1">
              {results.length}명의 학생이 만든 질문 {totalQuestions}개를 한 번에 확인할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          <div className="mb-5 inline-flex rounded-2xl bg-sky-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode("students")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === "students"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-sky-600 hover:text-sky-700"
              }`}
            >
              학생별 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode("questions")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                viewMode === "questions"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-sky-600 hover:text-sky-700"
              }`}
            >
              질문만 모아보기
            </button>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/70 p-10 text-center">
              <p className="text-base font-semibold text-sky-800">아직 제출된 질문이 없어요.</p>
              <p className="mt-2 text-sm text-sky-600">학생이 질문 만들기를 완료하면 여기에 모아볼 수 있습니다.</p>
            </div>
          ) : viewMode === "questions" ? (
            <div className="grid gap-3">
              {flattenedQuestions.map(({ sessionId, studentNumber, studentName, order, selection }) => (
                <div key={`${sessionId}-${selection.id}`} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-sky-500">
                        {studentNumber}번 {studentName} · 질문 {order}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {selection.method === "direct" ? "직접 질문 만들기" : `${selection.cardSetLabel} 카드`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-base font-medium leading-relaxed text-sky-950">
                    {selection.remixedQuestion}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.sessionId} className="rounded-3xl border border-sky-100 bg-sky-50/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-sky-500">학생</p>
                      <h4 className="text-lg font-bold text-gray-800">
                        {result.studentNumber}번 {result.studentName}
                      </h4>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                      질문 {result.selections.length}개
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {result.selections.map((selection, index) => (
                      <div key={selection.id} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-sky-500">
                              질문 {index + 1}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              {selection.method === "direct" ? "직접 질문 만들기" : `${selection.cardSetLabel} 카드`}
                            </p>
                          </div>
                        </div>

                        {selection.originalPrompt && (
                          <div className="mt-3 rounded-2xl bg-gray-50 p-3">
                            <p className="text-xs font-semibold text-gray-500">고른 질문 카드</p>
                            <p className="mt-1 text-sm leading-relaxed text-gray-700">{selection.originalPrompt}</p>
                          </div>
                        )}

                        <div className="mt-3 rounded-2xl bg-sky-50 p-3">
                          <p className="text-xs font-semibold text-sky-700">학생이 만든 질문</p>
                          <p className="mt-1 text-base font-medium leading-relaxed text-sky-950">
                            {selection.remixedQuestion}
                          </p>
                        </div>

                        {selection.reason && (
                          <div className="mt-3 rounded-2xl bg-emerald-50 p-3">
                            <p className="text-xs font-semibold text-emerald-700">이렇게 만든 이유</p>
                            <p className="mt-1 text-sm leading-relaxed text-emerald-950">{selection.reason}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionVotingResultsModal({
  ranking,
  onClose,
}: {
  ranking: QuestionVotingRanking;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-violet-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-500">좋은 질문 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">익명 질문 투표 결과</h3>
            <p className="text-sm text-gray-500 mt-1">
              학생들이 좋은 질문으로 고른 결과를 득표순으로 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          {ranking.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/70 p-10 text-center">
              <p className="text-base font-semibold text-violet-800">아직 제출된 평가가 없어요.</p>
              <p className="mt-2 text-sm text-violet-600">학생들이 좋은 질문을 고르면 여기에 득표 순서대로 모입니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <QuestionVotingTopThree ranking={ranking} />
              <QuestionVotingCompactList ranking={ranking} showReasons />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OneLineShareResultsModal({
  entries,
  onClose,
}: {
  entries: OneLineShareResults;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-rose-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">한줄모아 결과</p>
            <h3 className="text-2xl font-bold text-gray-800 mt-1">학생 한 줄 모아보기</h3>
            <p className="text-sm text-gray-500 mt-1">
              좋아요를 많이 받은 문장부터 학생 이름과 함께 볼 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(85vh-112px)] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <OneLineShareTopThree entries={entries} showStudentName />
            <OneLineShareBoard entries={entries} showStudentName />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveStudentPanel({
  roomId,
  students,
  isActive,
  activityType,
  questionResults: initialQuestionResults,
  questionVotingResults: initialQuestionVotingResults,
  oneLineShareResults: initialOneLineShareResults,
}: {
  roomId: string;
  students: Student[];
  isActive: boolean;
  activityType: ActivityType;
  questionResults: QuestionResult[];
  questionVotingResults: QuestionVotingRanking;
  oneLineShareResults: OneLineShareResults;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [qrTarget, setQrTarget] = useState<Session | null>(null);
  const [isQuestionResultsOpen, setIsQuestionResultsOpen] = useState(false);
  const [isQuestionVotingResultsOpen, setIsQuestionVotingResultsOpen] = useState(false);
  const [isOneLineShareResultsOpen, setIsOneLineShareResultsOpen] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>(initialQuestionResults);
  const [questionVotingResults, setQuestionVotingResults] = useState<QuestionVotingRanking>(initialQuestionVotingResults);
  const [oneLineShareResults, setOneLineShareResults] = useState<OneLineShareResults>(initialOneLineShareResults);

  async function fetchSessions() {
    const data = await getRoomSessions(roomId);
    setSessions((data as Session[]) ?? []);

    if (activityType === "question_generator") {
      const questionData = await getQuestionGeneratorRoomResults(roomId);
      setQuestionResults((questionData as QuestionResult[]) ?? []);
    } else if (activityType === "question_voting") {
      const votingData = await getQuestionVotingRoomResults(roomId);
      setQuestionVotingResults(votingData ?? []);
    } else if (activityType === "one_line_share") {
      const oneLineData = await getOneLineShareRoomResults(roomId);
      setOneLineShareResults(oneLineData ?? []);
    }
  }

  useEffect(() => {
    fetchSessions();
    if (!isActive) return;
    const interval = setInterval(fetchSessions, 4000);
    return () => clearInterval(interval);
  }, [roomId, isActive, activityType]);

  const doneSessions = sessions.filter(s => s.status === "done");
  const activeSessions = sessions.filter(s => s.status === "in_progress");
  const connectedNums = new Set(sessions.map(s => s.student_number));
  const notConnected = students.filter(s => !connectedNums.has(s.student_number));

  return (
    <>
      {qrTarget && (
        <StudentQrModal
          sessionId={qrTarget.id}
          studentName={qrTarget.student_name}
          studentNumber={qrTarget.student_number}
          onClose={() => setQrTarget(null)}
        />
      )}
      {isQuestionResultsOpen && (
        <QuestionResultsModal
          results={questionResults}
          onClose={() => setIsQuestionResultsOpen(false)}
        />
      )}
      {isQuestionVotingResultsOpen && (
        <QuestionVotingResultsModal
          ranking={questionVotingResults}
          onClose={() => setIsQuestionVotingResultsOpen(false)}
        />
      )}
      {isOneLineShareResultsOpen && (
        <OneLineShareResultsModal
          entries={oneLineShareResults}
          onClose={() => setIsOneLineShareResultsOpen(false)}
        />
      )}

      <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">학생 활동 현황</h2>
            {activityType === "question_generator" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 만든 질문을 모달에서 한 번에 모아볼 수 있어요.</p>
            )}
            {activityType === "question_voting" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 고른 좋은 질문 결과를 득표순으로 바로 확인할 수 있어요.</p>
            )}
            {activityType === "one_line_share" && (
              <p className="mt-1 text-sm text-gray-500">학생들이 쓴 한 줄과 좋아요 수를 실시간으로 모아볼 수 있어요.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activityType === "question_generator" && (
              <button
                type="button"
                onClick={() => setIsQuestionResultsOpen(true)}
                className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200"
                disabled={questionResults.length === 0}
              >
                질문 결과 모아보기
              </button>
            )}
            {activityType === "question_voting" && (
              <button
                type="button"
                onClick={() => setIsQuestionVotingResultsOpen(true)}
                className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-violet-200"
                disabled={questionVotingResults.length === 0}
              >
                좋은 질문 결과 보기
              </button>
            )}
            {activityType === "one_line_share" && (
              <button
                type="button"
                onClick={() => setIsOneLineShareResultsOpen(true)}
                className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-rose-200"
                disabled={oneLineShareResults.length === 0}
              >
                한줄모아 결과 보기
              </button>
            )}
            <div className="flex gap-3 text-sm">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                접속 중 {activeSessions.length}명
              </span>
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                완료 {doneSessions.length}명
              </span>
              <span className="bg-gray-50 text-gray-500 px-3 py-1 rounded-full font-medium">
                전체 {students.length}명
              </span>
            </div>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                실시간
              </span>
            )}
          </div>
        </div>

        {/* 접속 중 */}
        {activeSessions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-blue-600 mb-2">✏️ 지금 활동 중</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeSessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-blue-300 font-mono w-5 shrink-0">{s.student_number}</span>
                  <span className="text-sm font-medium text-blue-800 truncate">{s.student_name}</span>
                  {s.level && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${levelStyle(s.level)}`}>
                      {levelLabel(s.level)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 완료 */}
        {doneSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-600">
                {activityType === "question_generator"
                  ? "✅ 질문 제출 완료"
                  : activityType === "question_voting"
                    ? "✅ 좋은 질문 평가 완료"
                    : activityType === "one_line_share"
                      ? "✅ 한 줄 제출 완료"
                    : "✅ 개요 완성"}
              </p>
              <p className="text-xs text-gray-400">
                {activityType === "question_generator"
                  ? "보기 → 학생 질문 상세"
                  : activityType === "question_voting"
                    ? "보기 → 학생 선택 결과"
                    : activityType === "one_line_share"
                      ? "보기 → 학생 문장 상세"
                    : "QR 버튼 → 학생 개인 결과 QR"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {doneSessions.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-green-300 font-mono w-5 shrink-0">{s.student_number}</span>
                  <span className="text-sm font-medium text-green-800 truncate flex-1">{s.student_name}</span>
                  {/* QR 버튼 */}
                  {activityType === "outline_builder" && (
                    <button
                      type="button"
                      onClick={() => setQrTarget(s)}
                      className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg font-medium transition-colors shrink-0"
                      title="개인 결과 QR 보기"
                    >
                      QR
                    </button>
                  )}
                  {/* 결과 보기 링크 */}
                  <Link
                    href={`/dashboard/room/${roomId}/result/${s.id}`}
                    className="text-xs text-green-500 hover:text-green-700 shrink-0"
                  >
                    보기 →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미접속 */}
        {notConnected.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-2">⬜ 미접속 ({notConnected.length}명)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {notConnected.map(s => (
                <div key={s.id}
                  className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-300 font-mono w-4 shrink-0">{s.student_number}</span>
                  <span className="text-sm text-gray-500 truncate">{s.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">학생 명단이 없습니다.</p>
        )}

        {sessions.length === 0 && students.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-2 animate-pulse">
            학생이 QR 코드로 접속하면 여기에 표시돼요
          </p>
        )}
      </div>
    </>
  );
}
