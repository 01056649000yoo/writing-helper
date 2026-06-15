"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { generateDraftFromAnswers, generateOutline } from "@/lib/gpt";
import { parseOutlineResult, serializeOutlineResult } from "@/lib/result-format";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";
import { deterministicShuffle } from "@/lib/anonymous-order";
import { buildOneLineShareBoard, includesAllConfiguredKeywords, normalizeOneLineShareConfig } from "@/lib/one-line-share";
import { buildHanjaWritingBoard, normalizeHanjaWritingConfig, sentenceContainsWord } from "@/lib/hanja-writing";
import { getTeacherOpenAiAccess, logApiUsage } from "@/lib/service-admin";
import {
  buildQuestionVotingRanking,
  normalizeQuestionVotingConfig,
  normalizeQuestionVotingSubmission,
} from "@/lib/question-voting";
import type { StudentLevel, Answer } from "@/types";
import type {
  OneLineShareConfig,
  OneLineShareSubmission,
  QuestionGeneratorSubmission,
  QuestionVotingSubmission,
} from "@/features/activities/types";

// 학생 인증 (번호+이름 대조)
export async function verifyStudent(
  roomId: string,
  studentNumber: number,
  studentName: string
): Promise<{ error?: string; studentId?: string; sessionId?: string; status?: string }> {
  // 서버 측 입력 유효성 검사
  if (!roomId || typeof roomId !== "string" || roomId.length > 100) return { error: "잘못된 요청입니다." };
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 100) return { error: "출석 번호는 1~100 사이여야 합니다." };
  if (!studentName || typeof studentName !== "string" || studentName.trim().length === 0 || studentName.length > 50) return { error: "이름을 올바르게 입력해주세요." };

  const admin = createSupabaseAdminClient();

  // 방이 활성화 상태인지 확인
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, is_active, expires_at, class_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "방을 찾을 수 없습니다." };
  if (!room.is_active) return { error: "이미 종료된 활동입니다." };
  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return { error: "활동 시간이 만료됐습니다." };
  }

  // 명단 확인 (class_students 우선, fallback room_students)
  let studentId: string | null = null;

  if (room.class_id) {
    const { data: cs } = await admin
      .schema("writing_helper")
      .from("class_students")
      .select("id")
      .eq("class_id", room.class_id)
      .eq("student_number", studentNumber)
      .eq("student_name", studentName)
      .maybeSingle();
    studentId = cs?.id ?? null;
  } else {
    const { data: rs } = await admin
      .schema("writing_helper")
      .from("room_students")
      .select("id")
      .eq("room_id", roomId)
      .eq("student_number", studentNumber)
      .eq("student_name", studentName)
      .maybeSingle();
    studentId = rs?.id ?? null;
  }

  if (!studentId) return { error: "번호나 이름이 명단과 다릅니다.\n선생님께 확인 후 다시 입력해주세요." };
  const student = { id: studentId };

  // 기존 세션 확인
  const { data: existing } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, status")
    .eq("room_id", roomId)
    .eq("student_number", studentNumber)
    .eq("student_name", studentName)
    .maybeSingle();

  if (existing) {
    return { studentId: student.id, sessionId: existing.id, status: existing.status };
  }

  // 새 세션 생성 (room_student_id는 class 기반이므로 null)
  const { data: session, error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .insert({
      room_id: roomId,
      room_student_id: null,
      student_number: studentNumber,
      student_name: studentName,
    })
    .select("id")
    .single();

  if (error || !session) return { error: "세션 생성에 실패했습니다." };

  return { studentId: student.id, sessionId: session.id, status: "in_progress" };
}

