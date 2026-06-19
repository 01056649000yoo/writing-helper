"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "./auth-actions";
import { correctKoreanSpelling, generateHanjaWordCard, type GeneratedHanjaCard } from "@/lib/gpt";
import { getTeacherOpenAiAccess, logApiUsage } from "@/lib/service-admin";
import { buildHanjaWritingBoard } from "@/lib/hanja-writing";
import { getTeacherQuestionCardSettingsTree } from "@/lib/question-card-sets";
import { normalizeQuestionGeneratorSubmission } from "@/lib/question-generator-submission";
import { deterministicShuffle } from "@/lib/anonymous-order";
import { buildQuestionVotingRanking, normalizeQuestionVotingSubmission, normalizeQuestionVotingConfig } from "@/lib/question-voting";
import { buildOneLineShareBoard, normalizeKeywordText } from "@/lib/one-line-share";
import {
  assignWordGameTeam,
  buildWordGameQuestions,
  buildWordGameRoomSummary,
  createDefaultWordGameTeams,
} from "@/lib/word-game";
import type {
  ActivityType,
  HanjaWordCard,
  OutlineBuilderConfig,
  OneLineShareConfig,
  OneLineShareRoomResult,
  OutlineTemplate,
  QuestionGeneratorConfig,
  QuestionVotingConfig,
  QuestionVotingRoomResult,
  HanjaWritingConfig,
  WordGameConfig,
  WordGameRoomResult,
  WordGameResult,
  WordGameStudentProgress,
} from "@/features/activities/types";
import type { SubjectType, GradeLevel, OutlineDepth, RoomStudent } from "@/types";

export type SavedHanjaWordCard = HanjaWordCard & {
  id: string;
  teacherId: string;
  sourceRoomId: string | null;
  createdAt: string;
  updatedAt: string;
};


/** 교사용: 방의 outlineTemplate AI 항목 보충 */
export async function enhanceOutlineTemplateWithAI(
  subjectType: SubjectType,
  gradeLevel: GradeLevel,
  topic: string,
  topicDescription: string,
  currentTemplate: OutlineTemplate,
  section: "처음" | "가운데" | "끝",
): Promise<{ items?: import("@/lib/outline-templates").OutlineTemplateItem[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const keyAccess = await getTeacherOpenAiAccess(user.id);
  if (keyAccess.error || !keyAccess.access) return { error: keyAccess.error ?? "OpenAI API 키를 불러올 수 없습니다." };

  const client = (await import("@/lib/gpt")).createOpenAIClient(keyAccess.access.apiKey);
  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel] ?? gradeLevel;

  const GENRE_GUIDES: Record<SubjectType, { desc: string; sectionFocus: Record<"처음" | "가운데" | "끝", string> }> = {
    "생활문":     { desc: "일상에서 겪은 일을 솔직하게 기록하는 글", sectionFocus: { "처음": "언제·어디서·누구와 있었던 일인지 상황 소개", "가운데": "겪은 일의 구체적 장면과 그때의 생각·감정", "끝": "느낀 점이나 앞으로의 다짐" } },
    "일기":       { desc: "하루 있었던 일 중 인상적인 순간을 감정 중심으로 쓰는 글", sectionFocus: { "처음": "날짜·날씨·그날의 전반적인 기분", "가운데": "가장 기억에 남는 일과 그 순간의 감정·생각", "끝": "하루를 마치며 드는 느낌이나 내일에 대한 기대" } },
    "편지":       { desc: "받는 사람을 정하고 마음을 전하는 글", sectionFocus: { "처음": "받는 사람에 대한 안부와 편지를 쓰는 이유", "가운데": "전하고 싶은 이야기나 고마움·미안함·그리움 등 구체적 내용", "끝": "받는 사람을 향한 바람과 끝인사" } },
    "독서감상문": { desc: "책을 읽고 내용·감동·생각을 정리하는 글", sectionFocus: { "처음": "책 제목·작가·읽게 된 이유와 처음 인상", "가운데": "가장 인상적인 장면이나 인물, 그리고 그 이유·자신의 생각", "끝": "책을 읽고 달라진 생각이나 삶에 적용하고 싶은 점" } },
    "기행문":     { desc: "여행에서 보고 듣고 느낀 것을 시간 순서로 기록하는 글", sectionFocus: { "처음": "여행 날짜·날씨·여행지 이름·함께 간 사람·여행을 떠난 이유와 기대", "가운데": "여행지에서 본 것·들은 것·한 일과 그때의 감정·생각 (장소별·시간별)", "끝": "여행을 마치고 드는 소감, 가장 기억에 남는 장면, 다음 여행에 대한 기대" } },
    "관찰기록문": { desc: "대상을 꾸준히 살펴보고 변화를 사실대로 기록하는 글", sectionFocus: { "처음": "관찰 대상·관찰 기간·관찰 이유와 관찰 전 예상", "가운데": "날짜별·단계별 변화 모습, 특이하게 발견한 점", "끝": "관찰을 통해 새롭게 알게 된 사실이나 느낀 점" } },
    "이야기 글":  { desc: "인물·사건·배경이 있는 창작 이야기", sectionFocus: { "처음": "주인공 소개, 이야기가 일어나는 배경(시간·장소)과 사건의 발단", "가운데": "사건의 전개와 갈등, 인물의 행동과 감정 변화", "끝": "갈등 해결 방법과 이야기의 결말, 주인공이 깨달은 것" } },
    "설명하는 글": { desc: "어떤 대상이나 현상을 정확하게 알려주는 글", sectionFocus: { "처음": "설명할 대상 소개와 글을 쓰는 목적, 독자에게 던지는 질문", "가운데": "대상의 특징·종류·방법·원인 등 핵심 정보를 항목별로", "끝": "내용 요약과 독자가 알아두면 좋을 핵심 메시지" } },
    "주장하는 글": { desc: "자신의 의견을 근거를 들어 설득하는 글", sectionFocus: { "처음": "주제를 소개하고 자신의 주장을 명확하게 제시", "가운데": "주장을 뒷받침하는 근거 2~3가지와 구체적인 예시·사례", "끝": "주장 재강조와 독자에게 바라는 행동·변화" } },
    "소개하는 글": { desc: "대상(사람·장소·물건 등)의 특징을 알기 쉽게 소개하는 글", sectionFocus: { "처음": "소개할 대상이 무엇인지, 왜 이 대상을 골랐는지", "가운데": "대상의 특징·장점·흥미로운 점을 구체적 예시와 함께", "끝": "이 대상을 소개하며 전하고 싶은 핵심 메시지나 추천 이유" } },
    "동시":       { desc: "리듬과 비유로 마음과 장면을 짧고 압축적으로 표현하는 시", sectionFocus: { "처음": "시의 첫 장면 또는 말하고 싶은 대상·마음을 여는 표현", "가운데": "비유나 반복으로 감각적으로 표현한 장면이나 감정", "끝": "여운을 남기는 마무리 구절 또는 마음속 바람" } },
    "보고서":     { desc: "조사·실험한 내용을 사실에 근거해 체계적으로 정리하는 글", sectionFocus: { "처음": "조사·실험 주제와 그 이유, 조사 기간·방법 소개", "가운데": "조사·실험 과정과 결과를 사실대로 정리 (표·목록 활용 가능)", "끝": "결과를 통해 알게 된 점, 의견과 사실의 구분, 더 알고 싶은 점" } },
  };

  const guide = GENRE_GUIDES[subjectType];
  const currentSectionItems = currentTemplate.sections
    .find((s) => s.key === section)?.items ?? [];
  const currentItemsText = currentSectionItems
    .map((i) => `  - ${i.label}`)
    .join("\n");

  const prompt = `초등학교 ${gradeDesc} "${subjectType}" 글쓰기 개요 짜기 활동입니다.

[${subjectType}의 특성]
${guide.desc}

["${section}" 단계에서 다뤄야 할 내용]
${guide.sectionFocus[section]}

[활동 주제]
${topic || "(미입력)"}

[주제 부연설명]
${topicDescription || "(미입력)"}

[현재 "${section}" 단계에 이미 있는 항목]
${currentItemsText || "(없음)"}

위 글 종류의 특성과 "${section}" 단계의 역할, 그리고 활동 주제와 부연설명에 딱 맞는 새 항목을 2~3개 제안해주세요.
- 이미 있는 항목과 겹치지 않아야 합니다.
- 초등학생이 실제로 쓸 수 있는 구체적인 내용이어야 합니다.
- label은 짧고 명확한 개요 항목 이름입니다 (예: "언제, 어디서", "느낀 점", "주인공 소개"). 질문 문장으로 쓰지 마세요.
- placeholder는 학생이 그 항목에 쓸 만한 구체적인 예시 답변입니다.

JSON 형식으로만 응답:
{
  "items": [
    {"id": "new_1", "label": "짧은 항목 이름", "placeholder": "예) ..."},
    ...
  ]
}`;

  try {
    await logApiUsage({
      teacherId: user.id,
      feature: "enhance_outline_template",
      model: "gpt-4o",
      usedSharedApi: keyAccess.access.usedSharedApi,
      metadata: { subjectType, section },
    });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    const content = response.choices[0].message.content;
    if (!content) return { items: [] };
    const parsed = JSON.parse(content) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return { items: [] };
    return {
      items: parsed.items
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : `new_${Math.random().toString(36).slice(2, 7)}`,
          label: typeof item.label === "string" ? item.label : "",
          placeholder: typeof item.placeholder === "string" ? item.placeholder : "",
        }))
        .filter((item) => item.label),
    };
  } catch {
    return { error: "AI 제안을 불러오지 못했습니다." };
  }
}

