"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { isIntegratedLab } from "@/lib/lab-roster";
import {
  ensureIntegratedStudentRoomSession,
  ownsIntegratedStudentSession,
} from "@/lib/lab-student-session";
import { parseOutlineResult } from "@/lib/result-format";
import { persistPortableResult } from "@/lib/portable-results";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";
import { deterministicShuffle } from "@/lib/anonymous-order";
import { buildOneLineShareBoard, includesAllConfiguredKeywords, normalizeOneLineShareConfig } from "@/lib/one-line-share";
import {
  buildHanjaWritingBoard,
  extractHanjaWritingContents,
  normalizeHanjaWritingConfig,
  sentenceContainsWord,
} from "@/lib/hanja-writing";
import {
  buildQuestionVotingRanking,
  normalizeQuestionVotingConfig,
  normalizeQuestionVotingSubmission,
} from "@/lib/question-voting";
import type { StudentLevel } from "@/types";
import type {
  OneLineShareSubmission,
  OutlineTemplateAnswer,
  QuestionGeneratorSubmission,
  QuestionVotingSubmission,
} from "@/features/activities/types";

// 학생 인증 (번호+이름 대조)
export async function verifyStudent(
  roomId: string,
  studentNumber: number,
  studentName: string
): Promise<{ error?: string; studentId?: string; sessionId?: string; status?: string }> {
  if (!roomId || typeof roomId !== "string" || roomId.length > 100) return { error: "잘못된 요청입니다." };
  if (isIntegratedLab()) {
    return ensureIntegratedStudentRoomSession(roomId);
  }

  // 구 helper의 번호·이름 입장 호환 경로
  if (!Number.isInteger(studentNumber) || studentNumber < 1 || studentNumber > 100) return { error: "출석 번호는 1~100 사이여야 합니다." };
  if (!studentName || typeof studentName !== "string" || studentName.trim().length === 0 || studentName.length > 50) return { error: "이름을 올바르게 입력해주세요." };

  const admin = createSupabaseAdminClient();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, is_active, class_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "방을 찾을 수 없습니다." };
  // 기한으로 닫지 않는다(2026-08-19). 교사가 `종료`를 눌러야만 닫힌다.
  // 예전에 만든 방에는 `expires_at` 이 남아 있지만 더는 보지 않는다.
  if (!room.is_active) return { error: "이미 종료된 활동입니다." };

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
  let existingQuery = admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, status")
    .eq("room_id", roomId);
  existingQuery = existingQuery
    .eq("student_number", studentNumber)
    .eq("student_name", studentName);
  const { data: existing } = await existingQuery.maybeSingle();

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
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) return null;

  const [sessionRes, roomRes] = await Promise.all([
    admin.schema("writing_helper").from("student_sessions")
      .select("student_name, submission, answers, result").eq("id", sessionId).maybeSingle(),
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
    const myContents = extractHanjaWritingContents(sessionRes.data?.submission);
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
      hanjaWritingEntry: myContents.length > 0 ? { contents: myContents } : null,
      hanjaWritingBoard,
    };
  }

  const rawAnswers = Array.isArray(sessionRes.data?.answers) ? sessionRes.data!.answers as unknown[] : [];
  const outlineAnswers = rawAnswers
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null && !Array.isArray(a))
    .map((a) => ({
      section: (a.section === "처음" || a.section === "가운데" || a.section === "끝") ? a.section : "처음",
      itemId: typeof a.itemId === "string" ? a.itemId : "",
      label: typeof a.label === "string" ? a.label : "",
      answer: typeof a.answer === "string" ? a.answer : "",
    }))
    .filter((a) => a.label || a.answer);

  return {
    activityType,
    outline: "",
    draft: "",
    outlineAnswers,
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
      .select("target_session_id, target_sentence_index, session_id")
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
  if (!await ownsIntegratedStudentSession(admin, sessionId)) {
    return { error: "내 활동만 수정할 수 있습니다." };
  }

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
  answers: OutlineTemplateAnswer[]
): Promise<{ error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId)) {
    return { error: "내 활동만 수정할 수 있습니다." };
  }

  const { data: savedSession, error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({ answers, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("room_id, status")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!savedSession) return { error: "세션을 찾을 수 없습니다." };

  // 완성한 개요를 다시 고치는 중에는 자동 저장·수동 저장도 아지트가 읽는
  // 같은 portable_results 행을 갱신해야 한다. session_id가 유일 키라 결과 ID는
  // 유지되고, 글쓰기창에 고정된 포인터는 최신 chunks를 계속 따라간다.
  if (savedSession.status === "done") {
    if (!savedSession.room_id
        || !await persistPortableResult(admin, sessionId, savedSession.room_id)) {
      return {
        error: "개요는 저장했지만 아지트 참고 개요를 최신화하지 못했어요. 잠시 후 다시 저장해주세요.",
      };
    }
  }

  return {};
}

// 개요 제출 (AI 호출 없이 학생 답변만 저장하고 세션 완료 처리)
export async function requestOutline(
  sessionId: string,
  latestAnswers?: OutlineTemplateAnswer[]
): Promise<{ error?: string; done?: boolean }> {
  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId)) {
    return { error: "내 활동만 제출할 수 있습니다." };
  }

  if (latestAnswers && latestAnswers.length > 0) {
    const { error: updateError } = await admin
      .schema("writing_helper")
      .from("student_sessions")
      .update({ answers: latestAnswers, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateError) return { error: "답변 저장 중 오류가 발생했습니다." };
  }

  const { data: session } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, room_id, answers")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { error: "세션을 찾을 수 없습니다." };

  const answersToUse = latestAnswers && latestAnswers.length > 0 ? latestAnswers : session.answers;
  if (!answersToUse || (Array.isArray(answersToUse) && answersToUse.length === 0)) {
    return { error: "작성한 항목이 없습니다. 한 가지 이상 골라서 써 보세요." };
  }

  if (!await persistPortableResult(admin, sessionId, session.room_id ?? "")) {
    return { error: "활동 결과를 아지트에 연결하지 못했습니다. 다시 제출해주세요." };
  }

  return { done: true };
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

// 학생 세션 가져오기
export async function getStudentSession(sessionId: string) {
  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId)) return null;

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
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) return null;

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
    .select("topic, topic_description, title, question_sets, activity_type, activity_config, activity_state")
    .eq("id", roomId)
    .maybeSingle();
  if (!data) return null;

  const { data: submissionData } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    // `updated_at` 은 이 단말의 임시본과 서버 저장본 중 어느 쪽이 최신인지 가리는 데 쓴다(2026-08-24).
    .select("submission, status, answers, gpt_call_count, result, updated_at")
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

  const hanjaSubmissionContents = extractHanjaWritingContents(submissionData?.submission);

  // outline_builder 신규 방: activity_config.outlineTemplate 추출
  const outlineTemplate = (() => {
    const config = data.activity_config as Record<string, unknown> | null;
    if (!config) return null;
    const t = config.outlineTemplate;
    if (!t || typeof t !== "object" || Array.isArray(t)) return null;
    return t as import("@/lib/outline-templates").OutlineTemplate;
  })();

  // 기존 방 호환: question_sets가 있으면 레거시로 표시
  const isLegacyRoom = (() => {
    if (data.activity_type && data.activity_type !== "outline_builder") return false;
    const config = data.activity_config as Record<string, unknown> | null;
    // question_sets가 config에 있거나 루트에 있으면 레거시
    if (config?.questionSets) return true;
    if ((data as Record<string, unknown>).question_sets) return true;
    return false;
  })();

  const existingOutlineAnswers = Array.isArray(submissionData?.answers)
    ? (submissionData!.answers as unknown[])
        .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null && !Array.isArray(a))
        .map((a) => ({
          section: (a.section === "처음" || a.section === "가운데" || a.section === "끝") ? a.section : "처음",
          itemId: typeof a.itemId === "string" ? a.itemId : "",
          label: typeof a.label === "string" ? a.label : "",
          answer: typeof a.answer === "string" ? a.answer : "",
        }))
        .filter((a) => a.itemId)
    : [];

  return {
    ...data,
    outline_template: outlineTemplate,
    is_legacy_outline_room: isLegacyRoom,
    existing_outline_answers: existingOutlineAnswers,
    existing_answers_saved_at: typeof submissionData?.updated_at === "string" ? submissionData.updated_at : null,
    outline_gpt_call_count: typeof submissionData?.gpt_call_count === "number" ? submissionData.gpt_call_count : 0,
    existing_submission: normalizeQuestionGeneratorSubmission(submissionData?.submission),
    existing_voting_submission: normalizeQuestionVotingSubmission(submissionData?.submission),
    existing_one_line_submission: oneLineEntry
      ? ({
          entryId: oneLineEntry.id,
          content: oneLineEntry.content,
        } satisfies OneLineShareSubmission)
      : null,
    existing_hanja_writing_submission: hanjaSubmissionContents.length > 0 ? { contents: hanjaSubmissionContents } : null,
    session_status: submissionData?.status ?? "in_progress",
  };
}

