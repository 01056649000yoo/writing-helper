"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  setStudentLevel,
  saveAnswers,
  requestOutline,
  getStudentRoomQuestions,
  submitOneLineShare,
  submitQuestionGenerator,
  submitQuestionVoting,
} from "@/app/actions/student-actions";
import { getMatchingConfiguredKeywords, normalizeOneLineShareConfig } from "@/lib/one-line-share";
import type {
  OneLineShareConfig,
  QuestionCardRole,
  QuestionCardSet,
  QuestionGeneratorConfig,
  QuestionGeneratorSubmission,
  QuestionVotingConfig,
} from "@/features/activities/types";
import type { StudentLevel, QuestionSets, Question, Answer } from "@/types";

type ActivityType = "outline_builder" | "question_generator" | "question_voting" | "one_line_share";
type Step =
  | "level"
  | "questions"
  | "question_intro"
  | "question_path"
  | "question_set"
  | "question_prompt"
  | "question_rewrite"
  | "question_submitting"
  | "question_voting"
  | "one_line_share"
  | "one_line_submitting"
  | "submitting";

type QuestionSelection = QuestionGeneratorSubmission["selections"][number];
type QuestionBuildMode = "direct" | "card_remix";
type ResearchRoleId = string;

type ResearchRole = {
  id: ResearchRoleId;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accentClassName: string;
  surfaceClassName: string;
  cardSetIds: string[];
};

const RESEARCH_ROLES: ResearchRole[] = [
  {
    id: "detective",
    title: "탐정 모드",
    subtitle: "사실/추론",
    description: "보이는 사실을 살피고, 이유와 흐름을 차근차근 캐내요.",
    icon: "🕵️",
    accentClassName: "text-sky-700 bg-sky-100",
    surfaceClassName: "from-sky-50 to-cyan-100 ring-sky-200",
    cardSetIds: ["observation", "reason", "time"],
  },
  {
    id: "wizard",
    title: "마법사 모드",
    subtitle: "상상/비틀기",
    description: "생각을 넓히고 낯선 방향으로 비틀어 새로운 질문을 만들어요.",
    icon: "🪄",
    accentClassName: "text-fuchsia-700 bg-fuchsia-100",
    surfaceClassName: "from-fuchsia-50 to-violet-100 ring-fuchsia-200",
    cardSetIds: ["imagination", "twist", "metaphor"],
  },
  {
    id: "judge",
    title: "판사 모드",
    subtitle: "가치/해결",
    description: "무엇이 더 중요할지 따져 보고, 해결 방향을 찾도록 도와줘요.",
    icon: "⚖️",
    accentClassName: "text-amber-700 bg-amber-100",
    surfaceClassName: "from-amber-50 to-orange-100 ring-amber-200",
    cardSetIds: ["value", "solution", "connection"],
  },
  {
    id: "counselor",
    title: "상담사 모드",
    subtitle: "공감/시점",
    description: "마음과 관점을 살피며 더 깊고 따뜻한 질문으로 바꿔요.",
    icon: "💬",
    accentClassName: "text-emerald-700 bg-emerald-100",
    surfaceClassName: "from-emerald-50 to-teal-100 ring-emerald-200",
    cardSetIds: ["emotion", "perspective", "sense"],
  },
];

const QUESTION_WIZARD_STEPS = [
  { key: "question_path", label: "목적 선택" },
  { key: "question_set", label: "도구 선택" },
  { key: "question_rewrite", label: "질문 완성" },
] as const;

function normalizeCategoryLabel(value: string) {
  return value.replace(/\s+/g, "").replace(/카드$/u, "").trim().toLowerCase();
}

function buildRoleCardSetLabel(cardSet: QuestionCardSet) {
  const normalized = cardSet.label.trim();
  return normalized.endsWith("카드") ? normalized : `${normalized} 카드`;
}

function toUiRole(role: QuestionCardRole, enabledCardSets: QuestionCardSet[], fallbackIndex: number): ResearchRole | null {
  const roleCardSetIds = role.cardSetIds.filter((cardSetId) => enabledCardSets.some((cardSet) => cardSet.id === cardSetId));
  if (roleCardSetIds.length === 0) return null;

  const fallback = RESEARCH_ROLES[fallbackIndex % RESEARCH_ROLES.length];
  return {
    id: role.id,
    title: role.label,
    subtitle: role.subtitle,
    description: role.description,
    icon: role.icon || fallback.icon,
    accentClassName: fallback.accentClassName,
    surfaceClassName: fallback.surfaceClassName,
    cardSetIds: roleCardSetIds,
  };
}