/** 2단계: 수정된 질문 세트로 활동 세션 저장 */
export async function createRoom(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const classId = String(formData.get("class_id") ?? "").trim();
  let topic = String(formData.get("topic") ?? "").trim();
  let topicDescription = String(formData.get("topic_description") ?? "").trim();
  const activityType = parseActivityType(formData.get("activity_type"));
  const subjectType = String(formData.get("subject_type")) as SubjectType;
  const gradeLevel = String(formData.get("grade_level")) as GradeLevel;
  const outlineDepth = (String(formData.get("outline_depth")) || "simple") as OutlineDepth;
  const durationHours = Math.min(Math.max(Number(formData.get("duration_hours") ?? 4), 4), 168);

  if (!classId) return { error: "학급을 선택해주세요." };

  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  const baseRoomPayload = {
    teacher_id: user.id,
    class_id: classId,
    title: topic,
    topic,
    topic_description: topicDescription,
    subject_type: subjectType,
    grade_level: gradeLevel,
    outline_depth: outlineDepth,
    question_sets: null as null,
    questions_generated_at: null as null,
    expires_at: expiresAt,
    is_active: true,
  };

  let activityConfig: OutlineBuilderConfig | QuestionGeneratorConfig | QuestionVotingConfig | OneLineShareConfig | HanjaWritingConfig | WordGameConfig;

  if (activityType === "outline_builder") {
    // 교사가 커스텀 템플릿을 전달했으면 사용, 없으면 null (런타임에 기본값 사용)
    const customTemplateJson = String(formData.get("outline_template_json") ?? "").trim();
    let outlineTemplate: OutlineTemplate | null = null;
    if (customTemplateJson) {
      try {
        outlineTemplate = JSON.parse(customTemplateJson) as OutlineTemplate;
      } catch {
        return { error: "템플릿 데이터가 올바르지 않습니다." };
      }
    }

    activityConfig = {
      subjectType,
      gradeLevel,
      outlineDepth,
      outlineTemplate,
    };
  } else if (activityType === "question_generator") {
    if (!topicDescription) {
      return { error: "학생에게 보여줄 활동 가이드를 주제 부연 설명에 입력해주세요." };
    }

    const guidance = String(formData.get("guidance") ?? "").trim()
      || "마음에 드는 질문 카드를 고른 뒤, 오늘 주제에 어울리게 질문을 바꿔 봅시다.";
    const { cardSets: teacherCardSets, roles: teacherRoles } = await getTeacherQuestionCardSettingsTree(admin, user.id);
    const allowedIds = new Set(teacherCardSets.map((cardSet) => cardSet.id));
    const enabledCardSetIds = formData
      .getAll("enabled_card_set_ids")
      .map((value) => String(value))
      .filter((value): value is string => allowedIds.has(value));

    if (enabledCardSetIds.length === 0) {
      return { error: "질문 카드 묶음을 1개 이상 선택해주세요." };
    }

    activityConfig = {
      enabledCardSetIds,
      cardSets: teacherCardSets.filter((cardSet) => enabledCardSetIds.includes(cardSet.id)),
      roles: teacherRoles
        .map((role) => ({
          ...role,
          cardSetIds: role.cardSetIds.filter((cardSetId) => enabledCardSetIds.includes(cardSetId)),
        }))
        .filter((role) => role.cardSetIds.length > 0),
      maxSelections: clampNumber(formData.get("max_selections"), 1, 4, 1),
      guidance,
    };
  } else if (activityType === "question_voting") {
    const sourceRoomId = String(formData.get("source_room_id") ?? "").trim();
    const evaluationCriteria = String(formData.get("evaluation_criteria") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!sourceRoomId) {
      return { error: "질문을 가져올 질문 만들기 활동을 선택해주세요." };
    }

    const sourceRoom = await getQuestionGeneratorSourceRoomSummary(admin, user.id, sourceRoomId);
    if (!sourceRoom) {
      return { error: "질문 만들기 결과를 불러오지 못했습니다. 다시 선택해주세요." };
    }

    const sourceQuestionMap = new Map(sourceRoom.questions.map((question) => [question.id, question] as const));
    const fullPayload = parseVotingQuestionsPayload(formData.get("voting_questions"));
    const legacyPayload = parseSelectedVotingQuestions(formData.get("selected_questions"));

    const buildCurated = (entries: Array<{ id: string; text: string }>) =>
      entries
        .map((question) => {
          const source = sourceQuestionMap.get(question.id);
          if (!source) return null;
          const text = question.text.trim();
          if (!text) return null;
          return { id: source.id, text };
        })
        .filter((question): question is { id: string; text: string } => question !== null);

    const curatedQuestions = fullPayload
      ? buildCurated(fullPayload.filter((entry) => entry.included))
      : buildCurated(legacyPayload ?? sourceRoom.questions);

    if (curatedQuestions.length === 0) {
      return { error: "고르기에 올릴 질문을 1개 이상 선택해주세요." };
    }

    if (fullPayload) {
      const backwriteUpdates: Array<{ sessionId: string; selectionId: string; newText: string }> = [];
      for (const entry of fullPayload) {
        const source = sourceQuestionMap.get(entry.id);
        if (!source) continue;
        const trimmed = entry.text.trim();
        if (!trimmed || trimmed === source.text) continue;
        const sessionId = entry.sourceSessionId ?? source.sourceSessionId;
        const selectionId = entry.sourceSelectionId ?? source.sourceSelectionId;
        if (!sessionId || !selectionId) continue;
        backwriteUpdates.push({ sessionId, selectionId, newText: trimmed });
      }
      if (backwriteUpdates.length > 0) {
        await applyQuestionUpdatesForRoom(sourceRoom.roomId, user.id, backwriteUpdates);
      }
    }

    topic = sourceRoom.title || sourceRoom.topic || "좋은 질문 고르기";
    topicDescription = sourceRoom.topic || sourceRoom.title || "";

    // 후보 질문은 학생별 묶음 순서가 드러나지 않도록 섞어서 저장한다. (모든 학생에게 동일한 순서)
    const shuffledQuestions = deterministicShuffle(curatedQuestions, sourceRoom.roomId, (question) => question.id);

    activityConfig = {
      sourceRoomId: sourceRoom.roomId,
      sourceRoomTitle: sourceRoom.title,
      sourceQuestions: shuffledQuestions,
      evaluationCriteria,
      maxSelections: clampNumber(formData.get("max_selections"), 1, shuffledQuestions.length, 1),
    };
  } else if (activityType === "word_game") {
    const grade = clampNumber(formData.get("word_game_grade"), 3, 6, 4) as 3 | 4 | 5 | 6;
    const levelRaw = String(formData.get("word_game_level") ?? "mixed").trim();
    const levelFilter = levelRaw === "1" || levelRaw === "2" || levelRaw === "3"
      ? Number(levelRaw) as 1 | 2 | 3
      : "mixed";
    const categoryFilter = formData
      .getAll("word_game_categories")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const wordCount = clampNumber(formData.get("word_game_word_count"), 8, 15, 10);
    const timeLimit = clampNumber(formData.get("word_game_time_limit"), 60, 180, 90);
    const mode = String(formData.get("word_game_mode") ?? "team") === "individual" ? "individual" : "team";
    const teamCount = clampNumber(formData.get("word_game_team_count"), 2, 4, 2) as 2 | 3 | 4;
    const teamMode = (() => {
      const raw = String(formData.get("word_game_team_mode") ?? "number_alternate");
      return raw === "random_balanced" || raw === "number_block" ? raw : "number_alternate";
    })();
    const allowHints = formData.getAll("word_game_allow_hints").map(String).includes("on");
    const easyStart = formData.getAll("word_game_easy_start").map(String).includes("on");
    const recoveryBonus = formData.getAll("word_game_recovery_bonus").map(String).includes("on");
    const growthBonus = formData.getAll("word_game_growth_bonus").map(String).includes("on");
    const teams = createDefaultWordGameTeams(teamCount);
    const questions = buildWordGameQuestions({
      grade,
      levelFilter,
      categoryFilter,
      wordCount,
      easyStart,
    });

    activityConfig = {
      gameMode: "speed_match",
      mode,
      questionMode: "definition_to_word",
      timeLimit,
      grade,
      levelFilter,
      categoryFilter,
      wordCount,
      allowHints,
      easyStart,
      recoveryBonus,
      growthBonus,
      showLiveTeamBoard: mode === "team",
      teamCount,
      teamMode,
      teams,
      questions,
    };
  } else if (activityType === "hanja_writing") {
    const cardRaw = String(formData.get("hanja_card") ?? "").trim();
    if (!cardRaw) return { error: "한자 카드 정보가 없습니다. 다시 시도해 주세요." };
    let parsedCard: unknown;
    try {
      parsedCard = JSON.parse(cardRaw);
    } catch {
      return { error: "한자 카드 정보를 읽지 못했습니다." };
    }
    if (!parsedCard || typeof parsedCard !== "object") {
      return { error: "한자 카드 정보가 올바르지 않습니다." };
    }
    const cardData = parsedCard as Record<string, unknown>;
    const word = typeof cardData.word === "string" ? cardData.word.trim() : "";
    if (!word) return { error: "단어가 비어 있습니다." };

    const promptTitle = String(formData.get("prompt_title") ?? "").trim()
      || `[${word}] 한자 카드로 한 문장 만들기`;
    const promptDescription = String(formData.get("prompt_description") ?? "").trim()
      || `단어 "${word}"의 한자 뜻과 관련 단어를 살펴본 뒤, 이 단어를 활용해 자연스러운 한 문장을 써보세요.`;

    topic = promptTitle;
    topicDescription = promptDescription;

    activityConfig = {
      promptTitle,
      promptDescription,
      card: {
        word,
        grade: Number(cardData.grade) || 4,
        hanja: Array.isArray(cardData.hanja) ? cardData.hanja : [],
        relatedWords: Array.isArray(cardData.relatedWords) ? cardData.relatedWords : [],
        definition: typeof cardData.definition === "string" ? cardData.definition : "",
        example: typeof cardData.example === "string" ? cardData.example : "",
        category: typeof cardData.category === "string" ? cardData.category : "",
      },
    };
  } else {
    const promptTitle =
      String(formData.get("prompt_title") ?? "").trim()
      || String(formData.get("topic") ?? "").trim()
      || "오늘 수업 한 줄 정리";
    const promptDescription =
      String(formData.get("prompt_description") ?? "").trim()
      || String(formData.get("topic_description") ?? "").trim()
      || "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요.";
    const legacyKeywords = normalizeKeywordText(String(formData.get("keywords") ?? ""));
    const coreFromForm = normalizeKeywordText(String(formData.get("core_keywords") ?? ""));
    const coreKeywords = coreFromForm.length > 0 ? coreFromForm : legacyKeywords;
    const auxiliaryKeywords = normalizeKeywordText(String(formData.get("auxiliary_keywords") ?? ""))
      .filter((keyword) => !coreKeywords.includes(keyword));

    topic = promptTitle;
    topicDescription = promptDescription;

    activityConfig = {
      promptTitle,
      promptDescription,
      coreKeywords,
      auxiliaryKeywords,
      maxReactionsPerStudent: clampNumber(formData.get("max_reactions_per_student"), 1, 10, 3),
    };
  }

  if (!topic) return { error: "주제를 입력해주세요." };

  let { data: room, error: roomError } = await admin
    .schema("writing_helper")
    .from("rooms")
    .insert({
      ...baseRoomPayload,
      title: activityType === "one_line_share"
        ? "한줄모아"
        : activityType === "hanja_writing"
          ? "한자 활용 문장 만들기"
          : activityType === "word_game"
            ? "스피드 매치"
            : topic,
      topic,
      topic_description: topicDescription,
      activity_type: activityType,
      activity_config: activityConfig,
      activity_state: {},
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id")
    .single();

  if (roomError && isMissingActivityColumnError(roomError.message)) {
    const fallback = await admin
      .schema("writing_helper")
      .from("rooms")
      .insert({
        ...baseRoomPayload,
        title: topic,
        topic,
        topic_description: topicDescription,
      })
      .select("id")
      .single();

    room = fallback.data;
    roomError = fallback.error;
  }

  if (roomError || !room) return { error: roomError?.message ?? "활동 세션 생성에 실패했습니다." };

  if (activityType === "hanja_writing") {
    const configCard = normalizeHanjaWordCard((activityConfig as HanjaWritingConfig).card);
    if (configCard) {
      await saveTeacherHanjaWordCard(configCard, room.id);
    }
  }

  await ensureShortLinkForRoom(room.id, user.id, expiresAt);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/class/${classId}`);
  redirect(`/dashboard/room/${room.id}`);
}

function parseActivityType(value: FormDataEntryValue | null): ActivityType {
  return value === "question_generator" || value === "question_voting" || value === "one_line_share" || value === "hanja_writing" || value === "word_game"
    ? value
    : "outline_builder";
}

function normalizeWordGameConfig(value: unknown): WordGameConfig {
  const raw = isRecord(value) ? value : {};
  const teamCount = raw.teamCount === 3 || raw.teamCount === 4 ? raw.teamCount : 2;
  const teams = Array.isArray(raw.teams)
    ? raw.teams
        .filter(isRecord)
        .map((team, index) => ({
          id: typeof team.id === "string" ? team.id : `team-${index + 1}`,
          name: typeof team.name === "string" ? team.name : `${String.fromCharCode(65 + index)}팀`,
          color: typeof team.color === "string" ? team.color : ["#f97316", "#0ea5e9", "#22c55e", "#a855f7"][index] ?? "#f97316",
        }))
    : createDefaultWordGameTeams(teamCount);

  return {
    gameMode: "speed_match",
    mode: raw.mode === "individual" ? "individual" : "team",
    questionMode: "definition_to_word",
    timeLimit: typeof raw.timeLimit === "number" ? raw.timeLimit : 90,
    grade: raw.grade === 3 || raw.grade === 4 || raw.grade === 5 || raw.grade === 6 ? raw.grade : 4,
    levelFilter: raw.levelFilter === 1 || raw.levelFilter === 2 || raw.levelFilter === 3 ? raw.levelFilter : "mixed",
    categoryFilter: Array.isArray(raw.categoryFilter) ? raw.categoryFilter.filter((item): item is string => typeof item === "string") : [],
    wordCount: typeof raw.wordCount === "number" ? raw.wordCount : 10,
    allowHints: raw.allowHints !== false,
    easyStart: raw.easyStart !== false,
    recoveryBonus: raw.recoveryBonus !== false,
    growthBonus: raw.growthBonus !== false,
    showLiveTeamBoard: raw.showLiveTeamBoard !== false,
    teamCount,
    teamMode: raw.teamMode === "random_balanced" || raw.teamMode === "number_block" ? raw.teamMode : "number_alternate",
    teams,
    questions: Array.isArray(raw.questions)
      ? raw.questions.filter((question): question is WordGameConfig["questions"][number] => {
          return isRecord(question)
            && typeof question.id === "string"
            && typeof question.word === "string"
            && typeof question.category === "string"
            && (question.level === 1 || question.level === 2 || question.level === 3)
            && typeof question.prompt === "string"
            && typeof question.answer === "string"
            && typeof question.definition === "string"
            && typeof question.example === "string"
            && Array.isArray(question.choices)
            && question.choices.every((choice) => typeof choice === "string");
        })
      : [],
  };
}

function isMissingActivityColumnError(message: string) {
  return message.includes("activity_type")
    || message.includes("activity_config")
    || message.includes("activity_state");
}

function isMissingTeacherHanjaWordCardsTable(message: string) {
  return message.includes("teacher_hanja_word_cards");
}

function clampNumber(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSelectedVotingQuestions(value: FormDataEntryValue | null): Array<{ id: string; text: string }> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((entry): entry is { id: unknown; text: unknown } => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id.trim() : "",
        text: typeof entry.text === "string" ? entry.text : "",
      }))
      .filter((entry) => entry.id.length > 0);
  } catch {
    return null;
  }
}

type VotingQuestionDraftPayload = {
  id: string;
  text: string;
  included: boolean;
  sourceSessionId?: string;
  sourceSelectionId?: string;
};

function parseVotingQuestionsPayload(value: FormDataEntryValue | null): VotingQuestionDraftPayload[] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry))
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id.trim() : "",
        text: typeof entry.text === "string" ? entry.text : "",
        included: entry.included === true,
        sourceSessionId: typeof entry.sourceSessionId === "string" && entry.sourceSessionId.trim() ? entry.sourceSessionId.trim() : undefined,
        sourceSelectionId: typeof entry.sourceSelectionId === "string" && entry.sourceSelectionId.trim() ? entry.sourceSelectionId.trim() : undefined,
      }))
      .filter((entry) => entry.id.length > 0);
  } catch {
    return null;
  }
}

export async function deleteRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();

  // 종료된 활동 세션만 삭제 허용
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("is_active, class_id, teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return { error: "활동 세션을 찾을 수 없습니다." };
  if (room.teacher_id !== user.id) return { error: "권한이 없습니다." };
  if (room.is_active) return { error: "진행 중인 활동은 삭제할 수 없습니다. 먼저 종료해주세요." };

  const { error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .delete()
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  if (room.class_id) revalidatePath(`/dashboard/class/${room.class_id}`);
  return {};
}

export async function closeRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("rooms")
    .update({ is_active: false })
    .eq("id", roomId)
    .eq("teacher_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/room/${roomId}`);
  return {};
}

export async function getRooms() {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getRoom(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!data) return null;

  const shortCode = await getShortCodeForRoom(roomId, user.id);
  return {
    ...data,
    short_code: shortCode,
  };
}

export async function getRoomStudents(roomId: string): Promise<RoomStudent[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const admin = createSupabaseAdminClient();

  // 소유권 확인하면서 class_id도 함께 조회
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("class_id, teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) return [];

  if (room.class_id) {
    const { data } = await admin
      .schema("writing_helper")
      .from("class_students")
      .select("*")
      .eq("class_id", room.class_id)
      .order("student_number");
    return (data ?? []).map(s => ({ ...s, room_id: roomId }));
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("room_students")
    .select("*")
    .eq("room_id", roomId)
    .order("student_number");
  return data ?? [];
}

export async function getRoomQuestions(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("topic, question_sets, teacher_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!data || data.teacher_id !== user.id) return null;
  const { teacher_id: _, ...rest } = data;
  return rest;
}

export async function getRoomSessions(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();

  // 요청한 교사가 해당 방의 소유자인지 확인
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) return [];

  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at");
  return data ?? [];
}

export async function getWordGameRoomResults(roomId: string): Promise<WordGameRoomResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      rankings: [],
      teams: [],
      progress: {
        totalStudents: 0,
        connectedStudents: 0,
        activeStudents: 0,
        completedStudents: 0,
        averageCorrectRate: 0,
      },
      hardWords: [],
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type, activity_config, class_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "word_game") {
    return {
      rankings: [],
      teams: [],
      progress: {
        totalStudents: 0,
        connectedStudents: 0,
        activeStudents: 0,
        completedStudents: 0,
        averageCorrectRate: 0,
      },
      hardWords: [],
    };
  }

  const config = normalizeWordGameConfig(room.activity_config);
  const students = await getRoomStudents(roomId);
  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("student_number, student_name, status, submission, result")
    .eq("room_id", roomId)
    .order("student_number");

  const progressRows: WordGameStudentProgress[] = (sessions ?? []).map((session) => {
    const submission = isRecord(session.submission) ? session.submission : {};
    const result = isRecord(session.result) ? session.result : {};
    const team = config.mode === "team"
      ? assignWordGameTeam(session.student_number, config.teams, config.teamMode)
      : null;
    return {
      studentNumber: session.student_number,
      studentName: session.student_name,
      status: session.status === "done" ? "done" : "in_progress",
      score: typeof result.score === "number" ? result.score : typeof submission.score === "number" ? submission.score : 0,
      correctCount: typeof result.correctCount === "number" ? result.correctCount : typeof submission.correctCount === "number" ? submission.correctCount : 0,
      wrongCount: typeof result.wrongCount === "number" ? result.wrongCount : typeof submission.wrongCount === "number" ? submission.wrongCount : 0,
      usedHints: typeof result.usedHints === "number" ? result.usedHints : typeof submission.usedHints === "number" ? submission.usedHints : 0,
      currentIndex: typeof submission.currentIndex === "number" ? submission.currentIndex : 0,
      totalQuestions: typeof submission.totalQuestions === "number" ? submission.totalQuestions : config.questions.length,
      teamId: team?.teamId ?? null,
    };
  });

  const resultRows: Array<WordGameResult & { studentNumber: number; studentName: string; status: "in_progress" | "done" }> = (sessions ?? []).map((session) => {
    const raw = isRecord(session.result) ? session.result : isRecord(session.submission) ? session.submission : {};
    const team = config.mode === "team"
      ? assignWordGameTeam(session.student_number, config.teams, config.teamMode)
      : null;
    return {
      score: typeof raw.score === "number" ? raw.score : 0,
      correctCount: typeof raw.correctCount === "number" ? raw.correctCount : 0,
      wrongCount: typeof raw.wrongCount === "number" ? raw.wrongCount : 0,
      timeBonus: typeof raw.timeBonus === "number" ? raw.timeBonus : 0,
      recoveryBonus: typeof raw.recoveryBonus === "number" ? raw.recoveryBonus : 0,
      growthBonus: typeof raw.growthBonus === "number" ? raw.growthBonus : 0,
      completionBonus: typeof raw.completionBonus === "number" ? raw.completionBonus : 0,
      usedHints: typeof raw.usedHints === "number" ? raw.usedHints : 0,
      elapsedMs: typeof raw.elapsedMs === "number" ? raw.elapsedMs : 0,
      teamId: team?.teamId ?? null,
      studentNumber: session.student_number,
      studentName: session.student_name,
      status: session.status === "done" ? "done" : "in_progress",
    };
  });

  const summary = buildWordGameRoomSummary(
    students.map((student) => ({ student_number: student.student_number, student_name: student.student_name })),
    progressRows,
    resultRows,
    config.teams,
    config.teamMode
  );

  const questionById = new Map(config.questions.map((question) => [question.id, question] as const));
  const hardWordMap = new Map<string, { word: string; wrongCount: number; correctCount: number }>();
  for (const session of sessions ?? []) {
    const submission = isRecord(session.submission) ? session.submission : {};
    const answers = Array.isArray(submission.answers) ? submission.answers : [];
    for (const answer of answers) {
      if (!isRecord(answer) || typeof answer.questionId !== "string" || typeof answer.isCorrect !== "boolean") continue;
      const question = questionById.get(answer.questionId);
      if (!question) continue;
      const existing = hardWordMap.get(question.word) ?? { word: question.word, wrongCount: 0, correctCount: 0 };
      if (answer.isCorrect) existing.correctCount += 1;
      else existing.wrongCount += 1;
      hardWordMap.set(question.word, existing);
    }
  }

  return {
    ...summary,
    hardWords: [...hardWordMap.values()]
      .filter((entry) => entry.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount || a.correctCount - b.correctCount || a.word.localeCompare(b.word, "ko-KR"))
      .slice(0, 6),
  };
}

export type QuestionGeneratorRoomResultSummary = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  selections: Array<{
    id: string;
    method: "direct" | "card_remix";
    cardSetLabel: string;
    originalPrompt: string | null;
    remixedQuestion: string;
    originalRemixedQuestion?: string;
  }>;
};

