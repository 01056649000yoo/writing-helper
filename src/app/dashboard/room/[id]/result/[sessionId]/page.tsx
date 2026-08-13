import Link from "next/link";
import { notFound } from "next/navigation";
import type { OutlineTemplateAnswer } from "@/features/activities/types";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/app/actions/auth-actions";
import { OneLineShareBoard, OneLineShareTopThree } from "@/components/one-line-share-board";
import { StudentResultQr } from "./student-result-qr";
import { buildOneLineShareBoard } from "@/lib/one-line-share";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";
import {
  QuestionVotingCompactList,
  QuestionVotingTopThree,
} from "@/components/question-voting-ranking-summary";
import {
  buildQuestionVotingRanking,
  normalizeQuestionVotingConfig,
  normalizeQuestionVotingSubmission,
} from "@/lib/question-voting";
import { normalizeHanjaWritingConfig } from "@/lib/hanja-writing";

export default async function TeacherResultPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const user = await getCurrentUser();
  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("room_id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("title, topic, teacher_id, activity_type, activity_config")
    .eq("id", id)
    .maybeSingle();

  if (room?.teacher_id !== user?.id) notFound();

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${sessionId}`;
  const questionSubmission = normalizeQuestionGeneratorSubmission(session.submission);
  const questionVotingSubmission = normalizeQuestionVotingSubmission(session.submission);
  const questionVotingConfig = normalizeQuestionVotingConfig(room?.activity_config);
  const isQuestionGenerator = room?.activity_type === "question_generator";
  const isQuestionVoting = room?.activity_type === "question_voting";
  const isOneLineShare = room?.activity_type === "one_line_share";
  const isHanjaWriting = room?.activity_type === "hanja_writing";
  const hanjaWritingConfig = isHanjaWriting ? normalizeHanjaWritingConfig(room?.activity_config) : null;

  let questionVotingRanking: ReturnType<typeof buildQuestionVotingRanking> = [];
  if (isQuestionVoting && questionVotingConfig) {
    const { data: allVotingSessions } = await admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("submission")
      .eq("room_id", id)
      .eq("status", "done");

    questionVotingRanking = buildQuestionVotingRanking(
      questionVotingConfig,
      (allVotingSessions ?? [])
        .map((currentSession) => normalizeQuestionVotingSubmission(currentSession.submission))
        .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission)),
    );
  }

  let oneLineShareEntries: ReturnType<typeof buildOneLineShareBoard> = [];
  if (isOneLineShare) {
    const [entriesRes, reactionsRes] = await Promise.all([
      admin
        .schema("writing_helper")
        .from("one_line_entries")
        .select("id, session_id, student_number, student_name, content, contains_keywords, created_at, updated_at")
        .eq("room_id", id),
      admin
        .schema("writing_helper")
        .from("one_line_reactions")
        .select("entry_id, session_id")
        .eq("room_id", id)
        .eq("reaction_type", "like"),
    ]);

    oneLineShareEntries = buildOneLineShareBoard(entriesRes.data ?? [], reactionsRes.data ?? [], sessionId);
  }

  return (
    <main className="lab-page">
      <div className="lab-page__content lab-page__content--narrow">
        <Link href={`/dashboard/room/${id}`} className="lab-breadcrumb">← 활동으로</Link>
        <div className="lab-panel lab-panel--raised p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-400">{room?.title} · {room?.topic}</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-1">
                {session.student_number}번 {session.student_name}
              </h1>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${levelStyle(session.level)}`}>
                  {levelLabel(session.level)}
                </span>
              </div>
            </div>
            {/* 학생 개인 QR */}
            {!isQuestionGenerator && !isQuestionVoting && !isHanjaWriting && !isOneLineShare && Array.isArray(session.answers) && session.answers.length > 0 && (
              <StudentResultQr
                shareUrl={shareUrl}
                studentName={session.student_name}
                studentNumber={session.student_number}
              />
            )}
          </div>

          {isQuestionGenerator && questionSubmission && (
            <div className="grid gap-4">
              {questionSubmission.selections.map((selection, index) => (
                <div key={selection.id} className="bg-sky-50 rounded-2xl p-6 space-y-4">
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
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                      질문 완성
                    </span>
                  </div>

                  {selection.originalPrompt && (
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{selection.originalPrompt}</p>
                    </div>
                  )}

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs font-semibold text-sky-700 mb-2">학생이 만든 질문</p>
                    <p className="text-base font-medium text-sky-950 leading-relaxed">{selection.remixedQuestion}</p>
                  </div>

                </div>
              ))}
            </div>
          )}

          {isQuestionVoting && questionVotingSubmission && questionVotingConfig && (
            <div className="grid gap-4">
              <div className="bg-violet-50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-500">학생이 고른 질문</p>
                    <h2 className="text-lg font-bold text-gray-800 mt-1">좋은 질문으로 선택한 질문</h2>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                    {questionVotingSubmission.selectedQuestionIds.length}개 선택
                  </span>
                </div>

                <div className="space-y-3">
                  {questionVotingSubmission.selectedQuestionIds.map((questionId, index) => {
                    const questionText = questionVotingConfig.sourceQuestions.find((question) => question.id === questionId)?.text
                      ?? "질문을 찾을 수 없습니다.";

                    return (
                      <div key={questionId} className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold text-violet-500">선택한 질문 {index + 1}</p>
                        <p className="mt-2 text-base font-medium leading-relaxed text-violet-950">{questionText}</p>
                      </div>
                    );
                  })}
                </div>

              </div>

              {questionVotingRanking.length > 0 && (
                <div className="bg-white rounded-2xl border border-violet-100 p-6">
                  <h2 className="font-bold text-violet-800 mb-4">📊 현재 좋은 질문 득표 결과</h2>
                  <div className="space-y-4">
                    <QuestionVotingTopThree ranking={questionVotingRanking} />
                    <QuestionVotingCompactList ranking={questionVotingRanking} />
                  </div>
                </div>
              )}
            </div>
          )}

          {isOneLineShare && (
            <div className="grid gap-4">
              <div className="bg-rose-50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-rose-500">학생이 쓴 한 줄</p>
                    <h2 className="text-lg font-bold text-gray-800 mt-1">오늘의 문장</h2>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-base font-medium text-rose-950 leading-relaxed">
                    {typeof session.submission?.content === "string" && session.submission.content.trim()
                      ? session.submission.content
                      : "아직 제출된 문장이 없습니다."}
                  </p>
                </div>
              </div>

              {oneLineShareEntries.length > 0 && (
                <div className="bg-white rounded-2xl border border-rose-100 p-6 space-y-4">
                  <h2 className="font-bold text-rose-800">💬 현재 한줄모아 반응 결과</h2>
                  <OneLineShareTopThree entries={oneLineShareEntries} showStudentName />
                  <OneLineShareBoard entries={oneLineShareEntries} showStudentName />
                </div>
              )}
            </div>
          )}

          {isHanjaWriting && hanjaWritingConfig && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">한자 카드</p>
                <h2 className="mt-2 text-3xl font-bold text-gray-900">{hanjaWritingConfig.card.word}</h2>
                {hanjaWritingConfig.card.definition && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{hanjaWritingConfig.card.definition}</p>
                )}

                {hanjaWritingConfig.card.hanja.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold text-amber-700">한자 풀이</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {hanjaWritingConfig.card.hanja.map((entry, index) => (
                        <div key={`${entry.char}-${index}`} className="rounded-2xl bg-white p-3">
                          <p className="text-2xl font-bold text-amber-700">{entry.char}</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800">{entry.meaning} {entry.reading}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hanjaWritingConfig.card.relatedWords.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold text-amber-700">관련 단어</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {hanjaWritingConfig.card.relatedWords.map((entry, index) => (
                        <div key={`${entry.word}-${index}`} className="rounded-2xl bg-white p-3">
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-bold text-gray-800">{entry.word}</p>
                            {entry.hanja && <span className="text-xs text-amber-700">{entry.hanja}</span>}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gray-600">{entry.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-amber-100 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">학생이 만든 문장</p>
                <p className="mt-3 text-base leading-relaxed text-gray-900">
                  {typeof session.submission?.content === "string" && session.submission.content.trim()
                    ? session.submission.content
                    : "아직 제출된 문장이 없습니다."}
                </p>
              </div>
            </div>
          )}

          {!isQuestionGenerator && !isQuestionVoting && !isOneLineShare && !isHanjaWriting && (
          <div>
            <h2 className="font-bold text-gray-700 mb-3">📝 학생이 쓴 개요</h2>
            <OutlineAnswersView answers={session.answers} />
          </div>
          )}
        </div>
      </div>
    </main>
  );
}