/**
 * 개요짜기에서 학생이 친구들과 만든 질문을 직접 추가할 때만 호출한다.
 *
 * 질문 만들기 원본이나 학생별 투표 결과는 읽지 않고, 교사가 문장을 다듬고
 * 포함 여부를 정해 좋은 질문 고르기 방에 저장한 sourceQuestions만 반환한다.
 */
export async function getOutlineSharedQuestionCandidates(sessionId: string, roomId: string) {
  if (!sessionId || !roomId || sessionId.length > 100 || roomId.length > 100) {
    return { rooms: [], error: "잘못된 요청입니다." };
  }

  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { rooms: [], error: "내 활동에서만 질문을 불러올 수 있습니다." };
  }

  const [{ data: session }, { data: outlineRoom, error: roomError }] = await Promise.all([
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
      .select("id, teacher_id, class_id, agit_class_id, activity_type")
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  if (
    !session
    || roomError
    || !outlineRoom
    || (outlineRoom.activity_type && outlineRoom.activity_type !== "outline_builder")
  ) {
    return { rooms: [], error: "개요짜기 활동을 확인하지 못했습니다." };
  }

  const classColumn = outlineRoom.agit_class_id ? "agit_class_id" : "class_id";
  const classId = outlineRoom.agit_class_id ?? outlineRoom.class_id;
  if (!classId) {
    return { rooms: [], error: "연결된 학급을 확인하지 못했습니다." };
  }

  const { data: votingRooms, error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, title, topic, activity_config, is_active, created_at")
    .eq("teacher_id", outlineRoom.teacher_id)
    .eq(classColumn, classId)
    .eq("activity_type", "question_voting")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return { rooms: [], error: "친구들과 만든 질문을 불러오지 못했습니다." };
  }

  // 우리 반이 실제로 고른 질문을 **득표순**으로 보여 준다(후보 전체가 아니다).
  // 개요에 넣을 질문은 "친구들이 좋다고 고른 것"이어야 활동이 이어진다.
  const votingRoomIds = (votingRooms ?? []).map((room) => room.id);
  const { data: votingSessions } = votingRoomIds.length > 0
    ? await admin
        .schema("writing_helper")
        .from("student_sessions")
        .select("room_id, submission")
        .in("room_id", votingRoomIds)
    : { data: [] as Array<{ room_id: string; submission: unknown }> };

  const submissionsByRoom = new Map<string, QuestionVotingSubmission[]>();
  for (const row of votingSessions ?? []) {
    const submission = normalizeQuestionVotingSubmission(row.submission);
    if (!submission || submission.selectedQuestionIds.length === 0) continue;
    const bucket = submissionsByRoom.get(row.room_id) ?? [];
    bucket.push(submission);
    submissionsByRoom.set(row.room_id, bucket);
  }

  let remainingQuestionCount = 100;
  const rooms = (votingRooms ?? []).flatMap((room) => {
    if (remainingQuestionCount <= 0) return [];

    const config = normalizeQuestionVotingConfig(room.activity_config);
    if (!config) return [];

    const ranking = buildQuestionVotingRanking(config, submissionsByRoom.get(room.id) ?? []);
    // 한 표도 못 받은 질문은 담지 않는다 — `선별된 좋은 질문`이라는 말의 뜻이 흐려진다.
    // 아직 아무도 고르지 않았으면(투표 전) 후보를 순서대로 보여 준다.
    const voted = ranking.filter((entry) => entry.votes > 0);
    const source = voted.length > 0
      ? voted
      : config.sourceQuestions.map((question) => ({ questionId: question.id, text: question.text, votes: 0 }));

    const questions = source
      .slice(0, remainingQuestionCount)
      .map((entry, index) => ({
        // 원본 ID에는 학생 세션 ID가 들어갈 수 있어 학생 화면에는 노출하지 않는다.
        id: `question-${index + 1}`,
        text: entry.text,
        votes: entry.votes,
      }));
    remainingQuestionCount -= questions.length;
    if (questions.length === 0) return [];

    return [{
      roomId: room.id,
      title: room.title?.trim() || config.sourceRoomTitle || room.topic?.trim() || "좋은 질문 고르기",
      topic: room.topic?.trim() || "",
      createdAt: room.created_at,
      isActive: room.is_active,
      questions,
    }];
  });

  return { rooms };
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
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동만 제출할 수 있습니다." };
  }

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

  const activityConfig = roomRes.data.activity_config as { minSelections?: unknown; maxSelections?: unknown } | null;
  const configMaxSelections = Number(activityConfig?.maxSelections);
  const maxSelections = Number.isFinite(configMaxSelections)
    ? Math.min(Math.max(Math.trunc(configMaxSelections), 1), 4)
    : 4;
  // 하한이 없어 선생님이 3개로 정해도 1개만 쓰고 제출되던 것을 막는다.
  // 예전에 만든 방에는 minSelections 가 없으므로 1로 읽어 지금까지와 똑같이 둔다.
  const configMinSelections = Number(activityConfig?.minSelections);
  const minSelections = Number.isFinite(configMinSelections)
    ? Math.min(Math.max(Math.trunc(configMinSelections), 1), maxSelections)
    : 1;

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

  if (sanitizedSelections.length < minSelections) {
    const shortage = minSelections - sanitizedSelections.length;
    return {
      error: minSelections === maxSelections
        ? `질문을 ${minSelections}개 만들어야 해요. ${shortage}개 더 만들어 주세요.`
        : `적어도 ${minSelections}개는 만들어야 해요. ${shortage}개 더 만들어 주세요.`,
    };
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "질문 저장에 실패했습니다." };
  if (!await persistPortableResult(admin, sessionId, roomId)) {
    return { error: "질문 결과를 아지트에 연결하지 못했습니다. 다시 제출해주세요." };
  }

  // Realtime에는 질문 원문을 싣지 않고, 교사 화면이 권한 검사를 거친 결과 조회를
  // 다시 실행할 수 있는 최소 신호만 보낸다. 이벤트 기록 실패 시에도 제출 결과는
  // 이미 저장되었으며 교사 화면의 보완 폴링이 회수한다.
  const { error: eventError } = await admin
    .schema("writing_helper")
    .from("activity_events")
    .insert({
      room_id: roomId,
      session_id: sessionId,
      event_type: "question_generator_submitted",
      payload: { version: 1 },
    });
  if (eventError) {
    console.error("[question-generator-live] submission signal failed", eventError.code ?? "unknown");
  }
  return {};
}