// 결과 조회
export async function getStudentResult(sessionId: string, roomId: string) {
  const admin = createSupabaseAdminClient();
  const [queueRes, sessionRes, roomRes] = await Promise.all([
    admin.schema("writing_helper").from("outline_queue")
      .select("result").eq("session_id", sessionId).eq("status", "done")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.schema("writing_helper").from("student_sessions")
      .select("student_name, submission").eq("id", sessionId).maybeSingle(),
    admin.schema("writing_helper").from("rooms")
      .select("topic, activity_type, activity_config, is_active").eq("id", roomId).maybeSingle(),
  ]);

  const activityType = roomRes.data?.activity_type ?? "outline_builder";

  if (activityType === "question_generator") {
    const anonymousPeerQuestions = await getAnonymousQuestionGeneratorResults(sessionId, roomId);
    return {
      activityType,
      outline: "",
      draft: "",
      studentName: sessionRes.data?.student_name ?? "",
      topic: roomRes.data?.topic ?? "",
      questionGeneratorSubmission: normalizeQuestionGeneratorSubmission(sessionRes.data?.submission),
      anonymousPeerQuestions,
      questionVotingSubmission: null,
      questionVotingConfig: null,
      questionVotingRanking: [],
      questionVotingClosed: false,
      oneLineShareConfig: null,
      oneLineShareEntry: null,
      oneLineShareBoard: [],
      oneLineShareClosed: false,
    };
  }

  if (activityType === "question_voting") {
    const votingConfig = normalizeQuestionVotingConfig(roomRes.data?.activity_config);
    const questionVotingSubmission = normalizeQuestionVotingSubmission(sessionRes.data?.submission);
    const ranking = !roomRes.data?.is_active && votingConfig
      ? await getQuestionVotingRankingForRoom(roomId, votingConfig)
      : [];

    return {
      activityType,
      outline: "",
      draft: "",
      studentName: sessionRes.data?.student_name ?? "",
      topic: roomRes.data?.topic ?? "",
      questionGeneratorSubmission: null,
      anonymousPeerQuestions: [],
      questionVotingSubmission,
      questionVotingConfig: votingConfig,
      questionVotingRanking: ranking,
      questionVotingClosed: roomRes.data?.is_active === false,
      oneLineShareConfig: null,
      oneLineShareEntry: null,
      oneLineShareBoard: [],
      oneLineShareClosed: false,
    };
  }

  if (activityType === "one_line_share") {
    const oneLineShareConfig = normalizeOneLineShareConfig(roomRes.data?.activity_config);
    const oneLineShareEntry = await getOneLineShareEntryBySession(sessionId);
    const oneLineShareBoard = await getOneLineShareBoardForSession(sessionId, roomId);

    return {
      activityType,
      outline: "",
      draft: "",
      studentName: sessionRes.data?.student_name ?? "",
      topic: roomRes.data?.topic ?? "",
      questionGeneratorSubmission: null,
      anonymousPeerQuestions: [],
      questionVotingSubmission: null,
      questionVotingConfig: null,
      questionVotingRanking: [],
      questionVotingClosed: false,
      oneLineShareConfig,
      oneLineShareEntry,
      oneLineShareBoard,
      oneLineShareClosed: roomRes.data?.is_active === false,
      hanjaWritingConfig: null,
      hanjaWritingEntry: null,
      hanjaWritingBoard: [],
    };
  }

  if (activityType === "hanja_writing") {
    const hanjaWritingConfig = normalizeHanjaWritingConfig(roomRes.data?.activity_config);
    const hanjaWritingBoard = await getHanjaWritingBoardForRoom(roomId, sessionId);
    const submission = sessionRes.data?.submission as { content?: unknown } | null | undefined;
    const myContent = typeof submission?.content === "string" ? submission.content : "";
    return {
      activityType,
      outline: "",
      draft: "",
      studentName: sessionRes.data?.student_name ?? "",
      topic: roomRes.data?.topic ?? "",
      questionGeneratorSubmission: null,
      anonymousPeerQuestions: [],
      questionVotingSubmission: null,
      questionVotingConfig: null,
      questionVotingRanking: [],
      questionVotingClosed: false,
      oneLineShareConfig: null,
      oneLineShareEntry: null,
      oneLineShareBoard: [],
      oneLineShareClosed: false,
      hanjaWritingConfig,
      hanjaWritingEntry: myContent ? { content: myContent } : null,
      hanjaWritingBoard,
    };
  }

  return {
    activityType,
    ...parseOutlineResult(queueRes.data?.result ?? null),
    studentName: sessionRes.data?.student_name ?? "",
    topic: roomRes.data?.topic ?? "",
    questionGeneratorSubmission: null,
    anonymousPeerQuestions: [],
    questionVotingSubmission: null,
    questionVotingConfig: null,
    questionVotingRanking: [],
    questionVotingClosed: false,
    oneLineShareConfig: null,
    oneLineShareEntry: null,
    oneLineShareBoard: [],
    oneLineShareClosed: false,
    hanjaWritingConfig: null,
    hanjaWritingEntry: null,
    hanjaWritingBoard: [],
  };
}