export type QuestionGeneratorSourceRoomSummary = {
  roomId: string;
  title: string;
  topic: string;
  createdAt: string;
  questionCount: number;
  questions: Array<{
    id: string;
    text: string;
    sourceSessionId: string;
    sourceSelectionId: string;
  }>;
};

export async function getQuestionGeneratorRoomResults(roomId: string): Promise<QuestionGeneratorRoomResultSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "question_generator") {
    return [];
  }

  const { data } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, student_number, student_name, submission")
    .eq("room_id", roomId)
    .eq("status", "done")
    .order("student_number");

  const results: QuestionGeneratorRoomResultSummary[] = (data ?? []).flatMap((session) => {
      const submission = normalizeQuestionGeneratorSubmission(session.submission);
      if (!submission) return [];

      return [{
        sessionId: session.id,
        studentNumber: session.student_number,
        studentName: session.student_name,
        selections: submission.selections.map((selection) => ({
          id: selection.id,
          method: selection.method,
          cardSetLabel: selection.cardSetLabel,
          originalPrompt: selection.originalPrompt,
          remixedQuestion: selection.remixedQuestion,
          originalRemixedQuestion: selection.originalRemixedQuestion,
        })),
      }];
    });

  return results;
}

async function loadTeacherOpenAiKey(teacherId: string): Promise<{ apiKey?: string; usedSharedApi?: boolean; error?: string }> {
  const keyAccess = await getTeacherOpenAiAccess(teacherId);
  if (keyAccess.error || !keyAccess.access) {
    return { error: keyAccess.error ?? "OpenAI API 키를 불러올 수 없습니다." };
  }
  return { apiKey: keyAccess.access.apiKey, usedSharedApi: keyAccess.access.usedSharedApi };
}