export async function submitQuestionVoting(
  sessionId: string,
  roomId: string,
  submission: QuestionVotingSubmission,
): Promise<{ error?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };

  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동만 제출할 수 있습니다." };
  }

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
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "질문 평가 저장에 실패했습니다." };
  if (!await persistPortableResult(admin, sessionId, roomId)) {
    return { error: "질문 결과를 아지트에 연결하지 못했습니다. 다시 제출해주세요." };
  }
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
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동만 제출할 수 있습니다." };
  }

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
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "학생 활동 상태 저장에 실패했습니다." };
  if (!await persistPortableResult(admin, sessionId, roomId)) {
    return { error: "한 줄 결과를 아지트에 연결하지 못했습니다. 다시 제출해주세요." };
  }
  return { entryId: entryRes.data.id };
}

export async function submitHanjaWriting(
  sessionId: string,
  roomId: string,
  contents: string[],
): Promise<{ error?: string }> {
  if (!sessionId || !roomId) return { error: "잘못된 요청입니다." };

  const normalizedContents = contents
    .map((content) => content.trim())
    .filter(Boolean);
  if (normalizedContents.length === 0) {
    return { error: "문장을 하나 이상 적어주세요." };
  }

  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동만 제출할 수 있습니다." };
  }

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

  const config = normalizeHanjaWritingConfig(roomRes.data.activity_config);
  const targetWord = config?.card.word.trim() ?? "";
  const sentenceCount = config?.sentenceCount ?? 1;
  if (normalizedContents.length !== sentenceCount) {
    return { error: `문장은 ${sentenceCount}개를 모두 작성해야 해요.` };
  }
  if (targetWord && normalizedContents.some((content) => !sentenceContainsWord(content, targetWord))) {
    return { error: `모든 문장에 "${targetWord}" 단어가 들어가야 해요.` };
  }

  const { error } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .update({
      submission: {
        contents: normalizedContents,
        content: normalizedContents[0],
      },
      result: { submitted: true, likeCount: 0 },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("room_id", roomId);

  if (error) return { error: "문장 저장에 실패했습니다." };
  if (!await persistPortableResult(admin, sessionId, roomId)) {
    return { error: "문장 결과를 아지트에 연결하지 못했습니다. 다시 제출해주세요." };
  }
  return {};
}

export async function toggleHanjaWritingReaction(
  sessionId: string,
  roomId: string,
  targetSessionId: string,
  targetSentenceIndex: number,
): Promise<{
  error?: string;
  entries?: Awaited<ReturnType<typeof getHanjaWritingBoardForRoom>>;
}> {
  if (!sessionId || !roomId || !targetSessionId || !Number.isInteger(targetSentenceIndex) || targetSentenceIndex < 0) {
    return { error: "잘못된 요청입니다." };
  }

  const admin = createSupabaseAdminClient();
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동에서만 반응할 수 있습니다." };
  }

  const [sessionRes, roomRes, targetRes, existingReactionRes, currentCountRes] = await Promise.all([
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
      .select("is_active, activity_type, activity_config")
      .eq("id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("student_sessions")
      .select("id, status, submission")
      .eq("id", targetSessionId)
      .eq("room_id", roomId)
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .select("id")
      .eq("room_id", roomId)
      .eq("target_session_id", targetSessionId)
      .eq("target_sentence_index", targetSentenceIndex)
      .eq("session_id", sessionId)
      .eq("reaction_type", "like")
      .maybeSingle(),
    admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("session_id", sessionId)
      .eq("reaction_type", "like"),
  ]);

  if (!sessionRes.data) return { error: "학생 세션을 찾을 수 없습니다." };
  if (!roomRes.data?.is_active) return { error: "이미 종료된 활동입니다." };
  if (roomRes.data.activity_type !== "hanja_writing") return { error: "활동 종류가 맞지 않습니다." };
  if (!targetRes.data || targetRes.data.status !== "done") return { error: "문장을 찾을 수 없습니다." };
  if (sessionRes.data.status !== "done") return { error: "먼저 내 문장을 제출한 뒤 반응할 수 있어요." };

  const targetContents = extractHanjaWritingContents(targetRes.data.submission);
  if (targetSessionId === sessionId) return { error: "내 문장에는 좋아요를 누를 수 없어요." };
  if (!targetContents[targetSentenceIndex]) return { error: "문장을 찾을 수 없습니다." };

  if (existingReactionRes.data) {
    const { error } = await admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .delete()
      .eq("id", existingReactionRes.data.id);

    if (error) return { error: "좋아요를 취소하지 못했습니다." };
  } else {
    const config = normalizeHanjaWritingConfig(roomRes.data.activity_config);
    const maxReactions = config?.maxReactionsPerStudent ?? 3;
    const currentCount = currentCountRes.count ?? 0;
    if (currentCount >= maxReactions) {
      return { error: `좋아요는 한 학생당 최대 ${maxReactions}개까지 누를 수 있어요.` };
    }

    const { error } = await admin
      .schema("writing_helper")
      .from("hanja_writing_reactions")
      .insert({
        room_id: roomId,
        target_session_id: targetSessionId,
        target_sentence_index: targetSentenceIndex,
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
  if (!await ownsIntegratedStudentSession(admin, sessionId, roomId)) {
    return { error: "내 활동에서만 반응할 수 있습니다." };
  }

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