async function getHanjaWritingBoardForRoom(roomId: string, currentSessionId: string | null) {
  const admin = createSupabaseAdminClient();
  const [sessionsRes, reactionsRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, student_number, student_name, submission, updated_at")
      .eq("room_id", roomId)
      .eq("status", "done")
      .order("student_number"),
    admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .select("target_session_id, session_id")
      .eq("room_id", roomId)
      .eq("reaction_type", "like"),
  ]);

  return buildHanjaWritingBoard(sessionsRes.data ?? [], reactionsRes.data ?? [], currentSessionId);
}

// 수준 저장
export async function setStudentLevel(
  sessionId: string,
  level: StudentLevel
): Promise<{ error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({ level, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return {};
}

// 답변 저장 (중간 저장)
export async function saveAnswers(
  sessionId: string,
  answers: Answer[]
): Promise<{ error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({ answers, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };
  return {};
}

// 개요 생성 요청 (대기열 등록)
export async function requestOutline(
  sessionId: string,
  latestAnswers?: Answer[]
): Promise<{ error?: string; queueId?: string; position?: number }> {
  const admin = createSupabaseAdminClient();

  if (latestAnswers && latestAnswers.length > 0) {
    const { error: updateError } = await admin
      .schema("writing_helper")
      .from("student_sessions")
      .update({ answers: latestAnswers, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateError) return { error: "답변 저장 중 오류가 발생했습니다." };
  }

  // 세션 정보 가져오기
  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*, rooms!inner(teacher_id, topic, subject_type, grade_level, outline_depth)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { error: "세션을 찾을 수 없습니다." };
  if (session.gpt_call_count >= 3) return { error: "개요 생성 횟수를 초과했습니다." };

  const answersToUse = latestAnswers && latestAnswers.length > 0 ? latestAnswers : session.answers;
  if (!answersToUse || answersToUse.length === 0) {
    return { error: "답변이 저장되지 않았습니다. 마지막 질문에 다시 답해보세요." };
  }

  // 현재 대기 순서 계산
  const { count } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["waiting", "processing"]);

  const position = (count ?? 0) + 1;

  // 대기열 등록
  const { data: queue, error } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .insert({
      session_id: sessionId,
      room_id: session.room_id,
      status: "waiting",
      answers: answersToUse,
      position,
    })
    .select("id")
    .single();

  if (error || !queue) return { error: "대기열 등록에 실패했습니다." };

  // GPT 호출 횟수 증가
  await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({ gpt_call_count: session.gpt_call_count + 1 })
    .eq("id", sessionId);

  return { queueId: queue.id, position };
}

// 대기열 상태 확인 (폴링) — sessionId로 소유권 검증
export async function checkQueueStatus(queueId: string, sessionId?: string) {
  if (!queueId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .select("status, result, position, session_id")
    .eq("id", queueId)
    .maybeSingle();

  if (!data) return null;
  // sessionId가 전달된 경우 반드시 일치해야 함
  if (sessionId && data.session_id !== sessionId) return null;

  const { session_id: _, ...rest } = data;
  return rest;
}

// 대기열 처리기 (서버에서 주기적 호출)
export async function processOutlineQueue(): Promise<{ processed: number }> {
  const admin = createSupabaseAdminClient();

  // waiting 항목 3개 가져오기
  const { data: items } = await admin
    .schema("writing_helper")
    .from("outline_queue")
    .select("id, session_id, room_id, answers")
    .eq("status", "waiting")
    .order("created_at")
    .limit(3);

  if (!items || items.length === 0) return { processed: 0 };

  // processing 상태로 변경
  const ids = items.map(i => i.id);
  await admin
    .schema("writing_helper")
    .from("outline_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .in("id", ids);

  // 3개 병렬 처리
  const results = await Promise.allSettled(
    items.map(async (item) => {
      // 세션 정보
      const { data: session } = await admin
        .schema("writing_helper")
        .from("student_sessions")
        .select("level, room_id")
        .eq("id", item.session_id)
        .maybeSingle();

      // 방 정보 + 교사 API 키
      const { data: room } = await admin
        .schema("writing_helper")
        .from("rooms")
        .select("topic, topic_description, subject_type, grade_level, outline_depth, teacher_id, activity_config")
        .eq("id", item.room_id)
        .maybeSingle();

      const keyAccess = await getTeacherOpenAiAccess(room!.teacher_id);
      if (keyAccess.error || !keyAccess.access) throw new Error(keyAccess.error ?? "OpenAI API 키 없음");
      const apiKey = keyAccess.access.apiKey;

      await logApiUsage({
        teacherId: room!.teacher_id,
        feature: "generate_outline",
        model: "gpt-4o",
        usedSharedApi: keyAccess.access.usedSharedApi,
        roomId: item.room_id,
        sessionId: item.session_id,
        metadata: { level: session?.level ?? "mid" },
      });
      const outline = await generateOutline(
        apiKey,
        room!.topic,
        room!.topic_description ?? "",
        room!.subject_type,
        room!.grade_level,
        room!.outline_depth,
        session?.level ?? "mid",
        item.answers
      );

      const activityConfig = room?.activity_config as { generateDraft?: boolean } | null;
      const draft = activityConfig?.generateDraft
        ? (await logApiUsage({
            teacherId: room!.teacher_id,
            feature: "generate_draft",
            model: "gpt-4o",
            usedSharedApi: keyAccess.access.usedSharedApi,
            roomId: item.room_id,
            sessionId: item.session_id,
            metadata: { level: session?.level ?? "mid" },
          }), await generateDraftFromAnswers(
            apiKey,
            room!.topic,
            room!.topic_description ?? "",
            room!.subject_type,
            room!.grade_level,
            room!.outline_depth,
            session?.level ?? "mid",
            item.answers
          ))
        : null;

      // 결과 저장
      await admin
        .schema("writing_helper")
        .from("outline_queue")
        .update({
          status: "done",
          result: serializeOutlineResult({ outline, draft }),
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // 세션 완료 처리
      await admin
        .schema("writing_helper")
        .from("student_sessions")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", item.session_id);
    })
  );

  // 실패한 항목 error 처리
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const item = items[i];
      const { data: current } = await admin
        .schema("writing_helper")
        .from("outline_queue")
        .select("retry_count")
        .eq("id", item.id)
        .maybeSingle();

      const retryCount = (current?.retry_count ?? 0) + 1;
      await admin
        .schema("writing_helper")
        .from("outline_queue")
        .update({
          status: retryCount < 3 ? "waiting" : "error",
          retry_count: retryCount,
        })
        .eq("id", item.id);
    }
  }

  return { processed: items.length };
}

// 공유 결과 조회 (인증 불필요 — /share/[sessionId] 공개 페이지용)
export async function getShareableResult(sessionId: string) {
  const admin = createSupabaseAdminClient();
  const [queueRes, sessionRes] = await Promise.all([
    admin.schema("writing_helper").from("outline_queue")
      .select("result").eq("session_id", sessionId).eq("status", "done")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.schema("writing_helper").from("student_sessions")
      .select("student_name, student_number, room_id")
      .eq("id", sessionId).maybeSingle(),
  ]);
  if (!sessionRes.data) return null;
  const { data: roomRes } = await admin.schema("writing_helper").from("rooms")
    .select("topic, title").eq("id", sessionRes.data.room_id).maybeSingle();
  return {
    ...parseOutlineResult(queueRes.data?.result ?? null),
    studentName: sessionRes.data.student_name,
    studentNumber: sessionRes.data.student_number,
    topic: roomRes?.topic ?? "",
    title: roomRes?.title ?? "",
  };
}

// 대기열 처리 트리거 (클라이언트에서 직접 API 키 노출 없이 호출)
export async function triggerQueueProcess(): Promise<void> {
  await processOutlineQueue();
}

// 학생 세션 가져오기
export async function getStudentSession(sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  return data;
}

// 학생용 질문 조회 — sessionId로 해당 방의 소유 세션인지 검증 후 반환
export async function getStudentRoomQuestions(sessionId: string, roomId: string) {
  if (!sessionId || !roomId) return null;
  const admin = createSupabaseAdminClient();

  // 해당 세션이 이 방에 속하는지 확인
  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (!session) return null;

  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("topic, topic_description, title, question_sets, activity_type, activity_config")
    .eq("id", roomId)
    .maybeSingle();
  if (!data) return null;

  const { data: submissionData } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("submission, status")
    .eq("id", sessionId)
    .eq("room_id", roomId)
    .maybeSingle();

  const { data: oneLineEntry } = await admin
    .schema("writing_helper")
    .from("one_line_entries")
    .select("id, content")
    .eq("session_id", sessionId)
    .eq("room_id", roomId)
    .maybeSingle();

  const hanjaSubmissionContent = typeof (submissionData?.submission as { content?: unknown } | null | undefined)?.content === "string"
    ? ((submissionData?.submission as { content: string }).content)
    : null;

  return {
    ...data,
    existing_submission: normalizeQuestionGeneratorSubmission(submissionData?.submission),
    existing_voting_submission: normalizeQuestionVotingSubmission(submissionData?.submission),
    existing_one_line_submission: oneLineEntry
      ? ({
          entryId: oneLineEntry.id,
          content: oneLineEntry.content,
        } satisfies OneLineShareSubmission)
      : null,
    existing_hanja_writing_submission: hanjaSubmissionContent ? { content: hanjaSubmissionContent } : null,
    session_status: submissionData?.status ?? "in_progress",
  };
}

export async function getStudentRoomEntry(roomId: string) {
  if (!roomId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("topic, title, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  return data ?? null;
}

export async function submitQuestionGenerator(
  sessionId: string,
  roomId: string,
  submission: QuestionGeneratorSubmission
): Promise<{ error?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };
  if (!Array.isArray(submission.selections) || submission.selections.length === 0) {
    return { error: "최소 한 개의 질문을 완성해주세요." };
  }

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };

  const configMaxSelections = Number((roomRes.data.activity_config as { maxSelections?: unknown } | null)?.maxSelections);
  const maxSelections = Number.isFinite(configMaxSelections)
    ? Math.min(Math.max(Math.trunc(configMaxSelections), 1), 4)
    : 4;

  const sanitizedSelections = submission.selections.map((selection, index) => ({
    id: typeof selection.id === "string" && selection.id.trim()
      ? selection.id.trim()
      : `selection-${index + 1}`,
    method: selection.method === "direct" ? "direct" : "card_remix",
    cardSetId: selection.cardSetId === "custom" ? "custom" : String(selection.cardSetId ?? "").trim(),
    cardSetLabel: String(selection.cardSetLabel ?? "").trim() || (selection.method === "direct" ? "직접 질문 만들기" : "질문 카드"),
    originalPrompt: typeof selection.originalPrompt === "string" && selection.originalPrompt.trim()
      ? selection.originalPrompt.trim()
      : null,
    remixedQuestion: String(selection.remixedQuestion ?? "").trim(),
  })).filter((selection) => selection.remixedQuestion.length > 0);

  if (sanitizedSelections.length === 0) {
    return { error: "바꾼 질문을 입력해주세요." };
  }

  if (sanitizedSelections.length > maxSelections) {
    return { error: `질문은 ${maxSelections}개까지 만들 수 있어요.` };
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({
      submission: { selections: sanitizedSelections },
      result: { submittedCount: sanitizedSelections.length },
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "질문 저장에 실패했습니다." };
  return {};
}

export async function submitQuestionVoting(
  sessionId: string,
  roomId: string,
  submission: QuestionVotingSubmission,
): Promise<{ error?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 평가 활동입니다." };

  const config = normalizeQuestionVotingConfig(roomRes.data.activity_config);
  if (!config) return { error: "평가 활동 설정을 불러오지 못했습니다." };

  const allowedIds = new Set(config.sourceQuestions.map((question) => question.id));
  const selectedQuestionIds = Array.from(new Set(
    (submission.selectedQuestionIds ?? [])
      .map((questionId) => questionId.trim())
      .filter((questionId) => allowedIds.has(questionId)),
  ));

  if (selectedQuestionIds.length === 0) {
    return { error: "좋은 질문을 1개 이상 골라주세요." };
  }

  if (selectedQuestionIds.length > config.maxSelections) {
    return { error: `좋은 질문은 ${config.maxSelections}개까지 고를 수 있어요.` };
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({
      submission: {
        selectedQuestionIds,
      },
      result: {
        selectedQuestionIds,
      },
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "질문 평가 저장에 실패했습니다." };
  return {};
}

export async function submitOneLineShare(
  sessionId: string,
  roomId: string,
  content: string,
): Promise<{ error?: string; entryId?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };

  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return { error: "한 줄 문장을 적어주세요." };
  }

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes, existingEntryRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, student_number, student_name")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("one_line_entries")
      .select("id")
      .eq("room_id", roomId)
      .eq("session_id", sessionId)
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };

  const config = normalizeOneLineShareConfig(roomRes.data.activity_config);
  if (!config) return { error: "활동 설정을 불러오지 못했습니다." };

  if (config.coreKeywords.length > 0 && !includesAllConfiguredKeywords(normalizedContent, config.coreKeywords)) {
    return { error: "핵심단어를 모두 넣어 문장을 다시 써주세요." };
  }

  const payload = {
    room_id: roomId,
    session_id: sessionId,
    student_number: sessionRes.data.student_number,
    student_name: sessionRes.data.student_name,
    content: normalizedContent,
    contains_keywords: includesAllConfiguredKeywords(normalizedContent, config.coreKeywords),
    updated_at: new Date().toISOString(),
  };

  const entryRes = existingEntryRes.data
    ? await admin
        .schema("writing_helper")
        .from("one_line_entries")
        .update(payload)
        .eq("id", existingEntryRes.data.id)
        .eq("room_id", roomId)
        .select("id")
        .single()
    : await admin
        .schema("writing_helper")
        .from("one_line_entries")
        .insert(payload)
        .select("id")
        .single();

  if (entryRes.error || !entryRes.data) {
    return { error: "한 줄 저장에 실패했습니다." };
  }

  const reactionCount = await getReactionCountForEntry(roomId, entryRes.data.id);

  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({
      submission: {
        entryId: entryRes.data.id,
        content: normalizedContent,
      },
      result: {
        entryId: entryRes.data.id,
        submitted: true,
        likeCount: reactionCount,
      },
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "학생 활동 상태 저장에 실패했습니다." };
  return { entryId: entryRes.data.id };
}

export async function submitHanjaWriting(
  sessionId: string,
  roomId: string,
  content: string,
): Promise<{ error?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };

  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return { error: "한 문장을 적어주세요." };
  }

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_config, activity_type")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };
  if (roomRes.data.activity_type !== "hanja_writing") return { error: "활동 종류가 맞지 않습니다." };

  const config = roomRes.data.activity_config as { card?: { word?: string } } | null;
  const targetWord = config?.card?.word?.trim() ?? "";
  if (targetWord && !sentenceContainsWord(normalizedContent, targetWord)) {
    return { error: `문장에 "${targetWord}" 단어가 들어가야 해요.` };
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({
      submission: { content: normalizedContent },
      result: { submitted: true, likeCount: 0 },
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "문장 저장에 실패했습니다." };
  return {};
}

export async function toggleHanjaWritingReaction(
  sessionId: string,
  roomId: string,
  targetSessionId: string,
): Promise<{
  error?: string;
  entries?: Awaited<ReturnType<typeof getHanjaWritingBoardForRoom>>;
}> {
  if (!sessionId || !roomId || !targetSessionId) return { error: "잘못된 요청입니다." };

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes, targetRes, existingReactionRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_type")
      .eq("id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, status")
      .eq("id", targetSessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .select("id")
      .eq("room_id", roomId)
      .eq("target_session_id", targetSessionId)
      .eq("session_id", sessionId)
      .eq("reaction_type", "like")
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };
  if (roomRes.data.activity_type !== "hanja_writing") return { error: "활동 종류가 맞지 않습니다." };
  if (!targetRes.data || targetRes.data.status !== "done") return { error: "문장을 찾을 수 없습니다." };
  if (targetSessionId === sessionId) return { error: "내 문장에는 좋아요를 누를 수 없어요." };
  if (sessionRes.data.status !== "done") return { error: "먼저 내 문장을 제출한 뒤 반응할 수 있어요." };

  if (existingReactionRes.data) {
    const { error } = await admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .delete()
      .eq("id", existingReactionRes.data.id);

    if (error) return { error: "좋아요를 취소하지 못했습니다." };
  } else {
    const { error } = await admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .insert({
        room_id: roomId,
        target_session_id: targetSessionId,
        session_id: sessionId,
        reaction_type: "like",
      });

    if (error) return { error: "좋아요를 저장하지 못했습니다." };
  }

  return {
    entries: await getHanjaWritingBoardForRoom(roomId, sessionId),
  };
}

export async function toggleOneLineReaction(
  sessionId: string,
  roomId: string,
  entryId: string,
): Promise<{
  error?: string;
  entries?: ReturnType<typeof buildOneLineShareBoard>;
}> {
  if (!sessionId || !roomId || !entryId) return { error: "잘못된 요청입니다." };

  const admin = createSupabaseAdminClient();
  const [sessionRes, roomRes, entryRes, existingReactionRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("rooms")
      .select("is_active, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("one_line_entries")
      .select("id, session_id")
      .eq("id", entryId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .select("id")
      .eq("room_id", roomId)
      .eq("entry_id", entryId)
      .eq("session_id", sessionId)
      .eq("reaction_type", "like")
      .maybeSingle(),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };
  if (!entryRes.data) return { error: "문장을 찾을 수 없습니다." };
  if (entryRes.data.session_id === sessionId) return { error: "내 문장에는 좋아요를 누를 수 없어요." };

  const config = normalizeOneLineShareConfig(roomRes.data.activity_config);
  const maxReactions = config?.maxReactionsPerStudent ?? 3;

  if (existingReactionRes.data) {
    const { error } = await admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .delete()
      .eq("id", existingReactionRes.data.id);

    if (error) return { error: "좋아요를 취소하지 못했습니다." };
  } else {
    const { count } = await admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("session_id", sessionId)
      .eq("reaction_type", "like");

    if ((count ?? 0) >= maxReactions) {
      return { error: `좋아요는 ${maxReactions}개까지 누를 수 있어요.` };
    }

    const { error } = await admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .insert({
        room_id: roomId,
        entry_id: entryId,
        session_id: sessionId,
        reaction_type: "like",
      });

    if (error) return { error: "좋아요를 저장하지 못했습니다." };
  }

  return {
    entries: await getOneLineShareBoardForSession(sessionId, roomId),
  };
}

async function getAnonymousQuestionGeneratorResults(sessionId: string, roomId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, submission")
    .eq("room_id", roomId)
    .eq("status", "done")
    .neq("id", sessionId);

  const shuffledSessions = deterministicShuffle(data ?? [], roomId, (session) => session.id);

  return shuffledSessions.flatMap((session, sessionIndex) => {
    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) return [];

    return submission.selections.map((selection, selectionIndex) => ({
      id: `${session.id}-${selection.id}`,
      order: sessionIndex + 1,
      questionOrder: selectionIndex + 1,
      text: selection.remixedQuestion,
    }));
  });
}

async function getQuestionVotingRankingForRoom(roomId: string, config: NonNullable<ReturnType<typeof normalizeQuestionVotingConfig>>) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("submission")
    .eq("room_id", roomId)
    .eq("status", "done");

  const submissions = (data ?? [])
    .map((session) => normalizeQuestionVotingSubmission(session.submission))
    .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission));

  return buildQuestionVotingRanking(config, submissions);
}

async function getOneLineShareBoardForSession(sessionId: string, roomId: string) {
  const admin = createSupabaseAdminClient();
  const [entriesRes, reactionsRes] = await Promise.all([
    admin
      .schema("writing_helper")
      .from("one_line_entries")
      .select("id, session_id, student_number, student_name, content, contains_keywords, created_at, updated_at")
      .eq("room_id", roomId),
    admin
      .schema("writing_helper")
      .from("one_line_reactions")
      .select("entry_id, session_id")
      .eq("room_id", roomId)
      .eq("reaction_type", "like"),
  ]);

  return buildOneLineShareBoard(entriesRes.data ?? [], reactionsRes.data ?? [], sessionId);
}

async function getOneLineShareEntryBySession(sessionId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("one_line_entries")
    .select("id, content, contains_keywords, created_at, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!data) return null;

  return {
    entryId: data.id,
    content: data.content,
    containsKeywords: data.contains_keywords,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function getReactionCountForEntry(roomId: string, entryId: string) {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .schema("writing_helper")
    .from("one_line_reactions")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("entry_id", entryId)
    .eq("reaction_type", "like");

  return count ?? 0;
}