function roleCardPreviewLabels(roleCardSets: QuestionCardSet[], role: ResearchRole, enabledCardSets: QuestionCardSet[]) {
  const source = roleCardSets.length > 0
    ? roleCardSets
    : enabledCardSets.filter((cardSet) => role.cardSetIds.includes(cardSet.id));
  return source.map((cardSet) => buildRoleCardSetLabel(cardSet));
}

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const editMode = searchParams.get("edit") === "1";

  const [roomId, setRoomId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [questionGeneratorConfig, setQuestionGeneratorConfig] = useState<QuestionGeneratorConfig | null>(null);
  const [questionVotingConfig, setQuestionVotingConfig] = useState<QuestionVotingConfig | null>(null);
  const [oneLineShareConfig, setOneLineShareConfig] = useState<OneLineShareConfig | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [levelPending, setLevelPending] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [error, setError] = useState("");
  const [selectedCardSetId, setSelectedCardSetId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [remixedQuestion, setRemixedQuestion] = useState("");
  const [questionSelections, setQuestionSelections] = useState<QuestionSelection[]>([]);
  const [editingSelectionId, setEditingSelectionId] = useState<string | null>(null);
  const [questionBuildMode, setQuestionBuildMode] = useState<QuestionBuildMode | null>(null);
  const [selectedResearchRoleId, setSelectedResearchRoleId] = useState<ResearchRoleId | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [promptSearch, setPromptSearch] = useState("");
  const [selectedVotingQuestionIds, setSelectedVotingQuestionIds] = useState<string[]>([]);
  const [votingReason, setVotingReason] = useState("");
  const [oneLineContent, setOneLineContent] = useState("");
  const [stepVisible, setStepVisible] = useState(false);

  const enabledCardSets = useMemo(() => {
    const allowedIds = new Set(questionGeneratorConfig?.enabledCardSetIds ?? []);
    const source = allowedIds.size > 0
      ? (questionGeneratorConfig?.cardSets ?? []).filter((cardSet) => allowedIds.has(cardSet.id))
      : (questionGeneratorConfig?.cardSets ?? []);
    return source;
  }, [questionGeneratorConfig]);

  const selectedCardSet = useMemo(
    () => enabledCardSets.find((cardSet) => cardSet.id === selectedCardSetId) ?? null,
    [enabledCardSets, selectedCardSetId]
  );
  const availableResearchRoles = useMemo(() => {
    const configRoles = questionGeneratorConfig?.roles ?? [];
    if (configRoles.length > 0) {
      return configRoles
        .map((role, index) => toUiRole(role, enabledCardSets, index))
        .filter((role): role is ResearchRole => role !== null);
    }

    return RESEARCH_ROLES.map((role) => ({
      ...role,
      cardSetIds: enabledCardSets
        .filter((cardSet) => role.cardSetIds.includes(cardSet.id) || role.cardSetIds.includes(normalizeCategoryLabel(cardSet.label)))
        .map((cardSet) => cardSet.id),
    })).filter((role) => role.cardSetIds.length > 0);
  }, [enabledCardSets, questionGeneratorConfig?.roles]);
  const selectedResearchRole = useMemo(
    () => availableResearchRoles.find((role) => role.id === selectedResearchRoleId) ?? null,
    [availableResearchRoles, selectedResearchRoleId]
  );
  const roleCardSets = useMemo(() => {
    if (!selectedResearchRole) return [];
    return selectedResearchRole.cardSetIds
      .map((cardSetId) => enabledCardSets.find((cardSet) => cardSet.id === cardSetId) ?? null)
      .filter((cardSet): cardSet is QuestionCardSet => cardSet !== null);
  }, [enabledCardSets, selectedResearchRole]);
  const activeRoleCardSet = useMemo(() => {
    if (!selectedResearchRole) return null;
    return roleCardSets.find((cardSet) => buildRoleCardSetLabel(cardSet) === selectedCategoryLabel) ?? roleCardSets[0] ?? null;
  }, [roleCardSets, selectedCategoryLabel, selectedResearchRole]);
  const filteredPrompts = useMemo(() => {
    const promptSource = activeRoleCardSet ?? selectedCardSet;
    if (!promptSource) return [];
    const query = promptSearch.trim().toLowerCase();
    if (!query) return promptSource.prompts;
    return promptSource.prompts.filter((prompt) => prompt.toLowerCase().includes(query));
  }, [activeRoleCardSet, promptSearch, selectedCardSet]);

  const maxSelections = questionGeneratorConfig?.maxSelections ?? 1;
  const votingMaxSelections = questionVotingConfig?.maxSelections ?? 1;
  const votingRequireReason = questionVotingConfig?.requireReason ?? true;

  useEffect(() => {
    if (!selectedResearchRole) return;
    const nextCategory =
      roleCardSets[0];

    setSelectedCategoryLabel((prev) => (
      prev && roleCardSets.some((cardSet) => buildRoleCardSetLabel(cardSet) === prev)
        ? prev
        : (nextCategory ? buildRoleCardSetLabel(nextCategory) : null)
    ));
  }, [roleCardSets, selectedResearchRole]);

  useEffect(() => {
    if (!step) return;
    if (!["question_intro", "question_path", "question_set", "question_rewrite", "question_submitting"].includes(step)) {
      return;
    }

    setStepVisible(false);
    const frame = requestAnimationFrame(() => setStepVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  useEffect(() => {
    if (!roomId) return;

    if (!sessionId) {
      startTransition(() => {
        setError("학생 세션 정보를 찾지 못했습니다. 입장 화면에서 다시 시도해주세요.");
        setPageLoading(false);
      });
      return;
    }

    let active = true;
    startTransition(() => setPageLoading(true));

    getStudentRoomQuestions(sessionId, roomId).then((data) => {
      if (!active) return;

      if (!data) {
        setError("학생 세션을 확인하지 못했습니다. 입장 화면에서 다시 시도해주세요.");
        setPageLoading(false);
        return;
      }

      setTopic(data.topic ?? "");
      setTopicDescription(typeof data.topic_description === "string" ? data.topic_description : "");

      const type = data.activity_type;
      if (type === "question_generator" || type === "question_voting" || type === "one_line_share") {
        setActivityType(type);
      } else {
        setActivityType("outline_builder");
      }

      if (type === "question_generator") {
        setQuestionGeneratorConfig(normalizeQuestionGeneratorConfig(data.activity_config));
        const existingSubmission = data.existing_submission as QuestionGeneratorSubmission | null;
        if (existingSubmission?.selections?.length) {
          setQuestionSelections(existingSubmission.selections);
          setStep(editMode ? "question_path" : "question_intro");
        } else {
          setQuestionSelections([]);
          setStep("question_intro");
        }
      } else if (type === "question_voting") {
        setQuestionVotingConfig(normalizeQuestionVotingConfig(data.activity_config));
        setStep("question_voting");
      } else if (type === "one_line_share") {
        setOneLineShareConfig(normalizeOneLineShareConfig(data.activity_config));
        setOneLineContent(data.existing_one_line_submission?.content ?? "");
        setStep("one_line_share");
      } else {
        setStep("level");
      }
      setPageLoading(false);
    });

    return () => {
      active = false;
    };
  }, [editMode, roomId, sessionId]);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-xl font-bold text-gray-800">활동을 준비하고 있어요</h1>
          <p className="text-sm text-gray-500 mt-3">학생 정보를 확인한 뒤 알맞은 활동 화면으로 이동합니다.</p>
        </div>
      </div>
    );
  }

  if (error && (!activityType || !step)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800">학생 참여를 이어갈 수 없어요</h1>
          <p className="text-sm text-red-500 mt-3 whitespace-pre-line">{error}</p>
          <button
            onClick={() => router.push(`/room/${roomId}`)}
            className="w-full mt-6 py-4 bg-slate-700 text-white rounded-2xl font-bold text-base hover:bg-slate-800 transition-colors"
          >
            입장 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  async function handleLevelSelect(selectedLevel: StudentLevel) {
    if (levelPending) return;
    setLevelPending(true);
    setError("");

    try {
      await setStudentLevel(sessionId, selectedLevel);

      const data = await getStudentRoomQuestions(sessionId, roomId);
      const qs = (data?.question_sets as QuestionSets)?.[selectedLevel]?.questions ?? [];

      if (qs.length === 0) {
        setError("질문을 불러오지 못했습니다. 다시 시도해주세요.");
        setLevelPending(false);
        return;
      }

      setQuestions(qs);
      setStep("questions");
      setLevelPending(false);
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
      setLevelPending(false);
    }
  }

  async function handleAnswer(answer: string) {
    const q = questions[currentQ];
    const newAnswer: Answer = { step: q.step, question: q.question, answer };
    const newAnswers = [...answers, newAnswer];
    setError("");

    const saveResult = await saveAnswers(sessionId, newAnswers);
    if (saveResult.error) {
      setError(saveResult.error);
      return;
    }

    if (currentQ + 1 < questions.length) {
      setAnswers(newAnswers);
      setCustomInput("");
      setSelectedChoices([]);
      setCurrentQ(currentQ + 1);
      return;
    }

    setStep("submitting");
    const result = await requestOutline(sessionId, newAnswers);
    if (result.error) {
      setError(result.error);
      setStep("questions");
      return;
    }
    setAnswers(newAnswers);
    setCustomInput("");
    setSelectedChoices([]);
    router.push(`/room/${roomId}/waiting?queue=${result.queueId}&session=${sessionId}`);
  }

  function toggleChoice(choice: string) {
    setSelectedChoices((prev) =>
      prev.includes(choice) ? prev.filter((currentChoice) => currentChoice !== choice) : [...prev, choice]
    );
  }

  function selectQuestionPrompt(prompt: string) {
    if (!activeRoleCardSet) return;
    setSelectedCardSetId(activeRoleCardSet.id);
    setSelectedPrompt(prompt);
    setRemixedQuestion(prompt);
  }

  function handleConfirmChoices() {
    const answer = selectedChoices.length > 0 ? selectedChoices.join(", ") : customInput.trim();
    if (!answer) return;
    handleAnswer(answer);
  }

  async function handleQuestionSelectionSubmit() {
    const normalizedQuestion = remixedQuestion.trim();
    if (!normalizedQuestion) {
      setError("오늘 주제에 맞게 바꾼 질문을 적어주세요.");
      return;
    }

    const selection: QuestionSelection = {
      id: editingSelectionId ?? `selection-${questionSelections.length + 1}`,
      method: questionBuildMode ?? "card_remix",
      cardSetId: questionBuildMode === "direct" ? "custom" : selectedCardSet?.id ?? "custom",
      cardSetLabel:
        questionBuildMode === "direct"
          ? "직접 질문 만들기"
          : selectedCardSet?.label ?? "질문 카드",
      originalPrompt: questionBuildMode === "direct" ? null : selectedPrompt,
      remixedQuestion: normalizedQuestion,
    };

    const nextSelections = editingSelectionId
      ? questionSelections.map((currentSelection) => (
          currentSelection.id === editingSelectionId ? selection : currentSelection
        ))
      : [...questionSelections, selection];
    setQuestionSelections(nextSelections);
    setError("");

    if (editingSelectionId) {
      setEditingSelectionId(null);
    }

    if (nextSelections.length < maxSelections) {
      resetQuestionBuilder();
      setStep("question_path");
      return;
    }

    setStep("question_submitting");
    const result = await submitQuestionGenerator(sessionId, roomId, { selections: nextSelections });
    if (result.error) {
      setError(result.error);
      setStep("question_rewrite");
      return;
    }

    router.push(`/room/${roomId}/result?session=${sessionId}`);
  }

  function resetQuestionBuilder() {
    setEditingSelectionId(null);
    setQuestionBuildMode(null);
    setSelectedResearchRoleId(null);
    setSelectedCategoryLabel(null);
    setSelectedCardSetId(null);
    setSelectedPrompt(null);
    setRemixedQuestion("");
    setPromptSearch("");
  }

  function removeQuestionSelection(selectionId: string) {
    if (editingSelectionId === selectionId) {
      resetQuestionBuilder();
      setStep("question_path");
    }
    setQuestionSelections((prev) => prev.filter((selection) => selection.id !== selectionId));
  }

  function editQuestionSelection(selection: QuestionSelection) {
    const selectedCard = enabledCardSets.find((cardSet) => cardSet.id === selection.cardSetId) ?? null;
    const selectedRole = selectedCard
      ? availableResearchRoles.find((role) => role.cardSetIds.includes(selectedCard.id)) ?? null
      : null;

    setEditingSelectionId(selection.id);
    setQuestionBuildMode(selection.method);
    setSelectedCardSetId(selection.cardSetId === "custom" ? null : selection.cardSetId);
    setSelectedPrompt(selection.originalPrompt);
    setRemixedQuestion(selection.remixedQuestion);
    setSelectedResearchRoleId(selectedRole?.id ?? null);
    setSelectedCategoryLabel(selectedCard ? buildRoleCardSetLabel(selectedCard) : null);
    setPromptSearch("");
    setError("");
    setStep("question_rewrite");
  }

  if (activityType === "question_generator") {
    if (step === "question_intro") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center transition-all duration-300 ease-out ${stepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <div className="text-6xl mb-4">🃏</div>
            <h1 className="text-2xl font-bold text-gray-800">질문 만들기</h1>
            <div className="mt-4 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 px-5 py-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
              <p className="mt-2 text-xl font-bold leading-snug text-sky-950">{topic}</p>
              <div className="mt-4 rounded-2xl bg-white/80 px-4 py-4">
                <p className="text-xs font-semibold text-sky-700">활동 가이드</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-sky-950">
                  {topicDescription || questionGeneratorConfig?.guidance || "연구원 역할을 고르고, 어울리는 카드 힌트로 나만의 질문을 완성해 보세요."}
                </p>
              </div>
              {topicDescription && questionGeneratorConfig?.guidance && (
                <p className="mt-3 text-sm leading-relaxed text-sky-800">{questionGeneratorConfig.guidance}</p>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="font-semibold text-gray-700">연구원 역할</p>
                <p className="text-2xl font-bold text-sky-600 mt-1">{availableResearchRoles.length}개</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="font-semibold text-gray-700">완성할 질문</p>
                <p className="text-2xl font-bold text-sky-600 mt-1">{maxSelections}개</p>
              </div>
            </div>
            <button
              onClick={() => {
                setQuestionBuildMode("card_remix");
                setStep("question_path");
              }}
              className="w-full mt-6 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 transition-colors"
            >
              가이드 읽었어요. 질문 고르기
            </button>
          </div>
        </div>
      );
    }

    if (step === "question_path") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="max-w-3xl mx-auto py-8">
            <div className={`space-y-4 transition-all duration-300 ease-out ${stepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <QuestionWizardHeader currentStep={1} completedCount={questionSelections.length} maxSelections={maxSelections} />

            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-600 font-semibold">Step 1. 목적 선택</p>
                  <h1 className="text-2xl font-bold text-gray-800 mt-1">오늘의 미션에 어울리는 역할을 골라보세요.</h1>
                  <p className="text-sm text-gray-500 mt-2">어떤 방식으로 질문을 탐구할지 먼저 정하면, 어울리는 카드만 골라서 볼 수 있어요.</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {questionSelections.length} / {maxSelections}개 완료
                </div>
              </div>
              <div className="mt-5 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">오늘의 미션</p>
                <p className="mt-2 text-2xl font-bold leading-snug text-sky-950">{topic}</p>
                {topicDescription && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-sky-900">{topicDescription}</p>
                )}
                {questionGeneratorConfig?.guidance && (
                  <p className="mt-3 text-sm leading-relaxed text-sky-800">{questionGeneratorConfig.guidance}</p>
                )}
              </div>
            </div>

            {questionSelections.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">지금까지 만든 질문</p>
                  <p className="text-xs font-semibold text-sky-600">질문을 누르면 수정할 수 있어요</p>
                </div>
                <div className="space-y-2">
                  {questionSelections.map((selection) => (
                    <div key={selection.id} className="rounded-2xl bg-sky-50 p-2">
                      <button
                        type="button"
                        onClick={() => editQuestionSelection(selection)}
                        className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-sky-700">{selection.cardSetLabel}</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-700">수정</span>
                          </div>
                          <p className="text-sm text-gray-800 mt-1">{selection.remixedQuestion}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestionSelection(selection.id)}
                        className="mt-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {availableResearchRoles.map((role) => {
                const selected = selectedResearchRoleId === role.id;
                return (
                  <button
                    key={role.id}
                    disabled={questionSelections.length >= maxSelections}
                    onClick={() => {
                      setQuestionBuildMode("card_remix");
                      setSelectedResearchRoleId(role.id);
                      setSelectedCardSetId(null);
                      setSelectedPrompt(null);
                      setRemixedQuestion("");
                    }}
                    className={`rounded-3xl p-6 shadow-xl text-left transition-all duration-300 ${
                      selected
                        ? `bg-gradient-to-br ${role.surfaceClassName} ring-2 shadow-2xl`
                        : "bg-white hover:-translate-y-0.5 hover:shadow-2xl"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-4xl">{role.icon}</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selected ? role.accentClassName : "bg-gray-100 text-gray-500"}`}>
                        {selected ? "선택됨" : role.subtitle}
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-gray-800">{role.title}</h2>
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{role.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {roleCardPreviewLabels([], role, enabledCardSets).map((label) => (
                        <span key={label} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-600 ring-1 ring-black/5">
                          {label}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {questionSelections.length >= maxSelections && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                질문을 모두 채웠어요. 수정하려면 위의 질문을 눌러 바로 고칠 수 있어요.
              </div>
            )}

            <button
              onClick={() => {
                if (questionSelections.length >= maxSelections) return;
                if (selectedResearchRoleId) {
                  setStep("question_set");
                }
              }}
              disabled={!selectedResearchRoleId}
              className="w-full mt-6 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors"
            >
              다음으로 →
            </button>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_set") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="max-w-3xl mx-auto py-8">
            <div className={`space-y-4 transition-all duration-300 ease-out ${stepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <QuestionWizardHeader currentStep={2} completedCount={questionSelections.length} maxSelections={maxSelections} />

            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-600 font-semibold">Step 2. 도구 선택</p>
                  <h1 className="text-2xl font-bold text-gray-800 mt-1">{selectedResearchRole?.title ?? "연구원 역할"}에 어울리는 질문 힌트를 골라보세요.</h1>
                  <p className="text-sm text-gray-500 mt-2">
                    선택한 역할에 맞는 3가지 카드만 보여드릴게요. 마음에 드는 질문 하나를 골라 다음 단계에서 다듬으면 됩니다.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {questionSelections.length} / {maxSelections}개 완료
                </div>
              </div>
              <div className="mt-5 rounded-3xl bg-gray-50 px-5 py-4">
                <p className="text-xs font-semibold text-gray-500">선택한 역할</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-2xl">{selectedResearchRole?.icon ?? "🃏"}</span>
                  <div>
                    <p className="font-bold text-gray-800">{selectedResearchRole?.title ?? "질문 카드 탐색"}</p>
                    <p className="text-sm text-gray-500">{selectedResearchRole?.subtitle ?? "카드 선택"}</p>
                  </div>
                </div>
              </div>
            </div>

            {questionSelections.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700">지금까지 만든 질문</p>
                  <p className="text-xs font-semibold text-sky-600">질문을 누르면 수정할 수 있어요</p>
                </div>
                <div className="space-y-2">
                  {questionSelections.map((selection) => (
                    <button
                      key={selection.id}
                      type="button"
                      onClick={() => editQuestionSelection(selection)}
                      className="w-full rounded-2xl bg-sky-50 px-4 py-3 text-left transition-colors hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-sky-700">{selection.cardSetLabel}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-sky-700">수정</span>
                      </div>
                      <p className="text-sm text-gray-800 mt-1">{selection.remixedQuestion}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-4 shadow-lg">
              <div className="flex flex-wrap gap-2">
                {roleCardSets.map((cardSet) => {
                  const label = buildRoleCardSetLabel(cardSet);
                  const selected = selectedCategoryLabel === label;
                  return (
                    <button
                      key={cardSet.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryLabel(label);
                        setSelectedCardSetId(null);
                        setSelectedPrompt(null);
                        setRemixedQuestion("");
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        selected
                          ? "bg-sky-500 text-white"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-lg">
              <label className="block text-xs font-semibold text-sky-700 mb-2">질문 찾기</label>
              <input
                value={promptSearch}
                onChange={(event) => setPromptSearch(event.target.value)}
                placeholder="바꾸고 싶은 질문의 단어나 표현을 찾아보세요."
                className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400"
              />
            </div>

            {activeRoleCardSet ? (
              <div className="rounded-3xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-sky-600">{activeRoleCardSet.label}</p>
                    <h2 className="mt-1 text-xl font-bold text-gray-800">예시 질문을 보고 하나 골라보세요.</h2>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">{activeRoleCardSet.description}</p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                    {activeRoleCardSet.prompts.length}장
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  {filteredPrompts.map((prompt, index) => {
                    const selected = selectedPrompt === prompt;
                    return (
                      <button
                        key={`${activeRoleCardSet.id}-${index}-${prompt}`}
                        type="button"
                        aria-pressed={selected}
                        onPointerUp={(event) => {
                          if (event.pointerType === "mouse" && event.button !== 0) return;
                          selectQuestionPrompt(prompt);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectQuestionPrompt(prompt);
                          }
                        }}
                        className={`relative overflow-hidden rounded-3xl border-2 p-5 text-left touch-manipulation transition-all ${
                          selected
                            ? "border-sky-500 bg-sky-50 shadow-md shadow-sky-100"
                            : "border-gray-200 bg-gray-50 active:border-sky-300 active:bg-sky-50 hover:border-sky-200 hover:bg-sky-50"
                        }`}
                      >
                        {selected && <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-500" />}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-sky-600 mb-2">질문 카드 {index + 1}</p>
                            <p className="text-gray-800 font-medium leading-relaxed">{prompt}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                            selected ? "bg-sky-600 text-white" : "bg-white text-gray-500"
                          }`}>
                            {selected ? "✓ 선택됨" : "선택"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredPrompts.length === 0 && (
                    <div className="rounded-3xl bg-gray-50 p-8 text-center">
                      <p className="text-sm font-semibold text-gray-700">찾는 질문이 아직 안 보여요.</p>
                      <p className="mt-2 text-sm text-gray-500">검색어를 조금 다르게 바꾸거나 지우고 다시 찾아보세요.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
                <p className="text-sm font-semibold text-gray-700">이 역할에 맞는 카드가 아직 준비되지 않았어요.</p>
                <p className="mt-2 text-sm text-gray-500">다른 연구원 역할을 고르거나, 선생님이 선택한 카드 묶음을 확인해 보세요.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("question_path")}
                className="flex-1 rounded-2xl border border-sky-200 bg-white py-4 text-center font-bold text-sky-700 transition-colors hover:bg-sky-50"
              >
                이전
              </button>
              <button
                onClick={() => {
                  if (!selectedPrompt) return;
                  setError("");
                  setStep("question_rewrite");
                }}
                disabled={!selectedPrompt}
                className="flex-1 rounded-2xl bg-sky-500 py-4 text-center font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500"
              >
                다음
              </button>
            </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_rewrite") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl space-y-4 transition-all duration-300 ease-out ${stepVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <QuestionWizardHeader currentStep={3} completedCount={questionSelections.length} maxSelections={maxSelections} />

            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 px-5 py-5">
                <p className="text-sm font-semibold text-sky-600">Step 3. 질문 완성</p>
                <h1 className="mt-2 text-2xl font-bold text-gray-800">
                  {editingSelectionId ? "내가 만든 질문을 다시 다듬어 보세요." : "선택한 힌트를 바탕으로 미션에 맞는 나만의 질문을 완성해 보세요!"}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-sky-800">
                  {editingSelectionId
                    ? "수정한 뒤 저장하면 선생님에게 보이는 질문도 새 내용으로 바뀝니다."
                    : "힌트는 출발점이에요. 내 생각이 드러나도록 문장을 자유롭게 바꿔도 좋아요."}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-sky-50 px-4 py-3">
                  <p className="text-xs font-semibold text-sky-700">
                    {questionBuildMode === "direct" ? "직접 질문 만들기" : selectedCardSet?.label ?? selectedCategoryLabel ?? "질문 카드"}
                  </p>
                  <p className="text-sm text-sky-900 mt-1">오늘 주제: <strong>{topic}</strong></p>
                </div>

                {selectedPrompt && (
                  <div className="rounded-2xl bg-gray-50 px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">선택한 힌트 질문</p>
                    <p className="text-gray-800 leading-relaxed">{selectedPrompt}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    내가 완성한 질문
                  </label>
                  <p className="mb-3 text-sm text-gray-500">선택한 힌트를 바탕으로 미션에 맞는 나만의 질문을 완성해 보세요!</p>
                  <textarea
                    value={remixedQuestion}
                    onChange={(event) => setRemixedQuestion(event.target.value)}
                    rows={5}
                    placeholder="오늘의 미션에 맞는 질문으로 바꿔 써보세요."
                    className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400 resize-none"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(editingSelectionId ? "question_path" : "question_set")}
                    className="flex-1 rounded-2xl border border-sky-200 bg-white py-4 text-center font-bold text-sky-700 transition-colors hover:bg-sky-50"
                  >
                    {editingSelectionId ? "목록으로" : "이전"}
                  </button>
                  <button
                    onClick={handleQuestionSelectionSubmit}
                    className="flex-1 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 transition-colors"
                  >
                    {editingSelectionId
                      ? "수정 저장하기"
                      : questionSelections.length + 1 < maxSelections
                        ? "이 질문 저장하고 다음 질문 만들기"
                        : "제출하기"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
            <div className="text-6xl mb-6 animate-bounce">📝</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">질문을 정리하고 있어요</h1>
            <p className="text-gray-500 text-sm">선생님이 바로 볼 수 있게 제출 중이에요.</p>
          </div>
        </div>
      );
    }
  }

  if (activityType === "question_voting") {
    const votingQuestions = questionVotingConfig?.sourceQuestions ?? [];
    const selectedCount = selectedVotingQuestionIds.length;

    async function handleQuestionVotingSubmit() {
      setError("");

      if (selectedVotingQuestionIds.length === 0) {
        setError("좋은 질문을 1개 이상 골라주세요.");
        return;
      }

      if (votingRequireReason && !votingReason.trim()) {
        setError("왜 좋은 질문인지 한 줄 적어주세요.");
        return;
      }

      setStep("question_submitting");
      const result = await submitQuestionVoting(sessionId, roomId, {
        selectedQuestionIds: selectedVotingQuestionIds,
        reason: votingReason.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
        setStep("question_voting");
        return;
      }

      router.push(`/room/${roomId}/result?session=${sessionId}`);
    }

    function toggleVotingQuestion(questionId: string) {
      setSelectedVotingQuestionIds((prev) => {
        if (prev.includes(questionId)) {
          return prev.filter((currentId) => currentId !== questionId);
        }

        if (prev.length >= votingMaxSelections) {
          return prev;
        }

        return [...prev, questionId];
      });
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
        <div className="max-w-3xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-3">🗳️</div>
            <h1 className="text-2xl font-bold text-gray-800">좋은 질문 고르기</h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              친구들이 만든 질문을 익명으로 읽고, 오늘 기준에 맞는 좋은 질문을 골라봐요.
            </p>
            <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">
              오늘 주제: <strong>{topic}</strong>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">좋은 질문의 기준</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">이 기준을 생각하며 질문을 읽어봐요</h2>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                {selectedCount} / {votingMaxSelections} 선택
              </span>
            </div>

            {(questionVotingConfig?.evaluationCriteria?.length ?? 0) > 0 ? (
              <div className="grid gap-2">
                {questionVotingConfig?.evaluationCriteria.map((criterion, index) => (
                  <div key={`${criterion}-${index}`} className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    {index + 1}. {criterion}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-violet-50 px-4 py-4 text-sm text-violet-700">
                여러 가지 생각이 이어지는 질문인지, 친구가 더 말해보고 싶어지는 질문인지 떠올리며 골라봐요.
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-500">익명 질문 목록</p>
                <h2 className="mt-1 text-lg font-bold text-gray-800">친구들이 만든 질문</h2>
              </div>
              <p className="text-xs text-gray-400">작성자는 보이지 않아요</p>
            </div>

            {votingQuestions.length === 0 ? (
              <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
                평가할 질문을 불러오지 못했어요. 선생님께 다시 열어달라고 알려주세요.
              </div>
            ) : (
              <div className="grid gap-3">
                {votingQuestions.map((question, index) => {
                  const selected = selectedVotingQuestionIds.includes(question.id);
                  const blocked = !selected && selectedCount >= votingMaxSelections;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => toggleVotingQuestion(question.id)}
                      disabled={blocked}
                      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                        selected
                          ? "border-violet-400 bg-violet-50"
                          : blocked
                            ? "border-gray-100 bg-gray-50 text-gray-400"
                            : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 rounded-full px-2 py-1 text-xs font-bold ${
                          selected ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          질문 {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-base font-medium leading-relaxed text-gray-900">
                            {question.text}
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            {selected ? "선택했어요" : blocked ? `좋은 질문은 ${votingMaxSelections}개까지 고를 수 있어요` : "좋다고 생각하면 눌러서 선택해요"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {votingRequireReason && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  왜 이 질문이 좋다고 생각했나요?
                </label>
                <textarea
                  value={votingReason}
                  onChange={(event) => setVotingReason(event.target.value)}
                  rows={3}
                  placeholder="좋은 질문이라고 생각한 이유를 짧게 적어봐요."
                  className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-400 resize-none"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="button"
              onClick={handleQuestionVotingSubmit}
              disabled={votingQuestions.length === 0}
              className="w-full py-4 bg-violet-500 text-white rounded-2xl font-bold text-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              좋은 질문 제출하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activityType === "one_line_share") {
    const keywords = oneLineShareConfig?.keywords ?? [];
    const normalizedContent = oneLineContent.trim();
    const matchingKeywords = getMatchingConfiguredKeywords(normalizedContent, keywords);
    const containsKeyword = keywords.length === 0 || matchingKeywords.length > 0;
    const missingKeywords = keywords.filter((keyword) => !matchingKeywords.includes(keyword));

    function insertKeyword(keyword: string) {
      setOneLineContent((prev) => {
        if (prev.includes(keyword)) return prev;
        const trimmed = prev.trim();
        if (!trimmed) return keyword;
        return `${trimmed} ${keyword}`;
      });
    }

    async function handleOneLineShareSubmit() {
      if (!normalizedContent) {
        setError("한 줄 문장을 적어주세요.");
        return;
      }

      if (!containsKeyword) {
        setError("핵심단어를 한 개 이상 넣어 문장을 다시 써주세요.");
        return;
      }

      setError("");
      setStep("one_line_submitting");
      const result = await submitOneLineShare(sessionId, roomId, normalizedContent);

      if (result.error) {
        setError(result.error);
        setStep("one_line_share");
        return;
      }

      router.push(`/room/${roomId}/result?session=${sessionId}`);
    }

    if (step === "one_line_submitting") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
            <div className="text-6xl mb-6 animate-bounce">💬</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">한 줄을 정리하고 있어요</h1>
            <p className="text-gray-500 text-sm">친구들이 볼 수 있는 보드에 올리는 중이에요.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4">
        <div className="max-w-2xl mx-auto pt-8 pb-16 space-y-4">
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <div className="text-5xl mb-3">💬</div>
            <h1 className="text-2xl font-bold text-gray-800">한줄모아</h1>
            <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              오늘 활동: <strong>{topic}</strong>
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mt-4">
              {oneLineShareConfig?.promptDescription ?? "핵심단어를 넣어 오늘 알게 된 점이나 내 생각을 한 문장으로 써보세요."}
            </p>
          </div>

          {keywords.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-500">오늘의 핵심단어</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => insertKeyword(keyword)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                      matchingKeywords.includes(keyword)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    }`}
                  >
                    #{keyword}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">핵심단어를 눌러 문장에 바로 넣을 수 있어요. 제시된 핵심단어 중 하나 이상이 꼭 들어가야 합니다.</p>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">내 한 줄</label>
              <textarea
                value={oneLineContent}
                onChange={(event) => setOneLineContent(event.target.value)}
                rows={4}
                placeholder="예) 증발은 물이 눈에 보이지 않게 공기 중으로 올라가는 변화라는 것을 새롭게 알게 되었다."
                className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className={`rounded-2xl px-4 py-3 text-sm ${
              containsKeyword ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}>
              {keywords.length === 0
                ? "핵심단어가 없어 자유롭게 한 줄을 써도 괜찮아요."
                : containsKeyword
                  ? `좋아요! 핵심단어 ${matchingKeywords.map((keyword) => `#${keyword}`).join(", ")} 이(가) 들어 있어요.`
                  : `아직 핵심단어가 없어요. ${missingKeywords.map((keyword) => `#${keyword}`).join(", ")} 중 하나를 넣어주세요.`}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="button"
              onClick={handleOneLineShareSubmit}
              disabled={!normalizedContent || !containsKeyword}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-lg hover:bg-rose-600 transition-colors"
            >
              {!normalizedContent
                ? "한 줄을 먼저 적어주세요"
                : !containsKeyword
                  ? "핵심단어를 먼저 넣어주세요"
                  : "한 줄 제출하고 친구 문장 보러 가기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "level") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🤔</div>
            <h1 className="text-xl font-bold text-gray-800">나는 글쓰기가...</h1>
            <p className="text-gray-500 text-sm mt-1">주제: <strong>{topic}</strong></p>
          </div>
          <div className="space-y-3">
            {[
              { level: "low" as StudentLevel, emoji: "😰", label: "어디서 시작할지 모르겠어요", desc: "처음부터 차근차근 도와드릴게요" },
              { level: "mid" as StudentLevel, emoji: "🙂", label: "조금은 쓸 수 있어요", desc: "내용을 더 풍부하게 만들어봐요" },
              { level: "high" as StudentLevel, emoji: "😊", label: "잘 쓸 수 있어요!", desc: "더 깊고 멋진 글을 써봐요" },
            ].map((option) => (
              <button
                key={option.level}
                onClick={() => handleLevelSelect(option.level)}
                disabled={levelPending}
                className="w-full p-4 border-2 border-gray-200 rounded-2xl text-left hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{option.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.desc}</p>
                  </div>
                  {levelPending && <span className="text-gray-300 text-sm animate-spin">⏳</span>}
                </div>
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
          {levelPending && (
            <p className="text-orange-500 text-sm text-center mt-3 animate-pulse">준비 중이에요...</p>
          )}
        </div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4 animate-bounce">✨</div>
          <h1 className="text-xl font-bold text-gray-800">개요를 만들고 있어요!</h1>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      </div>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{currentQ + 1} / {questions.length}</span>
            <span>{Math.round(((currentQ + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-sm text-gray-400 mb-2">주제: {topic}</p>
          <h2 className="text-xl font-bold text-gray-800 leading-snug">{q.question}</h2>
          {q.hint && <p className="text-sm text-gray-400 mt-2">💡 {q.hint}</p>}
        </div>

        {(q.type === "card" || q.type === "card+input") && q.choices && (
          <div className="space-y-3 mb-2">
            <p className="text-xs text-center text-orange-500 font-medium">
              💡 해당하는 것을 모두 골라봐요 (여러 개도 돼요)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {q.choices.map((choice, index) => {
                const selected = selectedChoices.includes(choice);
                return (
                  <button
                    key={index}
                    onClick={() => toggleChoice(choice)}
                    className={`p-3 border-2 rounded-2xl text-sm font-medium text-left transition-all ${
                      selected
                        ? "border-orange-400 bg-orange-50 text-orange-700 scale-[1.02]"
                        : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 text-gray-700"
                    }`}
                  >
                    <span className="mr-1">{selected ? "✅" : "⬜"}</span>
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(q.type === "input" || q.type === "card+input") && (
          <div className="space-y-2 mt-3">
            {q.type === "card+input" && (
              <p className="text-xs text-center text-gray-400">✏️ 직접 추가하고 싶은 내용이 있으면 써봐요</p>
            )}
            <textarea
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              rows={2}
              placeholder="직접 써봐요..."
              className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>
        )}

        {(q.type === "card" || q.type === "card+input") && (
          <button
            onClick={handleConfirmChoices}
            disabled={selectedChoices.length === 0 && !customInput.trim()}
            className="w-full mt-4 py-3 bg-orange-400 text-white rounded-2xl font-bold hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            {selectedChoices.length > 0 ? `${selectedChoices.length}개 선택 완료 →` : "다음으로 →"}
          </button>
        )}

        {q.type === "input" && (
          <button
            onClick={() => customInput.trim() && handleAnswer(customInput.trim())}
            disabled={!customInput.trim()}
            className="w-full mt-4 py-3 bg-orange-400 text-white rounded-2xl font-bold hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            다음으로 →
          </button>
        )}

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}

function QuestionWizardHeader({
  currentStep,
  completedCount,
  maxSelections,
}: {
  currentStep: 1 | 2 | 3;
  completedCount: number;
  maxSelections: number;
}) {
  const progressPercent = (currentStep / QUESTION_WIZARD_STEPS.length) * 100;

  return (
    <div className="bg-white rounded-3xl shadow-lg p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-500">질문 만들기 위저드</p>
          <p className="mt-1 text-sm text-gray-500">지금은 {QUESTION_WIZARD_STEPS[currentStep - 1]?.label} 단계예요.</p>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
          {completedCount} / {maxSelections}개 완료
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-sky-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {QUESTION_WIZARD_STEPS.map((wizardStep, index) => {
          const stepNumber = index + 1;
          const active = currentStep === stepNumber;
          const complete = currentStep > stepNumber;

          return (
            <div
              key={wizardStep.key}
              className={`rounded-2xl px-3 py-3 text-center transition-colors ${
                active
                  ? "bg-sky-500 text-white"
                  : complete
                    ? "bg-sky-100 text-sky-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              <p className="text-xs font-semibold">Step {stepNumber}</p>
              <p className="mt-1 text-sm font-bold">{wizardStep.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeQuestionGeneratorConfig(value: unknown): QuestionGeneratorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      enabledCardSetIds: [],
      cardSets: [],
      maxSelections: 1,
      guidance: "마음에 드는 질문 카드를 고르고, 오늘 주제에 어울리게 질문을 바꿔봐요.",
    };
  }

  const raw = value as Record<string, unknown>;
  const cardSets = Array.isArray(raw.cardSets)
    ? raw.cardSets
        .filter((cardSet): cardSet is Record<string, unknown> => typeof cardSet === "object" && cardSet !== null && !Array.isArray(cardSet))
        .map((cardSet, index): QuestionCardSet => ({
          id: typeof cardSet.id === "string" && cardSet.id.trim() ? cardSet.id.trim() : `card-set-${index + 1}`,
          label: typeof cardSet.label === "string" ? cardSet.label.trim() : "",
          description: typeof cardSet.description === "string" ? cardSet.description.trim() : "",
          prompts: Array.isArray(cardSet.prompts)
            ? cardSet.prompts.filter((prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0)
            : [],
          roleId: typeof cardSet.roleId === "string" && cardSet.roleId.trim() ? cardSet.roleId.trim() : null,
        }))
        .filter((cardSet) => cardSet.label && cardSet.prompts.length > 0)
    : [];
  const allIds = new Set(cardSets.map((cardSet) => cardSet.id));
  const enabledCardSetIds = Array.isArray(raw.enabledCardSetIds)
    ? raw.enabledCardSetIds.filter((cardSetId): cardSetId is string => typeof cardSetId === "string" && allIds.has(cardSetId))
    : cardSets.map((cardSet) => cardSet.id);
  const roles = Array.isArray(raw.roles)
    ? raw.roles
        .filter((role): role is Record<string, unknown> => typeof role === "object" && role !== null && !Array.isArray(role))
        .map((role, index): QuestionCardRole => ({
          id: typeof role.id === "string" && role.id.trim() ? role.id.trim() : `role-${index + 1}`,
          label: typeof role.label === "string" ? role.label.trim() : "",
          subtitle: typeof role.subtitle === "string" ? role.subtitle.trim() : "",
          description: typeof role.description === "string" ? role.description.trim() : "",
          icon: typeof role.icon === "string" && role.icon.trim() ? role.icon.trim() : "🃏",
          cardSetIds: Array.isArray(role.cardSetIds)
            ? role.cardSetIds.filter((cardSetId): cardSetId is string => typeof cardSetId === "string" && allIds.has(cardSetId))
            : [],
        }))
        .filter((role) => role.label && role.cardSetIds.length > 0)
    : [];

  return {
    enabledCardSetIds: enabledCardSetIds.length > 0 ? enabledCardSetIds : cardSets.map((cardSet) => cardSet.id),
    cardSets,
    roles,
    maxSelections: normalizeSelectionCount(raw.maxSelections),
    guidance: typeof raw.guidance === "string" && raw.guidance.trim()
      ? raw.guidance.trim()
      : "직접 질문을 만들거나 질문 카드를 고르고, 오늘 주제에 어울리게 질문을 바꿔봐요.",
  };
}

function normalizeQuestionVotingConfig(value: unknown): QuestionVotingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      sourceRoomId: null,
      sourceRoomTitle: null,
      sourceQuestions: [],
      evaluationCriteria: [],
      maxSelections: 1,
      requireReason: true,
    };
  }

  const raw = value as Record<string, unknown>;
  const sourceQuestions = Array.isArray(raw.sourceQuestions)
    ? raw.sourceQuestions
        .filter((question): question is Record<string, unknown> => typeof question === "object" && question !== null && !Array.isArray(question))
        .map((question, index) => ({
          id: typeof question.id === "string" && question.id.trim() ? question.id.trim() : `question-${index + 1}`,
          text: typeof question.text === "string" ? question.text.trim() : "",
        }))
        .filter((question) => question.text.length > 0)
    : [];
  const dedupedSourceQuestions = dedupeVotingQuestions(sourceQuestions);

  const evaluationCriteria = Array.isArray(raw.evaluationCriteria)
    ? raw.evaluationCriteria
        .filter((criterion): criterion is string => typeof criterion === "string")
        .map((criterion) => criterion.trim())
        .filter(Boolean)
    : [];

  return {
    sourceRoomId: typeof raw.sourceRoomId === "string" && raw.sourceRoomId.trim() ? raw.sourceRoomId.trim() : null,
    sourceRoomTitle: typeof raw.sourceRoomTitle === "string" && raw.sourceRoomTitle.trim() ? raw.sourceRoomTitle.trim() : null,
    sourceQuestions: dedupedSourceQuestions,
    evaluationCriteria,
    maxSelections: normalizeSelectionCount(raw.maxSelections),
    requireReason: raw.requireReason !== false,
  };
}

function normalizeSelectionCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), 4);
}

function dedupeVotingQuestions(questions: Array<{ id: string; text: string }>) {
  const seen = new Map<string, number>();

  return questions.map((question) => {
    const count = seen.get(question.id) ?? 0;
    seen.set(question.id, count + 1);

    if (count === 0) {
      return question;
    }

    return {
      ...question,
      id: `${question.id}__${count + 1}`,
    };
  });
}