type QuestionUpdate = { sessionId: string; selectionId: string; newText: string };

async function applyQuestionUpdatesForRoom(
  roomId: string,
  teacherId: string,
  updates: QuestionUpdate[],
): Promise<{ applied: number; error?: string }> {
  if (updates.length === 0) return { applied: 0 };

  const admin = createSupabaseAdminClient();

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || room.teacher_id !== teacherId || room.activity_type !== "question_generator") {
    return { applied: 0, error: "수정 권한이 없습니다." };
  }

  const updatesBySession = new Map<string, Map<string, string>>();
  for (const update of updates) {
    const trimmed = update.newText.trim();
    if (!trimmed) continue;
    if (!updatesBySession.has(update.sessionId)) {
      updatesBySession.set(update.sessionId, new Map());
    }
    updatesBySession.get(update.sessionId)!.set(update.selectionId, trimmed);
  }

  if (updatesBySession.size === 0) return { applied: 0 };

  const sessionIds = Array.from(updatesBySession.keys());
  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, submission, room_id")
    .in("id", sessionIds)
    .eq("room_id", roomId);

  let applied = 0;
  const updatedAt = new Date().toISOString();

  for (const session of sessions ?? []) {
    const sessionUpdates = updatesBySession.get(session.id);
    if (!sessionUpdates) continue;

    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) continue;

    let sessionChanged = false;
    const nextSelections = submission.selections.map((selection) => {
      const nextText = sessionUpdates.get(selection.id);
      if (nextText && nextText !== selection.remixedQuestion) {
        sessionChanged = true;
        applied += 1;
        return {
          ...selection,
          remixedQuestion: nextText,
          originalRemixedQuestion: selection.originalRemixedQuestion ?? selection.remixedQuestion,
        };
      }
      return selection;
    });

    if (!sessionChanged) continue;

    const { error } = await admin
      .schema("writing_helper")
      .from("student_sessions")
      .update({
        submission: { selections: nextSelections },
        updated_at: updatedAt,
      })
      .eq("id", session.id)
      .eq("room_id", roomId);
    if (error) return { applied, error: "질문 수정 저장에 실패했습니다." };
  }

  return { applied };
}

