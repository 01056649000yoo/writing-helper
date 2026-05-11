"use client";

import { useEffect, useRef, useState, useCallback, startTransition } from "react";
import {
  getActiveScienceRoom,
  createScienceSession,
  saveScienceStep1,
  saveScienceStep2,
  saveScienceStep3,
  toggleScienceReview,
  getScienceRoomSessions,
  getScienceRoomReviews,
} from "@/app/actions/science-actions";
import type {
  ScienceRoom,
  ScienceSession,
  ScienceReview,
  SenseType,
  SenseTag,
  MeasurementEntry,
  VariableCardType,
  ScienceReaction,
} from "@/types/science";
import {
  SENSE_META,
  SENSE_HINT_CARDS,
  VARIABLE_CARD_META,
  REACTION_META,
} from "@/types/science";

// ─────────────────────────────────────────────
// 캔버스 드로잉 컴포넌트
// ─────────────────────────────────────────────
function DrawingCanvas({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1e293b");
  const [lineWidth, setLineWidth] = useState(3);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  const COLORS = ["#1e293b", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#f97316"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-gray-600 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2 ml-2">
          <button type="button" onClick={() => setLineWidth(2)} className={`px-3 py-1 text-xs rounded-lg border transition ${lineWidth === 2 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>얇게</button>
          <button type="button" onClick={() => setLineWidth(5)} className={`px-3 py-1 text-xs rounded-lg border transition ${lineWidth === 5 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>굵게</button>
        </div>
        <button type="button" onClick={clearCanvas} className="ml-auto px-3 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">전체 지우기</button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={320}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// 진행 표시바
// ─────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  const steps = ["관찰", "추론", "질문", "완료"];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done ? "bg-cyan-500 text-white" : active ? "bg-cyan-600 text-white ring-4 ring-cyan-200" : "bg-gray-100 text-gray-400"
              }`}>
                {done ? "✓" : stepNum}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? "text-cyan-700" : done ? "text-cyan-500" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${done ? "bg-cyan-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 1단계: 관찰
// ─────────────────────────────────────────────
function Step1Observe({
  room,
  onNext,
}: {
  room: ScienceRoom;
  onNext: (data: {
    beforeState: string;
    afterState: string;
    senseTags: SenseTag[];
    measurements: MeasurementEntry[];
    drawingData: string;
  }) => void;
}) {
  const cfg = room.config;
  const [beforeState, setBeforeState] = useState("");
  const [afterState, setAfterState] = useState("");
  const [senseTags, setSenseTags] = useState<SenseTag[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>(
    cfg.enabledMeasurements.map((m) => ({ label: m.label, value: "", unit: m.unit }))
  );
  const [drawingData, setDrawingData] = useState("");

  function toggleHint(sense: SenseType, text: string) {
    const exists = senseTags.some((t) => t.sense === sense && t.text === text);
    if (exists) {
      setSenseTags((prev) => prev.filter((t) => !(t.sense === sense && t.text === text)));
    } else {
      setSenseTags((prev) => [...prev, { sense, text }]);
    }
  }

  function canProceed() {
    if (cfg.useBeforeAfter && (!beforeState.trim() || !afterState.trim())) return false;
    if (senseTags.length === 0) return false;
    return true;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">🔍 보았어요 <span className="text-base font-normal text-gray-400">(관찰)</span></h2>
        <p className="text-sm text-gray-400 mt-1">실험에서 본 것, 느낀 것을 있는 그대로 기록해요. 아직 이유는 쓰지 않아도 돼요!</p>
      </div>

      {/* 변화 전·후 */}
      {cfg.useBeforeAfter && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-blue-600">처음에는…</label>
            <textarea
              value={beforeState}
              onChange={(e) => setBeforeState(e.target.value)}
              rows={3}
              placeholder="실험 전 모습을 적어봐요"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-blue-100 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-orange-500">나중에는…</label>
            <textarea
              value={afterState}
              onChange={(e) => setAfterState(e.target.value)}
              rows={3}
              placeholder="실험 후 변화를 적어봐요"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-orange-100 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>
        </div>
      )}

      {/* 감각 카드 */}
      <div className="space-y-3">
        {cfg.enabledSenses.map((sense) => (
          <div key={sense} className="space-y-2">
            <p className="text-sm font-semibold text-gray-600">
              {SENSE_META[sense].emoji} {SENSE_META[sense].label}
            </p>
            <div className="flex flex-wrap gap-2">
              {SENSE_HINT_CARDS[sense].map((hint) => {
                const active = senseTags.some((t) => t.sense === sense && t.text === hint);
                return (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => toggleHint(sense, hint)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      active ? "bg-cyan-500 text-white border-cyan-500" : "bg-white text-gray-600 border-gray-200 hover:border-cyan-300"
                    }`}
                  >
                    {hint}
                  </button>
                );
              })}
              {/* 직접 입력 */}
              <input
                type="text"
                placeholder="직접 입력…"
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 bg-gray-50 focus:outline-none focus:border-cyan-400 w-32"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    setSenseTags((prev) => [...prev, { sense, text: e.currentTarget.value.trim() }]);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 측정값 */}
      {measurements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">📏 측정값</p>
          <div className="grid grid-cols-2 gap-3">
            {measurements.map((m, i) => (
              <div key={m.label} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <span className="text-xs text-gray-500 w-12 shrink-0">{m.label}</span>
                <input
                  type="number"
                  value={m.value}
                  onChange={(e) => {
                    const next = [...measurements];
                    next[i] = { ...m, value: e.target.value };
                    setMeasurements(next);
                  }}
                  placeholder="0"
                  className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none"
                />
                <span className="text-xs text-gray-400">{m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 그림 그리기 */}
      {cfg.useDrawing && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">✏️ 그림으로 표현하기 <span className="text-gray-400 font-normal">(선택)</span></p>
          <DrawingCanvas onChange={setDrawingData} />
        </div>
      )}

      <button
        type="button"
        disabled={!canProceed()}
        onClick={() => onNext({ beforeState, afterState, senseTags, measurements, drawingData })}
        className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-2xl transition-all"
      >
        다음 단계로 → 추론하기
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2단계: 추론
// ─────────────────────────────────────────────
function Step2Infer({
  room,
  senseTags,
  onNext,
}: {
  room: ScienceRoom;
  senseTags: SenseTag[];
  onNext: (data: { inferenceText: string; counterText: string }) => void;
}) {
  const cfg = room.config;
  const CONNECTORS = ["왜냐하면", "그러므로", "~ 때문에", "~ 덕분에"];
  const [inferenceText, setInferenceText] = useState(cfg.useInferenceTemplate ? "나는 " : "");
  const [counterText, setCounterText] = useState("");
  const [showCounter, setShowCounter] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">💡 생각해요 <span className="text-base font-normal text-gray-400">(추론)</span></h2>
        <p className="text-sm text-gray-400 mt-1">왜 이런 일이 일어났을지 내 생각을 적어봐요. 관찰한 내용을 근거로 사용해요!</p>
      </div>

      {/* 관찰 내용 참고 */}
      {senseTags.length > 0 && (
        <div className="bg-cyan-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-cyan-600 mb-2">📋 내가 관찰한 것 (참고용)</p>
          <div className="flex flex-wrap gap-1.5">
            {senseTags.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInferenceText((prev) => prev + `[${t.text}]`)}
                className="px-2.5 py-1 bg-white border border-cyan-200 rounded-full text-xs text-cyan-700 hover:bg-cyan-100 transition"
              >
                {SENSE_META[t.sense].emoji} {t.text}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-cyan-400 mt-2">카드를 누르면 아래 글에 추가돼요</p>
        </div>
      )}

      {/* 연결어 힌트 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">연결어 힌트</p>
        <div className="flex flex-wrap gap-2">
          {CONNECTORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setInferenceText((prev) => prev + " " + c + " ")}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={inferenceText}
        onChange={(e) => setInferenceText(e.target.value)}
        rows={5}
        placeholder="나는 ~ 때문에, ~ 라고 생각합니다."
        className="w-full px-4 py-3 text-sm rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white resize-none transition"
      />

      {/* 반대 생각 */}
      {cfg.useCounterArgument && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCounter((v) => !v)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            🤔 혹시 다른 이유 때문은 아닐까? {showCounter ? "▲" : "▼"}
          </button>
          {showCounter && (
            <textarea
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              rows={3}
              placeholder="다른 가능성을 생각해봐요…"
              className="w-full px-4 py-3 text-sm rounded-2xl border border-indigo-100 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!inferenceText.trim()}
        onClick={() => onNext({ inferenceText, counterText })}
        className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-2xl transition-all"
      >
        다음 단계로 → 질문하기
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3단계: 질문
// ─────────────────────────────────────────────
function Step3Question({
  room,
  onNext,
}: {
  room: ScienceRoom;
  onNext: (data: { questionType: string; questionText: string }) => void;
}) {
  const cfg = room.config;
  const [questionType, setQuestionType] = useState<VariableCardType | "">("");
  const [questionText, setQuestionText] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">❓ 궁금해요 <span className="text-base font-normal text-gray-400">(질문)</span></h2>
        <p className="text-sm text-gray-400 mt-1">실험을 보고 생긴 궁금증을 질문으로 만들어봐요. 변인 카드를 활용하면 더 구체적인 질문을 만들 수 있어요!</p>
      </div>

      {/* 변인 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {cfg.enabledVariableCards.map((v) => {
          const meta = VARIABLE_CARD_META[v];
          const active = questionType === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setQuestionType(v);
                if (!questionText) setQuestionText(meta.placeholder);
              }}
              className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                active ? "bg-cyan-50 border-cyan-400" : "bg-white border-gray-200 hover:border-cyan-200"
              }`}
            >
              <span className="text-2xl">{meta.emoji}</span>
              <div>
                <p className={`text-sm font-bold ${active ? "text-cyan-700" : "text-gray-700"}`}>{meta.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{meta.placeholder}</p>
              </div>
            </button>
          );
        })}
      </div>

      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        rows={4}
        placeholder="궁금한 점을 자유롭게 적어봐요…"
        className="w-full px-4 py-3 text-sm rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white resize-none transition"
      />

      <button
        type="button"
        disabled={!questionText.trim()}
        onClick={() => onNext({ questionType, questionText })}
        className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-2xl transition-all"
      >
        제출하기 🎉
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 4단계: 동료 리뷰
// ─────────────────────────────────────────────
function Step4Review({
  room,
  mySessionId,
}: {
  room: ScienceRoom;
  mySessionId: string;
}) {
  const [sessions, setSessions] = useState<ScienceSession[]>([]);
  const [reviews, setReviews] = useState<ScienceReview[]>([]);

  const roomId = room.id;

  const runLoad = useCallback(async (cancelled: { value: boolean }) => {
    const [s, r] = await Promise.all([
      getScienceRoomSessions(roomId),
      getScienceRoomReviews(roomId),
    ]);
    if (cancelled.value) return;
    startTransition(() => {
      setSessions(s.filter((sess) => sess.id !== mySessionId && sess.status === "done"));
      setReviews(r);
    });
  }, [roomId, mySessionId]);

  useEffect(() => {
    const cancelled = { value: false };
    void runLoad(cancelled);
    const t = setInterval(() => void runLoad(cancelled), 5000);
    return () => {
      cancelled.value = true;
      clearInterval(t);
    };
  }, [runLoad]);

  async function react(targetId: string, reaction: ScienceReaction) {
    await toggleScienceReview(roomId, mySessionId, targetId, reaction);
    const cancelled = { value: false };
    void runLoad(cancelled);
  }

  function myReaction(targetId: string, reaction: ScienceReaction) {
    return reviews.some((r) => r.reviewer_session_id === mySessionId && r.target_session_id === targetId && r.reaction === reaction);
  }

  function reactionCount(targetId: string, reaction: ScienceReaction) {
    return reviews.filter((r) => r.target_session_id === targetId && r.reaction === reaction).length;
  }

  const REACTIONS: ScienceReaction[] = ["agree", "differ", "discovery"];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">👥 친구 관찰 보기 <span className="text-base font-normal text-gray-400">(동료 리뷰)</span></h2>
        <p className="text-sm text-gray-400 mt-1">친구들의 관찰과 추론을 읽고 반응을 남겨봐요!</p>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">아직 완료한 친구가 없어요. 잠시 기다려주세요 ⏳</div>
      )}

      {sessions.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">{s.student_number}번 {s.student_name}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {s.before_state && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="font-semibold text-blue-600 mb-1">처음에는</p>
                <p className="text-gray-600">{s.before_state}</p>
              </div>
            )}
            {s.after_state && (
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="font-semibold text-orange-500 mb-1">나중에는</p>
                <p className="text-gray-600">{s.after_state}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-semibold text-gray-500 mb-1">관찰한 것</p>
              <p className="text-gray-600">{s.sense_tags.map((t) => t.text).join(", ")}</p>
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-3 text-xs">
            <p className="font-semibold text-indigo-600 mb-1">💡 추론</p>
            <p className="text-gray-700">{s.inference_text}</p>
          </div>

          <div className="bg-cyan-50 rounded-xl p-3 text-xs">
            <p className="font-semibold text-cyan-600 mb-1">❓ 질문</p>
            <p className="text-gray-700">{s.question_text}</p>
          </div>

          {/* 반응 버튼 */}
          {room.config.usePeerReview && (
            <div className="flex gap-2 flex-wrap pt-1">
              {REACTIONS.map((reaction) => {
                const meta = REACTION_META[reaction];
                const active = myReaction(s.id, reaction);
                const count = reactionCount(s.id, reaction);
                return (
                  <button
                    key={reaction}
                    type="button"
                    onClick={() => react(s.id, reaction)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                      active ? `${meta.color} border-current font-semibold` : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {meta.emoji} {meta.label} {count > 0 && <span className="font-bold">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function ScienceActivityPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<ScienceRoom | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [currentStep, setCurrentStep] = useState<number>(1);

  // 입장 정보
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 단계별 데이터 (리뷰용 보관)
  const [step1SenseTags, setStep1SenseTags] = useState<{ sense: SenseType; text: string }[]>([]);

  useEffect(() => {
    params.then((p) => {
      setRoomId(p.roomId);
      getActiveScienceRoom(p.roomId).then((r) => {
        setRoom(r);
      });
    });
  }, [params]);

  async function handleEnter() {
    if (!studentNumber || !studentName.trim()) {
      setError("번호와 이름을 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    const result = await createScienceSession(roomId, Number(studentNumber), studentName.trim());
    if ("error" in result) {
      setError(result.error);
    } else {
      setSessionId(result.sessionId);
      setEntered(true);
    }
    setLoading(false);
  }

  async function handleStep1(data: Parameters<typeof saveScienceStep1>[1]) {
    await saveScienceStep1(sessionId, data);
    setStep1SenseTags(data.senseTags);
    setCurrentStep(2);
  }

  async function handleStep2(data: { inferenceText: string; counterText: string }) {
    await saveScienceStep2(sessionId, data);
    setCurrentStep(3);
  }

  async function handleStep3(data: { questionType: string; questionText: string }) {
    await saveScienceStep3(sessionId, data);
    setCurrentStep(4);
  }

  // 입장 화면
  if (!entered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-3">🔬</div>
            <h1 className="text-xl font-bold text-gray-800">{room?.title ?? "과학 관찰 활동"}</h1>
            {room?.topic && <p className="text-sm text-gray-400 mt-1">{room.topic}</p>}
          </div>

          {room?.instructions && (
            <div className="bg-cyan-50 rounded-2xl p-4 text-sm text-cyan-700 leading-relaxed">
              {room.instructions}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="number"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="번호"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="이름"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              onKeyDown={(e) => e.key === "Enter" && handleEnter()}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleEnter}
            disabled={loading || !room}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-2xl transition-all"
          >
            {loading ? "입장 중…" : !room ? "활동을 불러오는 중…" : "활동 시작하기 →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto pb-16 space-y-6">
        {/* 상단 정보 */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400">{room?.topic}</p>
          <h1 className="text-base font-bold text-gray-800">{room?.title}</h1>
          <div className="mt-4">
            <StepBar current={currentStep} />
          </div>
        </div>

        {/* 단계별 컨텐츠 */}
        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          {currentStep === 1 && room && (
            <Step1Observe room={room} onNext={handleStep1} />
          )}
          {currentStep === 2 && room && (
            <Step2Infer room={room} senseTags={step1SenseTags} onNext={handleStep2} />
          )}
          {currentStep === 3 && room && (
            <Step3Question room={room} onNext={handleStep3} />
          )}
          {currentStep === 4 && room && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-gray-800">관찰 기록 완성!</h2>
                <p className="text-sm text-gray-400 mt-1">수고했어요! 친구들의 기록도 살펴봐요.</p>
              </div>
              {room.config.usePeerReview && (
                <Step4Review room={room} mySessionId={sessionId} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