function levelLabel(level: string) {
  return { low: "글쓰기 도움 필요", mid: "보통", high: "잘 써요" }[level] ?? level;
}
function levelStyle(level: string) {
  return { low: "bg-orange-100 text-orange-700", mid: "bg-blue-100 text-blue-700", high: "bg-green-100 text-green-700" }[level] ?? "bg-gray-100 text-gray-600";
}

function OutlineAnswersView({ answers }: { answers: unknown }) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return <p className="text-sm text-gray-500">아직 제출된 답변이 없습니다.</p>;
  }

  const normalized = answers
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      section: (a.section === "처음" || a.section === "가운데" || a.section === "끝") ? a.section as OutlineTemplateAnswer["section"] : null,
      label: typeof a.label === "string" ? a.label : (typeof a.question === "string" ? a.question : ""),
      answer: typeof a.answer === "string" ? a.answer : "",
    }))
    .filter((a) => a.label || a.answer);

  const sectionOrder: OutlineTemplateAnswer["section"][] = ["처음", "가운데", "끝"];
  const grouped = sectionOrder
    .map((section) => ({
      section,
      items: normalized.filter((a) => a.section === section),
    }))
    .filter((group) => group.items.length > 0);
  const ungrouped = normalized.filter((a) => a.section === null);

  return (
    <div className="space-y-4">
      {grouped.map(({ section, items }) => (
        <div key={section} className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-indigo-600 mb-2">{section}</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-line">{item.answer || "(비어 있음)"}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 mb-2">기타</p>
          <div className="space-y-2">
            {ungrouped.map((item, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-line">{item.answer || "(비어 있음)"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