export async function updateQuestionGeneratorSelection(
  roomId: string,
  sessionId: string,
  selectionId: string,
  newText: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const result = await applyQuestionUpdatesForRoom(roomId, user.id, [
    { sessionId, selectionId, newText },
  ]);
  if (result.error) return { error: result.error };
  if (result.applied === 0) return { error: "수정할 질문을 찾지 못했습니다." };
  return {};
}

export type SpellingCorrectionCandidate = {
  sessionId: string;
  selectionId: string;
  original: string;
  corrected: string;
};

export async function correctQuestionGeneratorSpelling(
  roomId: string,
): Promise<{ candidates?: SpellingCorrectionCandidate[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const keyResult = await loadTeacherOpenAiKey(user.id);
  if (keyResult.error || !keyResult.apiKey) return { error: keyResult.error };

  const results = await getQuestionGeneratorRoomResults(roomId);
  if (results.length === 0) return { candidates: [] };

  const inputs: Array<{ id: string; text: string; sessionId: string; selectionId: string }> = [];
  for (const result of results) {
    for (const selection of result.selections) {
      const text = selection.remixedQuestion.trim();
      if (!text) continue;
      inputs.push({
        id: `${result.sessionId}::${selection.id}`,
        text,
        sessionId: result.sessionId,
        selectionId: selection.id,
      });
    }
  }
  if (inputs.length === 0) return { candidates: [] };

  try {
    await logApiUsage({
      teacherId: user.id,
      feature: "correct_question_generator_spelling",
      model: "gpt-4o",
      usedSharedApi: keyResult.usedSharedApi ?? true,
      roomId,
      metadata: { inputCount: inputs.length },
    });
    const corrected = await correctKoreanSpelling(
      keyResult.apiKey,
      inputs.map(({ id, text }) => ({ id, text })),
    );
    const correctedById = new Map(corrected.map((entry) => [entry.id, entry.corrected.trim()]));

    const candidates: SpellingCorrectionCandidate[] = [];
    for (const input of inputs) {
      const correctedText = correctedById.get(input.id);
      if (!correctedText) continue;
      if (correctedText === input.text) continue;
      candidates.push({
        sessionId: input.sessionId,
        selectionId: input.selectionId,
        original: input.text,
        corrected: correctedText,
      });
    }
    return { candidates };
  } catch (error) {
    const message = error instanceof Error ? error.message : "맞춤법 교정에 실패했습니다.";
    return { error: message };
  }
}

export async function applyQuestionGeneratorSpellingCorrections(
  roomId: string,
  updates: QuestionUpdate[],
): Promise<{ applied?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const result = await applyQuestionUpdatesForRoom(roomId, user.id, updates);
  if (result.error) return { error: result.error };
  return { applied: result.applied };
}

export async function getQuestionGeneratorSourceRooms(classId?: string): Promise<QuestionGeneratorSourceRoomSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  let query = admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, title, topic, created_at")
    .eq("teacher_id", user.id)
    .eq("activity_type", "question_generator")
    .order("created_at", { ascending: false });

  if (classId) {
    query = query.eq("class_id", classId);
  }

  const { data: rooms } = await query;
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((room) => room.id);
  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, room_id, submission")
    .in("room_id", roomIds)
    .eq("status", "done");

  const questionsByRoom = new Map<string, Array<{ id: string; text: string; sourceSessionId: string; sourceSelectionId: string }>>();

  for (const session of sessions ?? []) {
    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) continue;

    const current = questionsByRoom.get(session.room_id) ?? [];
    submission.selections.forEach((selection) => {
      current.push({
        id: `${session.id}::${selection.id}`,
        text: selection.remixedQuestion,
        sourceSessionId: session.id,
        sourceSelectionId: selection.id,
      });
    });
    questionsByRoom.set(session.room_id, current);
  }

  return rooms.flatMap((room) => {
    const questions = questionsByRoom.get(room.id) ?? [];
    if (questions.length === 0) return [];

    return [{
      roomId: room.id,
      title: room.title ?? room.topic ?? "질문 만들기 활동",
      topic: room.topic ?? room.title ?? "",
      createdAt: room.created_at,
      questionCount: questions.length,
      questions,
    }];
  });
}

