"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  setStudentLevel,
  saveAnswers,
  requestOutline,
  getStudentRoomQuestions,
  submitQuestionGenerator,
} from "@/app/actions/student-actions";
import type {
  QuestionCardSet,
  QuestionGeneratorConfig,
  QuestionGeneratorSubmission,
} from "@/features/activities/types";
import type { StudentLevel, QuestionSets, Question, Answer } from "@/types";

type ActivityType = "outline_builder" | "question_generator" | "question_voting";
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
  | "submitting";

type QuestionSelection = QuestionGeneratorSubmission["selections"][number];
type QuestionBuildMode = "direct" | "card_remix";

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [roomId, setRoomId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [activityConfig, setActivityConfig] = useState<QuestionGeneratorConfig | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [levelPending, setLevelPending] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [selectedCardSetId, setSelectedCardSetId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [remixedQuestion, setRemixedQuestion] = useState("");
  const [reason, setReason] = useState("");
  const [questionSelections, setQuestionSelections] = useState<QuestionSelection[]>([]);
  const [questionBuildMode, setQuestionBuildMode] = useState<QuestionBuildMode | null>(null);

  const enabledCardSets = useMemo(() => {
    const allowedIds = new Set(activityConfig?.enabledCardSetIds ?? []);
    const source = allowedIds.size > 0
      ? (activityConfig?.cardSets ?? []).filter((cardSet) => allowedIds.has(cardSet.id))
      : (activityConfig?.cardSets ?? []);
    return source;
  }, [activityConfig]);

  const selectedCardSet = useMemo(
    () => enabledCardSets.find((cardSet) => cardSet.id === selectedCardSetId) ?? null,
    [enabledCardSets, selectedCardSetId]
  );

  const maxSelections = activityConfig?.maxSelections ?? 1;
  const allowCustomQuestion = activityConfig?.allowCustomQuestion ?? false;
  const requireReason = activityConfig?.requireReason ?? true;

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  useEffect(() => {
    if (!roomId) return;

    if (!sessionId) {
      setError("학생 세션 정보를 찾지 못했습니다. 입장 화면에서 다시 시도해주세요.");
      setPageLoading(false);
      return;
    }

    let active = true;
    setPageLoading(true);

    getStudentRoomQuestions(sessionId, roomId).then((data) => {
      if (!active) return;

      if (!data) {
        setError("학생 세션을 확인하지 못했습니다. 입장 화면에서 다시 시도해주세요.");
        setPageLoading(false);
        return;
      }

      setTopic(data.topic ?? "");

      const type = data.activity_type;
      if (type === "question_generator" || type === "question_voting") {
        setActivityType(type);
      } else {
        setActivityType("outline_builder");
      }

      if (type === "question_generator") {
        setActivityConfig(normalizeQuestionGeneratorConfig(data.activity_config));
        setStep("question_intro");
      } else if (type === "question_voting") {
        setStep("question_voting");
      } else {
        setStep("level");
      }
      setPageLoading(false);
    });

    return () => {
      active = false;
    };
  }, [roomId, sessionId]);

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

    if (requireReason && !reason.trim()) {
      setError("왜 이렇게 바꿨는지도 한 줄 적어주세요.");
      return;
    }

    const selection: QuestionSelection = {
      id: `selection-${questionSelections.length + 1}`,
      method: questionBuildMode ?? "card_remix",
      cardSetId: questionBuildMode === "direct" ? "custom" : selectedCardSet?.id ?? "custom",
      cardSetLabel:
        questionBuildMode === "direct"
          ? "직접 질문 만들기"
          : selectedCardSet?.label ?? "질문 카드",
      originalPrompt: questionBuildMode === "direct" ? null : selectedPrompt,
      remixedQuestion: normalizedQuestion,
      reason: reason.trim() || undefined,
    };

    const nextSelections = [...questionSelections, selection];
    setQuestionSelections(nextSelections);
    setError("");

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
    setQuestionBuildMode(null);
    setSelectedCardSetId(null);
    setSelectedPrompt(null);
    setRemixedQuestion("");
    setReason("");
  }

  if (activityType === "question_generator") {
    if (step === "question_intro") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
            <div className="text-6xl mb-4">🃏</div>
            <h1 className="text-2xl font-bold text-gray-800">질문 만들기</h1>
            <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              오늘 주제: <strong>{topic}</strong>
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mt-4">
              {activityConfig?.guidance ?? "직접 질문을 만들거나 질문 카드를 골라 오늘 주제에 어울리게 질문을 바꿔봐요."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="font-semibold text-gray-700">고를 카드 묶음</p>
                <p className="text-2xl font-bold text-sky-600 mt-1">{enabledCardSets.length}개</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="font-semibold text-gray-700">완성할 질문</p>
                <p className="text-2xl font-bold text-sky-600 mt-1">{maxSelections}개</p>
              </div>
            </div>
            <button
              onClick={() => setStep("question_path")}
              className="w-full mt-6 py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 transition-colors"
            >
              질문 만들기 시작
            </button>
          </div>
        </div>
      );
    }

    if (step === "question_path") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="max-w-3xl mx-auto py-8">
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-600 font-semibold">질문 만드는 방법 고르기</p>
                  <h1 className="text-2xl font-bold text-gray-800 mt-1">{topic}</h1>
                  <p className="text-sm text-gray-500 mt-2">
                    내 수준에 맞게 질문을 직접 만들거나, 질문 카드를 참고해서 바꿔볼 수 있어요.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {questionSelections.length} / {maxSelections}개 완료
                </div>
              </div>
            </div>

            {questionSelections.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">지금까지 만든 질문</p>
                <div className="space-y-2">
                  {questionSelections.map((selection) => (
                    <div key={selection.id} className="rounded-2xl bg-sky-50 px-4 py-3">
                      <p className="text-xs font-semibold text-sky-700">{selection.cardSetLabel}</p>
                      <p className="text-sm text-gray-800 mt-1">{selection.remixedQuestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => {
                  setQuestionBuildMode("direct");
                  setSelectedCardSetId(null);
                  setSelectedPrompt(null);
                  setStep("question_rewrite");
                }}
                className="rounded-3xl bg-white p-6 shadow-xl text-left hover:-translate-y-0.5 hover:shadow-2xl transition-all"
              >
                <div className="text-4xl">✍️</div>
                <h2 className="mt-4 text-xl font-bold text-gray-800">직접 질문 만들기</h2>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                  스스로 질문을 잘 만들 수 있다면 바로 오늘 주제에 맞는 질문을 써봐요.
                </p>
              </button>

              <button
                onClick={() => {
                  setQuestionBuildMode("card_remix");
                  setStep("question_set");
                }}
                className="rounded-3xl bg-white p-6 shadow-xl text-left hover:-translate-y-0.5 hover:shadow-2xl transition-all"
              >
                <div className="text-4xl">🃏</div>
                <h2 className="mt-4 text-xl font-bold text-gray-800">질문 카드로 바꾸기</h2>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                  질문 만들기가 어렵다면 마음에 드는 질문 카드를 골라 주제에 맞게 바꿔봐요.
                </p>
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
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-600 font-semibold">질문 카드 묶음 고르기</p>
                  <h1 className="text-2xl font-bold text-gray-800 mt-1">{topic}</h1>
                  <p className="text-sm text-gray-500 mt-2">
                    마음에 드는 카드 묶음을 고른 뒤, 그 안에서 질문 하나를 선택해요.
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {questionSelections.length} / {maxSelections}개 완료
                </div>
              </div>
            </div>

            {questionSelections.length > 0 && (
              <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">지금까지 만든 질문</p>
                <div className="space-y-2">
                  {questionSelections.map((selection) => (
                    <div key={selection.id} className="rounded-2xl bg-sky-50 px-4 py-3">
                      <p className="text-xs font-semibold text-sky-700">{selection.cardSetLabel}</p>
                      <p className="text-sm text-gray-800 mt-1">{selection.remixedQuestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <button
                onClick={() => setStep("question_path")}
                className="text-sm text-sky-600 hover:text-sky-700"
              >
                ← 질문 만드는 방법 다시 고르기
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {enabledCardSets.map((cardSet) => (
                <button
                  key={cardSet.id}
                  onClick={() => {
                    setSelectedCardSetId(cardSet.id);
                    setSelectedPrompt(null);
                    setStep("question_prompt");
                  }}
                  className="rounded-3xl bg-white p-6 shadow-xl text-left hover:-translate-y-0.5 hover:shadow-2xl transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-gray-800">{cardSet.label}</h2>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      {cardSet.prompts.length}장
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-3 leading-relaxed">{cardSet.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_prompt" && selectedCardSet) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 p-4">
          <div className="max-w-3xl mx-auto py-8">
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
              <button
                onClick={() => setStep("question_set")}
                className="text-sm text-sky-600 hover:text-sky-700"
              >
                ← 카드 묶음 다시 고르기
              </button>
              <p className="text-sm font-semibold text-sky-600 mt-4">{selectedCardSet.label} 카드</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-1">어떤 질문을 바꿔볼까요?</h1>
              <p className="text-sm text-gray-500 mt-2">
                마음에 드는 질문을 하나 고른 뒤, 오늘 주제에 어울리게 새 질문으로 바꿔봐요.
              </p>
            </div>

            <div className="grid gap-3">
              {selectedCardSet.prompts.map((prompt, index) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    setStep("question_rewrite");
                  }}
                  className="rounded-3xl bg-white p-5 shadow-lg text-left hover:border-sky-300 hover:bg-sky-50 transition-colors border-2 border-transparent"
                >
                  <p className="text-xs font-semibold text-sky-600 mb-2">질문 카드 {index + 1}</p>
                  <p className="text-gray-800 font-medium leading-relaxed">{prompt}</p>
                </button>
              ))}

              {allowCustomQuestion && (
                <button
                  onClick={() => {
                    setQuestionBuildMode("direct");
                    setSelectedPrompt(null);
                    setStep("question_rewrite");
                  }}
                  className="rounded-3xl border-2 border-dashed border-sky-300 bg-white p-5 text-left text-sky-700 hover:bg-sky-50 transition-colors"
                >
                  <p className="font-semibold">내가 직접 질문 만들기</p>
                  <p className="text-sm text-sky-600 mt-1">카드를 참고해서 완전히 새로운 질문을 써볼래요.</p>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (step === "question_rewrite") {
      const isDirectMode = questionBuildMode === "direct";
      const cardLabel = isDirectMode ? "직접 질문 만들기" : selectedCardSet?.label ?? "질문 카드";

      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-2xl">
            <button
              onClick={() => setStep(isDirectMode ? "question_path" : selectedPrompt ? "question_prompt" : "question_set")}
              className="text-sm text-sky-600 hover:text-sky-700"
            >
              ← 다시 고르기
            </button>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-sky-50 px-4 py-3">
                <p className="text-xs font-semibold text-sky-700">{cardLabel}</p>
                <p className="text-sm text-sky-900 mt-1">오늘 주제: <strong>{topic}</strong></p>
              </div>

              {selectedPrompt ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">고른 질문 카드</p>
                  <p className="text-gray-800 leading-relaxed">{selectedPrompt}</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-50 px-4 py-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {isDirectMode
                      ? "오늘 주제에 맞는 질문을 스스로 생각해서 직접 만들어요."
                      : "카드 아이디어를 참고해서 오늘 주제에 맞는 새로운 질문을 직접 만들어요."}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {isDirectMode ? "오늘 주제에 맞는 내가 만든 질문" : "오늘 주제에 맞게 바꾼 질문"}
                </label>
                <textarea
                  value={remixedQuestion}
                  onChange={(event) => setRemixedQuestion(event.target.value)}
                  rows={4}
                  placeholder={
                    isDirectMode
                      ? "예: 소풍을 다녀온 뒤 내 마음이 가장 오래 머문 장면은 무엇이었을까?"
                      : selectedPrompt
                        ? "예: 소풍을 다녀온 뒤 나는 친구에게 어떤 말을 가장 듣고 싶었을까?"
                        : "오늘 주제에 맞는 나만의 질문을 써봐요."
                  }
                  className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400 resize-none"
                />
              </div>

              {requireReason && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    왜 이렇게 바꿨나요?
                  </label>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    placeholder="이 질문이 왜 좋다고 생각했는지 짧게 적어봐요."
                    className="w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-400 resize-none"
                  />
                </div>
              )}

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={handleQuestionSelectionSubmit}
                className="w-full py-4 bg-sky-500 text-white rounded-2xl font-bold text-lg hover:bg-sky-600 transition-colors"
              >
                {questionSelections.length + 1 < maxSelections ? "이 질문 저장하고 다음 카드 고르기" : "질문 제출하기"}
              </button>
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🗳️</div>
          <h1 className="text-2xl font-bold text-gray-800">좋은 질문 고르기</h1>
          <p className="text-gray-500 mt-3 leading-relaxed">
            이 활동의 학생 화면은 지금 다듬는 중이에요.
            <br />
            선생님이 질문 후보를 준비하면 여기에서 좋은 질문을 고르게 될 거예요.
          </p>
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

function normalizeQuestionGeneratorConfig(value: unknown): QuestionGeneratorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      enabledCardSetIds: [],
      cardSets: [],
      maxSelections: 1,
      guidance: "마음에 드는 질문 카드를 고르고, 오늘 주제에 어울리게 질문을 바꿔봐요.",
      requireReason: true,
      allowCustomQuestion: false,
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
        }))
        .filter((cardSet) => cardSet.label && cardSet.prompts.length > 0)
    : [];
  const allIds = new Set(cardSets.map((cardSet) => cardSet.id));
  const enabledCardSetIds = Array.isArray(raw.enabledCardSetIds)
    ? raw.enabledCardSetIds.filter((cardSetId): cardSetId is string => typeof cardSetId === "string" && allIds.has(cardSetId))
    : cardSets.map((cardSet) => cardSet.id);

  return {
    enabledCardSetIds: enabledCardSetIds.length > 0 ? enabledCardSetIds : cardSets.map((cardSet) => cardSet.id),
    cardSets,
    maxSelections: normalizeSelectionCount(raw.maxSelections),
    guidance: typeof raw.guidance === "string" && raw.guidance.trim()
      ? raw.guidance.trim()
      : "직접 질문을 만들거나 질문 카드를 고르고, 오늘 주제에 어울리게 질문을 바꿔봐요.",
    requireReason: raw.requireReason !== false,
    allowCustomQuestion: Boolean(raw.allowCustomQuestion),
  };
}

function normalizeSelectionCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(Math.trunc(parsed), 1), 4);
}