export async function getQuestionVotingRoomResults(roomId: string): Promise<QuestionVotingRoomResult["ranking"]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type, activity_config")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "question_voting") {
    return [];
  }

  const config = normalizeQuestionVotingConfig(room.activity_config);
  if (!config?.sourceQuestions?.length) return [];

  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("submission")
    .eq("room_id", roomId)
    .eq("status", "done");

  const submissions = (sessions ?? [])
    .map((session) => normalizeQuestionVotingSubmission(session.submission))
    .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission));

  return buildQuestionVotingRanking(config, submissions);
}

export async function getOneLineShareRoomResults(roomId: string): Promise<OneLineShareRoomResult["entries"]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "one_line_share") {
    return [];
  }

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

  return buildOneLineShareBoard(entriesRes.data ?? [], reactionsRes.data ?? [], null);
}

export async function getOrGenerateHanjaCard(
  word: string,
  grade: number,
): Promise<{ card?: GeneratedHanjaCard & { grade: number }; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const trimmedWord = word.trim();
  if (!trimmedWord) return { error: "단어를 입력해 주세요." };
  const clampedGrade = Math.min(Math.max(Math.trunc(Number(grade) || 4), 3), 6);

  const admin = createSupabaseAdminClient();

  const { data: cached } = await admin
    .schema("writing_helper")
    .from("hanja_word_cards")
    .select("hanja_data, grade")
    .eq("word", trimmedWord)
    .eq("grade", clampedGrade)
    .maybeSingle();

  if (cached?.hanja_data) {
    const data = cached.hanja_data as GeneratedHanjaCard;
    if (isUsableHanjaWordCard(data)) {
      return { card: { ...data, word: trimmedWord, grade: cached.grade ?? clampedGrade } };
    }
    return { error: "이 단어는 한자어 카드로 만들기 어렵습니다. 추천 목록의 단어를 고르거나 다른 한자어를 입력해 주세요." };
  }

  const keyResult = await loadTeacherOpenAiKey(user.id);
  if (keyResult.error || !keyResult.apiKey) return { error: keyResult.error };

  try {
    await logApiUsage({
      teacherId: user.id,
      feature: "generate_hanja_card",
      model: "gpt-4o",
      usedSharedApi: keyResult.usedSharedApi ?? true,
      metadata: { word: trimmedWord, grade: clampedGrade },
    });
    const generated = await generateHanjaWordCard(keyResult.apiKey, trimmedWord, clampedGrade);
    if (generated.isHanjaWord !== true || !isUsableHanjaWordCard(generated)) {
      return {
        error: generated.rejectionReason
          ? `이 단어는 한자어 카드로 만들지 않았습니다. ${generated.rejectionReason}`
          : "이 단어는 한자어로 확인되지 않아 카드를 만들지 않았습니다. 추천 목록의 단어를 고르거나 다른 한자어를 입력해 주세요.",
      };
    }
    await admin
      .schema("writing_helper")
      .from("hanja_word_cards")
      .insert({
        word: trimmedWord,
        grade: clampedGrade,
        hanja_data: generated,
      });
    return { card: { ...generated, word: trimmedWord, grade: clampedGrade } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "한자 카드를 생성하지 못했습니다.";
    return { error: message };
  }
}

export async function getTeacherHanjaWordCards(): Promise<{ cards?: SavedHanjaWordCard[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .schema("writing_helper")
    .from("teacher_hanja_word_cards")
    .select("id, teacher_id, word, grade, card_data, source_room_id, created_at, updated_at")
    .eq("teacher_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTeacherHanjaWordCardsTable(error.message)) return { cards: [] };
    return { error: error.message };
  }

  return {
    cards: (data ?? [])
      .map(normalizeSavedHanjaWordCardRow)
      .filter((card): card is SavedHanjaWordCard => card !== null),
  };
}

export async function saveTeacherHanjaWordCard(
  input: HanjaWordCard,
  sourceRoomId?: string | null,
): Promise<{ card?: SavedHanjaWordCard; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const normalized = normalizeHanjaWordCard(input);
  if (!normalized) return { error: "저장할 한자 카드 정보가 올바르지 않습니다." };

  const admin = createSupabaseAdminClient();
  const payload = {
    teacher_id: user.id,
    word: normalized.word,
    grade: normalized.grade,
    card_data: {
      hanja: normalized.hanja,
      relatedWords: normalized.relatedWords,
      definition: normalized.definition,
      example: normalized.example,
      category: normalized.category,
    },
    source_room_id: sourceRoomId ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .schema("writing_helper")
    .from("teacher_hanja_word_cards")
    .upsert(payload, { onConflict: "teacher_id,word,grade" })
    .select("id, teacher_id, word, grade, card_data, source_room_id, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingTeacherHanjaWordCardsTable(error.message)) {
      return { error: "단어집 저장 기능을 쓰려면 최신 데이터베이스 마이그레이션을 적용해야 합니다." };
    }
    return { error: error.message };
  }

  const saved = normalizeSavedHanjaWordCardRow(data);
  if (!saved) return { error: "저장된 한자 카드를 읽지 못했습니다." };
  revalidatePath("/dashboard/hanja-wordbook");
  return { card: saved };
}

export async function deleteTeacherHanjaWordCard(cardId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };
  if (!cardId.trim()) return { error: "삭제할 카드를 찾지 못했습니다." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .schema("writing_helper")
    .from("teacher_hanja_word_cards")
    .delete()
    .eq("id", cardId)
    .eq("teacher_id", user.id);

  if (error) {
    if (isMissingTeacherHanjaWordCardsTable(error.message)) {
      return { error: "단어집 기능을 쓰려면 최신 데이터베이스 마이그레이션을 적용해야 합니다." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/hanja-wordbook");
  return {};
}

export type HanjaWritingRoomEntry = {
  sessionId: string;
  studentNumber: number;
  studentName: string;
  content: string;
  likeCount: number;
  createdAt: string;
};

export async function getHanjaWritingRoomResults(roomId: string): Promise<HanjaWritingRoomEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id || room.activity_type !== "hanja_writing") return [];

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

  return buildHanjaWritingBoard(sessionsRes.data ?? [], reactionsRes.data ?? [], null).map((entry) => ({
    sessionId: entry.sessionId,
    studentNumber: entry.studentNumber,
    studentName: entry.studentName,
    content: entry.content,
    likeCount: entry.likeCount,
    createdAt: entry.createdAt,
  }));
}

function normalizeSavedHanjaWordCardRow(row: {
  id: string;
  teacher_id: string;
  word: string;
  grade: number;
  card_data: unknown;
  source_room_id: string | null;
  created_at: string;
  updated_at: string;
}): SavedHanjaWordCard | null {
  const card = normalizeHanjaWordCard({
    word: row.word,
    grade: row.grade,
    ...(isRecord(row.card_data) ? row.card_data : {}),
  });
  if (!card) return null;

  return {
    id: row.id,
    teacherId: row.teacher_id,
    sourceRoomId: row.source_room_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...card,
  };
}

function normalizeHanjaWordCard(value: unknown): HanjaWordCard | null {
  if (!isRecord(value)) return null;

  const word = typeof value.word === "string" ? value.word.trim() : "";
  if (!word) return null;

  const grade = clampNumber(String(value.grade ?? ""), 3, 6, 4);
  return {
    word,
    grade,
    hanja: Array.isArray(value.hanja)
      ? value.hanja
          .filter(isRecord)
          .map((entry) => ({
            char: typeof entry.char === "string" ? entry.char.trim() : "",
            reading: typeof entry.reading === "string" ? entry.reading.trim() : "",
            meaning: typeof entry.meaning === "string" ? entry.meaning.trim() : "",
          }))
          .filter((entry) => entry.char && entry.reading && entry.meaning)
      : [],
    relatedWords: Array.isArray(value.relatedWords)
      ? value.relatedWords
          .filter(isRecord)
          .map((entry) => ({
            word: typeof entry.word === "string" ? entry.word.trim() : "",
            hanja: typeof entry.hanja === "string" ? entry.hanja.trim() : "",
            meaning: typeof entry.meaning === "string" ? entry.meaning.trim() : "",
            sharedChar: typeof entry.sharedChar === "string" ? entry.sharedChar.trim() : "",
          }))
          .filter((entry) => entry.word && entry.meaning)
      : [],
    definition: typeof value.definition === "string" ? value.definition.trim() : "",
    example: typeof value.example === "string" ? value.example.trim() : "",
    category: typeof value.category === "string" ? value.category.trim() : "",
  };
}

function isHanjaCharacter(value: string) {
  return /^[\u3400-\u4dbf\u4e00-\u9fff]+$/u.test(value);
}

function isUsableHanjaWordCard(card: GeneratedHanjaCard | HanjaWordCard | null | undefined): card is GeneratedHanjaCard & HanjaWordCard {
  if (!card) return false;
  if (!Array.isArray(card.hanja) || card.hanja.length === 0) return false;
  return card.hanja.every((entry) => (
    typeof entry.char === "string"
    && typeof entry.reading === "string"
    && typeof entry.meaning === "string"
    && entry.char.trim().length > 0
    && entry.reading.trim().length > 0
    && entry.meaning.trim().length > 0
    && isHanjaCharacter(entry.char.trim())
  ));
}

async function getQuestionGeneratorSourceRoomSummary(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teacherId: string,
  roomId: string,
): Promise<QuestionGeneratorSourceRoomSummary | null> {
  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, title, topic, created_at, teacher_id, activity_type")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.teacher_id !== teacherId || room.activity_type !== "question_generator") {
    return null;
  }

  const { data: sessions } = await admin
    .schema("writing_helper")
    .from("student_sessions")
    .select("id, room_id, submission")
    .eq("room_id", roomId)
    .eq("status", "done");

  const questions = (sessions ?? []).flatMap((session) => {
    const submission = normalizeQuestionGeneratorSubmission(session.submission);
    if (!submission) return [];

    return submission.selections.map((selection) => ({
      id: `${session.id}::${selection.id}`,
      text: selection.remixedQuestion,
      sourceSessionId: session.id,
      sourceSelectionId: selection.id,
    }));
  });

  return questions.length > 0
    ? {
        roomId: room.id,
        title: room.title ?? room.topic ?? "질문 만들기 활동",
        topic: room.topic ?? room.title ?? "",
        createdAt: room.created_at,
        questionCount: questions.length,
        questions,
      }
    : null;
}

async function getShortCodeForRoom(roomId: string, teacherId: string) {
  const admin = createSupabaseAdminClient();

  const { data: existing, error } = await admin
    .schema("writing_helper")
    .from("short_links")
    .select("code")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error && !isMissingShortLinksTableError(error.message)) {
    return null;
  }

  if (existing?.code) {
    return existing.code;
  }

  const { data: room } = await admin
    .schema("writing_helper")
    .from("rooms")
    .select("id, teacher_id, expires_at")
    .eq("id", roomId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (!room) return null;
  return ensureShortLinkForRoom(room.id, teacherId, room.expires_at ?? null);
}

async function ensureShortLinkForRoom(roomId: string, _teacherId: string, expiresAt: string | null) {
  const admin = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode();
    const { data, error } = await admin
      .schema("writing_helper")
      .from("short_links")
      .insert({
        room_id: roomId,
        code,
        target_path: `/room/${roomId}`,
        expires_at: expiresAt,
      })
      .select("code")
      .single();

    if (!error && data?.code) {
      return data.code;
    }

    if (error && isMissingShortLinksTableError(error.message)) {
      return null;
    }

    if (error?.message.includes("short_links_room_id_key")) {
      const { data: existing } = await admin
        .schema("writing_helper")
        .from("short_links")
        .select("code")
        .eq("room_id", roomId)
        .maybeSingle();

      return existing?.code ?? null;
    }

    if (!error?.message.includes("duplicate")) {
      return null;
    }
  }

  return null;
}

function generateShortCode() {
  return randomBytes(4)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toLowerCase();
}

function isMissingShortLinksTableError(message: string) {
  return message.includes("short_links");
}
