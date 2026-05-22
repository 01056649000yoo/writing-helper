"use client";

import { useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
import {
  getActiveScienceRoom,
  verifyScienceStudent,
  saveScienceStep1,
  saveScienceStep2,
  saveScienceStep3,
  saveScienceSkill,
  getScienceSession,
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
  SkillKey,
  SkillData,
  SkillSettings,
  DataTransformShape,
} from "@/types/science";
import {
  SENSE_META,
  SENSE_HINT_CARDS,
  VARIABLE_CARD_META,
  REACTION_META,
  SKILL_META,
  TRACK_META,
  DEFAULT_SKILL_SETTINGS,
} from "@/types/science";

// ═══════════════════════════════════════════════
// 공용 컴포넌트
// ═══════════════════════════════════════════════

function DrawingCanvas({ onChange, initial }: { onChange: (dataUrl: string) => void; initial?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1e293b");
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    if (!initial || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
    };
    img.src = initial;
  }, [initial]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
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
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-gray-600 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-2 ml-2">
          <button type="button" onClick={() => setLineWidth(2)} className={`px-3 py-1 text-xs rounded-lg border transition ${lineWidth === 2 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>얇게</button>
          <button type="button" onClick={() => setLineWidth(5)} className={`px-3 py-1 text-xs rounded-lg border transition ${lineWidth === 5 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>굵게</button>
        </div>
        <button type="button" onClick={clearCanvas} className="ml-auto px-3 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">전체 지우기</button>
      </div>
      <canvas ref={canvasRef} width={600} height={320}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
    </div>
  );
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition";
const textareaClass = `${inputClass} resize-none`;

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <div key={label + i} className="flex items-center flex-1 last:flex-none min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
                done ? "bg-cyan-500 text-white" : active ? "bg-cyan-600 text-white ring-4 ring-cyan-200" : "bg-gray-100 text-gray-400"
              }`}>
                {done ? "✓" : stepNum}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${active ? "text-cyan-700" : done ? "text-cyan-500" : "text-gray-400"}`}>{label}</span>
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

function SkillHeader({ skill }: { skill: SkillKey }) {
  const meta = SKILL_META[skill];
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        {meta.studentHeading}
        <span className="text-base font-normal text-gray-400">({meta.label})</span>
      </h2>
      <p className="text-sm text-gray-400 mt-1">{meta.description}</p>
    </div>
  );
}

function NextButton({ disabled, onClick, label }: { disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all">
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════
// 신규: 스킬별 단계 컴포넌트
// ═══════════════════════════════════════════════

type SkillStepProps<K extends SkillKey> = {
  settings: NonNullable<SkillSettings[K]>;
  initial?: SkillData[K];
  onSubmit: (data: NonNullable<SkillData[K]>) => void;
  isLast: boolean;
};

// ── 관찰 ──
function ObservationStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"observation">) {
  const [beforeState, setBeforeState] = useState(initial?.beforeState ?? "");
  const [afterState, setAfterState] = useState(initial?.afterState ?? "");
  const [senseTags, setSenseTags] = useState<SenseTag[]>(initial?.senseTags ?? []);
  const [drawingData, setDrawingData] = useState(initial?.drawingData ?? "");

  function toggleHint(sense: SenseType, text: string) {
    const exists = senseTags.some((t) => t.sense === sense && t.text === text);
    if (exists) setSenseTags((p) => p.filter((t) => !(t.sense === sense && t.text === text)));
    else setSenseTags((p) => [...p, { sense, text }]);
  }
  const canProceed =
    senseTags.length > 0 && (!settings.useBeforeAfter || (beforeState.trim() && afterState.trim()));

  return (
    <div className="space-y-6">
      <SkillHeader skill="observation" />
      {settings.useBeforeAfter && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-blue-600">처음에는…</label>
            <textarea value={beforeState} onChange={(e) => setBeforeState(e.target.value)} rows={3}
              placeholder="실험 전 모습을 적어봐요"
              className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 rounded-xl border border-blue-100 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-orange-500">나중에는…</label>
            <textarea value={afterState} onChange={(e) => setAfterState(e.target.value)} rows={3}
              placeholder="실험 후 변화를 적어봐요"
              className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 rounded-xl border border-orange-100 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {settings.enabledSenses.map((sense) => (
          <div key={sense} className="space-y-2">
            <p className="text-sm font-semibold text-gray-600">{SENSE_META[sense].emoji} {SENSE_META[sense].label}</p>
            <div className="flex flex-wrap gap-2">
              {SENSE_HINT_CARDS[sense].map((hint) => {
                const active = senseTags.some((t) => t.sense === sense && t.text === hint);
                return (
                  <button key={hint} type="button" onClick={() => toggleHint(sense, hint)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      active ? "bg-cyan-500 text-white border-cyan-500" : "bg-white text-gray-600 border-gray-200 hover:border-cyan-300"
                    }`}>
                    {hint}
                  </button>
                );
              })}
              <input type="text" placeholder="직접 입력…"
                className="px-3 py-1.5 rounded-full text-sm text-gray-900 placeholder:text-gray-400 border border-dashed border-gray-300 bg-gray-50 focus:outline-none focus:border-cyan-400 w-32"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    setSenseTags((p) => [...p, { sense, text: e.currentTarget.value.trim() }]);
                    e.currentTarget.value = "";
                  }
                }} />
            </div>
          </div>
        ))}
      </div>

      {settings.useDrawing && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">✏️ 그림으로 표현하기 <span className="text-gray-400 font-normal">(선택)</span></p>
          <DrawingCanvas onChange={setDrawingData} initial={initial?.drawingData} />
        </div>
      )}

      <NextButton disabled={!canProceed} onClick={() => onSubmit({ beforeState, afterState, senseTags, drawingData })}
        label={isLast ? "관찰 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 분류 ──
function ClassificationStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"classification">) {
  const [groupings, setGroupings] = useState(initial?.groupings ?? settings.criteria.map((basis) => ({
    basis,
    groups: [{ name: "", items: [] as string[] }],
  })));
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});

  function updateGroupName(bi: number, gi: number, name: string) {
    setGroupings((prev) => prev.map((g, i) => i === bi
      ? { ...g, groups: g.groups.map((gr, j) => j === gi ? { ...gr, name } : gr) }
      : g));
  }
  function addItem(bi: number, gi: number) {
    const key = `${bi}-${gi}`;
    const text = (itemDrafts[key] ?? "").trim();
    if (!text) return;
    setGroupings((prev) => prev.map((g, i) => i === bi
      ? { ...g, groups: g.groups.map((gr, j) => j === gi ? { ...gr, items: [...gr.items, text] } : gr) }
      : g));
    setItemDrafts((d) => ({ ...d, [key]: "" }));
  }
  function removeItem(bi: number, gi: number, idx: number) {
    setGroupings((prev) => prev.map((g, i) => i === bi
      ? { ...g, groups: g.groups.map((gr, j) => j === gi ? { ...gr, items: gr.items.filter((_, k) => k !== idx) } : gr) }
      : g));
  }
  function addGroup(bi: number) {
    setGroupings((prev) => prev.map((g, i) => i === bi
      ? { ...g, groups: [...g.groups, { name: "", items: [] }] }
      : g));
  }
  function removeGroup(bi: number, gi: number) {
    setGroupings((prev) => prev.map((g, i) => i === bi
      ? { ...g, groups: g.groups.filter((_, j) => j !== gi) }
      : g));
  }

  const canProceed = groupings.some((g) => g.groups.some((gr) => gr.items.length > 0));

  return (
    <div className="space-y-6">
      <SkillHeader skill="classification" />
      <div className="space-y-5">
        {groupings.map((g, bi) => (
          <div key={bi} className="space-y-3 border border-gray-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-gray-700">기준: <span className="text-indigo-600">{g.basis}</span></p>
            <div className="space-y-3">
              {g.groups.map((gr, gi) => (
                <div key={gi} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={gr.name} onChange={(e) => updateGroupName(bi, gi, e.target.value)}
                      placeholder={`무리 ${gi + 1} 이름 (예: 노란색)`} className={inputClass} />
                    {g.groups.length > 1 && (
                      <button type="button" onClick={() => removeGroup(bi, gi)}
                        className="px-3 text-gray-400 hover:text-red-500">×</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {gr.items.map((it, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs">
                        {it}
                        <button type="button" onClick={() => removeItem(bi, gi, idx)} className="text-gray-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={itemDrafts[`${bi}-${gi}`] ?? ""}
                      onChange={(e) => setItemDrafts((d) => ({ ...d, [`${bi}-${gi}`]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(bi, gi); } }}
                      placeholder="여기에 속하는 것 추가" className={inputClass} />
                    <button type="button" onClick={() => addItem(bi, gi)}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold">추가</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addGroup(bi)}
                className="text-xs text-indigo-600 font-semibold hover:underline">+ 새 무리 만들기</button>
            </div>
          </div>
        ))}
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ groupings })}
        label={isLast ? "분류 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 측정 ──
function MeasurementStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"measurement">) {
  const [entries, setEntries] = useState(
    initial?.entries ??
    settings.enabledMeasurements.map((m) => ({
      label: m.label,
      unit: m.unit,
      values: Array.from({ length: settings.repeatCount }, () => ""),
    })),
  );
  function updateValue(ei: number, vi: number, v: string) {
    setEntries((prev) => prev.map((e, i) => i === ei
      ? { ...e, values: e.values.map((x, j) => j === vi ? v : x) }
      : e));
  }
  const canProceed = entries.length > 0 && entries.every((e) => e.values.some((v) => v.trim() !== ""));

  return (
    <div className="space-y-6">
      <SkillHeader skill="measurement" />
      <div className="space-y-4">
        {entries.map((e, ei) => (
          <div key={ei} className="border border-gray-200 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-gray-700">📏 {e.label} ({e.unit})</p>
            <div className={`grid gap-2 ${e.values.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
              {e.values.map((v, vi) => (
                <div key={vi} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                  {e.values.length > 1 && <span className="text-[10px] text-gray-400 w-8 shrink-0">{vi + 1}회</span>}
                  <input type="number" value={v} onChange={(ev) => updateValue(ei, vi, ev.target.value)}
                    placeholder="0" className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none" />
                  <span className="text-xs text-gray-400">{e.unit}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ entries })}
        label={isLast ? "측정 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 예상 ──
function PredictionStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"prediction">) {
  const [prediction, setPrediction] = useState(initial?.prediction ?? (settings.useTemplate ? "나는 " : ""));
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? "");
  const canProceed = prediction.trim().length > 0 && (!settings.useReasoningPrompt || reasoning.trim().length > 0);

  return (
    <div className="space-y-6">
      <SkillHeader skill="prediction" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">🔮 내 예상</p>
        <textarea value={prediction} onChange={(e) => setPrediction(e.target.value)} rows={3}
          placeholder={settings.useTemplate ? "나는 ~ 라고 예상한다" : "어떻게 될지 적어봐요"}
          className={textareaClass} />
      </div>
      {settings.useReasoningPrompt && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">🤔 왜 그렇게 예상했나요?</p>
          <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={3}
            placeholder="예상의 근거를 적어봐요" className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ prediction, reasoning })}
        label={isLast ? "예상 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 추리 ──
function InferenceStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"inference">) {
  const [inferenceText, setInferenceText] = useState(initial?.inferenceText ?? (settings.useTemplate ? "나는 " : ""));
  const [counterText, setCounterText] = useState(initial?.counterText ?? "");
  const [showCounter, setShowCounter] = useState(Boolean(initial?.counterText));
  const CONNECTORS = ["왜냐하면", "그러므로", "~ 때문에", "~ 덕분에"];

  return (
    <div className="space-y-6">
      <SkillHeader skill="inference" />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">연결어 힌트</p>
        <div className="flex flex-wrap gap-2">
          {CONNECTORS.map((c) => (
            <button key={c} type="button" onClick={() => setInferenceText((p) => p + " " + c + " ")}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition">
              {c}
            </button>
          ))}
        </div>
      </div>
      <textarea value={inferenceText} onChange={(e) => setInferenceText(e.target.value)} rows={5}
        placeholder={settings.useTemplate ? "나는 ~ 때문에, ~ 라고 생각합니다." : "왜 그럴지 적어봐요"}
        className={textareaClass} />
      {settings.useCounterArgument && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowCounter((v) => !v)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold">
            🤔 혹시 다른 이유 때문은 아닐까? {showCounter ? "▲" : "▼"}
          </button>
          {showCounter && (
            <textarea value={counterText} onChange={(e) => setCounterText(e.target.value)} rows={3}
              placeholder="다른 가능성을 생각해봐요…"
              className="w-full px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 rounded-2xl border border-indigo-100 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          )}
        </div>
      )}
      <NextButton disabled={!inferenceText.trim()} onClick={() => onSubmit({ inferenceText, counterText })}
        label={isLast ? "추리 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 의사소통 ──
function CommunicationStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"communication">) {
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const aiSummary = initial?.aiSummary ?? "";
  const canProceed = summary.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="communication" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">
          {settings.useThreeLineSummary ? "📝 3줄로 정리해 친구에게 들려주듯 적어요" : "📝 정리해서 적어요"}
        </p>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)}
          rows={settings.useThreeLineSummary ? 3 : 5}
          placeholder={settings.useThreeLineSummary ? "1줄: 무엇을 보았는지\n2줄: 무엇을 생각했는지\n3줄: 무엇이 새로 알게 되었는지" : "친구에게 들려주듯 정리해 보세요"}
          className={textareaClass} />
      </div>
      {settings.useAiSummary && aiSummary && (
        <div className="bg-emerald-50 rounded-xl p-3 text-xs">
          <p className="font-semibold text-emerald-700 mb-1">🤖 AI가 정리한 글</p>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ summary, aiSummary })}
        label={isLast ? "활동 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 문제 인식 ──
function ProblemStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"problem">) {
  const [problemText, setProblemText] = useState(initial?.problemText ?? "");
  const TEMPLATE_HINTS = ["왜 ~할까?", "~하면 어떻게 될까?", "~은 무엇 때문일까?"];
  return (
    <div className="space-y-6">
      <SkillHeader skill="problem" />
      {settings.useObservationLink && (
        <div className="bg-cyan-50 rounded-2xl p-4 text-xs text-cyan-700">
          💡 앞에서 관찰·경험한 것 중에서 더 알아보고 싶은 점이 무엇인가요? 그것을 질문 형태로 다듬어 적어요.
        </div>
      )}
      {settings.useTemplate && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">문제 문장 틀</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_HINTS.map((t) => (
              <button key={t} type="button" onClick={() => setProblemText(t)}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600">{t}</button>
            ))}
          </div>
        </div>
      )}
      <textarea value={problemText} onChange={(e) => setProblemText(e.target.value)} rows={4}
        placeholder="탐구할 문제를 한 문장으로 적어봐요" className={textareaClass} />
      <NextButton disabled={!problemText.trim()} onClick={() => onSubmit({ problemText })}
        label={isLast ? "문제 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 가설 ──
function HypothesisStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"hypothesis">) {
  const [hypothesisText, setHypothesisText] = useState(initial?.hypothesisText ?? (settings.useTemplate ? "만약 " : ""));
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? "");
  const canProceed = hypothesisText.trim().length > 0 && (!settings.requireReasoning || reasoning.trim().length > 0);
  return (
    <div className="space-y-6">
      <SkillHeader skill="hypothesis" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">🧠 가설</p>
        <textarea value={hypothesisText} onChange={(e) => setHypothesisText(e.target.value)} rows={3}
          placeholder={settings.useTemplate ? "만약 ~ 한다면 ~ 일 것이다" : "잠정적 답을 적어봐요"} className={textareaClass} />
      </div>
      {settings.requireReasoning && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">🤔 왜 그렇게 생각하나요?</p>
          <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={3}
            placeholder="가설의 근거를 적어봐요" className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ hypothesisText, reasoning })}
        label={isLast ? "가설 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 변인 통제 ──
function VariableControlStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"variable_control">) {
  const [manipulated, setManipulated] = useState(initial?.manipulated ?? "");
  const [controlled, setControlled] = useState<string[]>(initial?.controlled ?? []);
  const [dependent, setDependent] = useState(initial?.dependent ?? "");

  function toggleControlled(name: string) {
    setControlled((p) => p.includes(name) ? p.filter((x) => x !== name) : [...p, name]);
  }
  const canProceed = manipulated.trim() && dependent.trim();

  return (
    <div className="space-y-6">
      <SkillHeader skill="variable_control" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-amber-700">🎯 조작 변인 (내가 바꾸는 것)</p>
        <div className="grid grid-cols-2 gap-2">
          {settings.enabledVariableCards.map((v) => {
            const meta = VARIABLE_CARD_META[v];
            const active = manipulated === meta.label.replace("를 바꾼다면?", "");
            return (
              <button key={v} type="button" onClick={() => setManipulated(meta.label.replace("를 바꾼다면?", ""))}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                  active ? "bg-amber-50 border-amber-400 text-amber-700" : "bg-white border-gray-200 text-gray-600"
                }`}>
                <span className="text-lg">{meta.emoji}</span>
                <span className="font-semibold">{meta.label.replace("를 바꾼다면?", "")}</span>
              </button>
            );
          })}
        </div>
        <input value={manipulated} onChange={(e) => setManipulated(e.target.value)}
          placeholder="또는 직접 입력 (예: 줄의 길이)" className={inputClass} />
      </div>

      {settings.useControlChecklist && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-700">🧰 통제 변인 (똑같이 유지하는 것)</p>
          <div className="flex flex-wrap gap-2">
            {settings.enabledVariableCards.filter((v) => VARIABLE_CARD_META[v].label.replace("를 바꾼다면?", "") !== manipulated).map((v) => {
              const name = VARIABLE_CARD_META[v].label.replace("를 바꾼다면?", "");
              const active = controlled.includes(name);
              return (
                <button key={v} type="button" onClick={() => toggleControlled(name)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    active ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500"
                  }`}>
                  {VARIABLE_CARD_META[v].emoji} {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-indigo-700">📊 종속 변인 (관찰·측정하는 것)</p>
        <input value={dependent} onChange={(e) => setDependent(e.target.value)}
          placeholder="예) 진자의 주기, 식물의 키, 그림자 길이" className={inputClass} />
      </div>

      <NextButton disabled={!canProceed} onClick={() => onSubmit({ manipulated, controlled, dependent })}
        label={isLast ? "변인 정리 제출 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 자료 변환 ──
function DataTransformStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"data_transform">) {
  const defaultShape: DataTransformShape = initial?.shape ?? settings.enabledShapes[0] ?? "table";
  const [shape, setShape] = useState<DataTransformShape>(defaultShape);
  const [headers, setHeaders] = useState<string[]>(initial?.tableHeaders ?? ["조작 변인", "종속 변인"]);
  const [rows, setRows] = useState<string[][]>(initial?.tableRows ?? [["", ""], ["", ""], ["", ""]]);
  const [chartData, setChartData] = useState<Array<{ label: string; value: string }>>(
    initial?.chartData?.map((p) => ({ label: p.label, value: String(p.value) })) ??
      [{ label: "", value: "" }, { label: "", value: "" }, { label: "", value: "" }]
  );
  const [photoData, setPhotoData] = useState(initial?.photoData ?? "");
  const photoInputRef = useRef<HTMLInputElement>(null);

  function addRow() { setRows((p) => [...p, headers.map(() => "")]); }
  function updateCell(ri: number, ci: number, v: string) {
    setRows((p) => p.map((row, i) => i === ri ? row.map((c, j) => j === ci ? v : c) : row));
  }
  function updateHeader(ci: number, v: string) {
    setHeaders((p) => p.map((h, i) => i === ci ? v : h));
  }
  function addChartPoint() { setChartData((p) => [...p, { label: "", value: "" }]); }
  function updateChart(idx: number, field: "label" | "value", v: string) {
    setChartData((p) => p.map((d, i) => i === idx ? { ...d, [field]: v } : d));
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoData(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoData("");
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const canProceed = shape === "table"
    ? rows.some((r) => r.some((c) => c.trim() !== ""))
    : chartData.some((d) => d.label.trim() !== "");

  return (
    <div className="space-y-6">
      <SkillHeader skill="data_transform" />
      <div className="flex flex-wrap gap-2">
        {settings.enabledShapes.map((s) => (
          <button key={s} type="button" onClick={() => setShape(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              shape === s ? "bg-cyan-500 text-white border-cyan-500" : "bg-white text-gray-600 border-gray-200"
            }`}>
            {s === "table" ? "📋 표" : s === "bar_chart" ? "📊 막대그래프" : "📈 꺾은선그래프"}
          </button>
        ))}
      </div>

      {shape === "table" ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-sm">
            <thead>
              <tr>
                {headers.map((h, ci) => (
                  <th key={ci} className="border border-gray-200 bg-gray-50 p-1">
                    <input value={h} onChange={(e) => updateHeader(ci, e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold text-gray-700 bg-transparent focus:outline-none text-center" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border border-gray-200 p-1">
                      <input value={c} onChange={(e) => updateCell(ri, ci, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-gray-900 bg-transparent focus:outline-none text-center" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addRow}
            className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">+ 행 추가</button>
        </div>
      ) : (
        <div className="space-y-2">
          {chartData.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input value={d.label} onChange={(e) => updateChart(i, "label", e.target.value)}
                placeholder="가로축 (예: 1회)" className={inputClass} />
              <input type="number" value={d.value} onChange={(e) => updateChart(i, "value", e.target.value)}
                placeholder="값" className={`${inputClass} w-32`} />
            </div>
          ))}
          <button type="button" onClick={addChartPoint}
            className="text-xs text-indigo-600 font-semibold hover:underline">+ 점 추가</button>
        </div>
      )}

      {settings.allowPhotoUpload && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-600">📷 결과 사진 (선택)</p>
            {photoData && (
              <button
                type="button"
                onClick={removePhoto}
                className="text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg"
              >
                🗑 사진 삭제
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhoto}
            className="text-xs text-gray-500"
          />
          {photoData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoData} alt="결과 사진" className="max-w-full rounded-xl border border-gray-200" />
          )}
        </div>
      )}

      <NextButton disabled={!canProceed} onClick={() => onSubmit({
        shape,
        tableHeaders: shape === "table" ? headers : undefined,
        tableRows: shape === "table" ? rows : undefined,
        chartData: shape !== "table"
          ? chartData.map((d) => ({ label: d.label, value: Number(d.value) || 0 }))
          : undefined,
        photoData,
      })} label={isLast ? "자료 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 자료 해석 ──
function DataInterpretStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"data_interpret">) {
  const [patterns, setPatterns] = useState<string[]>(initial?.patterns ?? []);
  const [interpretation, setInterpretation] = useState(initial?.interpretation ?? "");
  function toggle(p: string) {
    setPatterns((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }
  const canProceed = interpretation.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="data_interpret" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">🔍 자료에서 보이는 규칙</p>
        <div className="flex flex-wrap gap-2">
          {settings.patternCards.map((p) => {
            const active = patterns.includes(p);
            return (
              <button key={p} type="button" onClick={() => toggle(p)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  active ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-500"
                }`}>
                {p}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">✍️ 자료가 무엇을 말해주나요?</p>
        <textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={5}
          placeholder={settings.useTemplate ? "조작 변인이 ~ 할수록 종속 변인이 ~ 한다." : "자료에서 알 수 있는 점을 적어봐요"}
          className={textareaClass} />
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ patterns, interpretation })}
        label={isLast ? "해석 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 결론 ──
function ConclusionStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"conclusion">) {
  const [conclusionText, setConclusionText] = useState(initial?.conclusionText ?? "");
  const [generalization, setGeneralization] = useState(initial?.generalization ?? "");
  const [followUp, setFollowUp] = useState(initial?.followUp ?? "");
  const canProceed = conclusionText.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="conclusion" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">
          🏁 결론 {settings.compareWithHypothesis && <span className="text-xs text-gray-400 font-normal">(가설과 비교해서)</span>}
        </p>
        <textarea value={conclusionText} onChange={(e) => setConclusionText(e.target.value)} rows={5}
          placeholder={settings.compareWithHypothesis ? "내 가설은 (맞았다/달랐다). 그 까닭은..." : "결론을 적어봐요"}
          className={textareaClass} />
      </div>
      {settings.includeGeneralization && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">🌐 이 결론이 다른 경우에도 적용될까요?</p>
          <textarea value={generalization} onChange={(e) => setGeneralization(e.target.value)} rows={3}
            placeholder="비슷한 상황에서도 같은 결과가 나올지 생각해 봐요" className={textareaClass} />
        </div>
      )}
      {settings.askFollowUp && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">🔮 더 알아보고 싶은 점</p>
          <textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} rows={3}
            placeholder="이번 탐구에서 새로 생긴 궁금증을 적어봐요" className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ conclusionText, generalization, followUp })}
        label={isLast ? "결론 제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// 스킬 라우터 — 키에 맞는 컴포넌트 렌더링
// ═══════════════════════════════════════════════

function SkillStep({
  skill,
  settings,
  initial,
  onSubmit,
  isLast,
}: {
  skill: SkillKey;
  settings: SkillSettings;
  initial: SkillData;
  onSubmit: (data: NonNullable<SkillData[SkillKey]>) => void;
  isLast: boolean;
}) {
  const merged = { ...DEFAULT_SKILL_SETTINGS, ...settings };
  switch (skill) {
    case "observation": return <ObservationStep settings={merged.observation} initial={initial.observation} onSubmit={onSubmit as never} isLast={isLast} />;
    case "classification": return <ClassificationStep settings={merged.classification} initial={initial.classification} onSubmit={onSubmit as never} isLast={isLast} />;
    case "measurement": return <MeasurementStep settings={merged.measurement} initial={initial.measurement} onSubmit={onSubmit as never} isLast={isLast} />;
    case "prediction": return <PredictionStep settings={merged.prediction} initial={initial.prediction} onSubmit={onSubmit as never} isLast={isLast} />;
    case "inference": return <InferenceStep settings={merged.inference} initial={initial.inference} onSubmit={onSubmit as never} isLast={isLast} />;
    case "communication": return <CommunicationStep settings={merged.communication} initial={initial.communication} onSubmit={onSubmit as never} isLast={isLast} />;
    case "problem": return <ProblemStep settings={merged.problem} initial={initial.problem} onSubmit={onSubmit as never} isLast={isLast} />;
    case "hypothesis": return <HypothesisStep settings={merged.hypothesis} initial={initial.hypothesis} onSubmit={onSubmit as never} isLast={isLast} />;
    case "variable_control": return <VariableControlStep settings={merged.variable_control} initial={initial.variable_control} onSubmit={onSubmit as never} isLast={isLast} />;
    case "data_transform": return <DataTransformStep settings={merged.data_transform} initial={initial.data_transform} onSubmit={onSubmit as never} isLast={isLast} />;
    case "data_interpret": return <DataInterpretStep settings={merged.data_interpret} initial={initial.data_interpret} onSubmit={onSubmit as never} isLast={isLast} />;
    case "conclusion": return <ConclusionStep settings={merged.conclusion} initial={initial.conclusion} onSubmit={onSubmit as never} isLast={isLast} />;
  }
}

// ═══════════════════════════════════════════════
// 동료 리뷰 (legacy + 신규 공용)
// ═══════════════════════════════════════════════

function PeerReview({ room, mySessionId }: { room: ScienceRoom; mySessionId: string }) {
  const [sessions, setSessions] = useState<ScienceSession[]>([]);
  const [reviews, setReviews] = useState<ScienceReview[]>([]);
  const roomId = room.id;

  const runLoad = useCallback(async (cancelled: { value: boolean }) => {
    const [s, r] = await Promise.all([getScienceRoomSessions(roomId), getScienceRoomReviews(roomId)]);
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
    return () => { cancelled.value = true; clearInterval(t); };
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
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">👥 친구 기록 보기 <span className="text-base font-normal text-gray-400">(동료 리뷰)</span></h2>
        <p className="text-sm text-gray-400 mt-1">친구들의 탐구 기록을 읽고 반응을 남겨봐요!</p>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">아직 완료한 친구가 없어요. 잠시 기다려주세요 ⏳</div>
      )}

      {sessions.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-gray-700">{s.student_number}번 {s.student_name}</p>
          <PeerSessionPreview room={room} session={s} />
          <div className="flex gap-2 flex-wrap pt-1">
            {REACTIONS.map((reaction) => {
              const meta = REACTION_META[reaction];
              const active = myReaction(s.id, reaction);
              const count = reactionCount(s.id, reaction);
              return (
                <button key={reaction} type="button" onClick={() => react(s.id, reaction)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                    active ? `${meta.color} border-current font-semibold` : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {meta.emoji} {meta.label} {count > 0 && <span className="font-bold">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PeerSessionPreview({ room, session }: { room: ScienceRoom; session: ScienceSession }) {
  // 신규 트랙: skill_data 기반으로 핵심만 요약
  if (room.inquiryTrack && room.enabledSkills.length > 0) {
    return (
      <div className="space-y-2">
        {room.enabledSkills.map((skill) => {
          const data = session.skillData[skill];
          if (!data) return null;
          return (
            <div key={skill} className="bg-gray-50 rounded-xl p-3 text-xs">
              <p className="font-semibold text-gray-600 mb-1">{SKILL_META[skill].emoji} {SKILL_META[skill].label}</p>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{summarizeSkillData(skill, data)}</p>
            </div>
          );
        })}
      </div>
    );
  }
  // legacy: 기존 형식
  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {session.before_state && (
          <div className="bg-blue-50 rounded-xl p-3"><p className="font-semibold text-blue-600 mb-1">처음에는</p><p className="text-gray-600">{session.before_state}</p></div>
        )}
        {session.after_state && (
          <div className="bg-orange-50 rounded-xl p-3"><p className="font-semibold text-orange-500 mb-1">나중에는</p><p className="text-gray-600">{session.after_state}</p></div>
        )}
        <div className="bg-gray-50 rounded-xl p-3"><p className="font-semibold text-gray-500 mb-1">관찰한 것</p><p className="text-gray-600">{session.sense_tags.map((t) => t.text).join(", ")}</p></div>
      </div>
      {session.inference_text && (
        <div className="bg-indigo-50 rounded-xl p-3 text-xs"><p className="font-semibold text-indigo-600 mb-1">💡 추론</p><p className="text-gray-700">{session.inference_text}</p></div>
      )}
      {session.question_text && (
        <div className="bg-cyan-50 rounded-xl p-3 text-xs"><p className="font-semibold text-cyan-600 mb-1">❓ 질문</p><p className="text-gray-700">{session.question_text}</p></div>
      )}
    </>
  );
}

function summarizeSkillData(skill: SkillKey, data: NonNullable<SkillData[SkillKey]>): string {
  switch (skill) {
    case "observation": {
      const d = data as NonNullable<SkillData["observation"]>;
      return [d.beforeState && `처음: ${d.beforeState}`, d.afterState && `나중: ${d.afterState}`, d.senseTags.map((t) => t.text).join(", ")].filter(Boolean).join("\n");
    }
    case "classification": {
      const d = data as NonNullable<SkillData["classification"]>;
      return d.groupings.flatMap((g) => g.groups.map((gr) => `${g.basis}/${gr.name}: ${gr.items.join(", ")}`)).join("\n");
    }
    case "measurement": {
      const d = data as NonNullable<SkillData["measurement"]>;
      return d.entries.map((e) => `${e.label}: ${e.values.filter(Boolean).join(", ")}${e.unit}`).join("\n");
    }
    case "prediction": {
      const d = data as NonNullable<SkillData["prediction"]>;
      return `${d.prediction}${d.reasoning ? `\n근거: ${d.reasoning}` : ""}`;
    }
    case "inference": {
      const d = data as NonNullable<SkillData["inference"]>;
      return d.inferenceText + (d.counterText ? `\n반대 생각: ${d.counterText}` : "");
    }
    case "communication": return (data as NonNullable<SkillData["communication"]>).summary;
    case "problem": return (data as NonNullable<SkillData["problem"]>).problemText;
    case "hypothesis": {
      const d = data as NonNullable<SkillData["hypothesis"]>;
      return `${d.hypothesisText}${d.reasoning ? `\n근거: ${d.reasoning}` : ""}`;
    }
    case "variable_control": {
      const d = data as NonNullable<SkillData["variable_control"]>;
      return `조작: ${d.manipulated}\n통제: ${d.controlled.join(", ")}\n종속: ${d.dependent}`;
    }
    case "data_transform": {
      const d = data as NonNullable<SkillData["data_transform"]>;
      if (d.shape === "table") return `표 ${(d.tableRows ?? []).length}행`;
      return (d.chartData ?? []).map((p) => `${p.label}: ${p.value}`).join(", ");
    }
    case "data_interpret": {
      const d = data as NonNullable<SkillData["data_interpret"]>;
      return `${d.patterns.join(", ")}\n${d.interpretation}`;
    }
    case "conclusion": {
      const d = data as NonNullable<SkillData["conclusion"]>;
      return [d.conclusionText, d.generalization, d.followUp].filter(Boolean).join("\n");
    }
  }
}

// ═══════════════════════════════════════════════
// Legacy 흐름 (관찰 → 추론 → 질문) — 옛 방용
// ═══════════════════════════════════════════════

function LegacyStep1({ room, onNext }: {
  room: ScienceRoom;
  onNext: (d: { beforeState: string; afterState: string; senseTags: SenseTag[]; measurements: MeasurementEntry[]; drawingData: string }) => void;
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
    if (exists) setSenseTags((p) => p.filter((t) => !(t.sense === sense && t.text === text)));
    else setSenseTags((p) => [...p, { sense, text }]);
  }
  const canProceed = senseTags.length > 0 && (!cfg.useBeforeAfter || (beforeState.trim() && afterState.trim()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">🔍 보았어요 <span className="text-base font-normal text-gray-400">(관찰)</span></h2>
        <p className="text-sm text-gray-400 mt-1">실험에서 본 것, 느낀 것을 있는 그대로 기록해요.</p>
      </div>
      {cfg.useBeforeAfter && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-blue-600">처음에는…</label>
            <textarea value={beforeState} onChange={(e) => setBeforeState(e.target.value)} rows={3} placeholder="실험 전 모습을 적어봐요"
              className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 rounded-xl border border-blue-100 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-orange-500">나중에는…</label>
            <textarea value={afterState} onChange={(e) => setAfterState(e.target.value)} rows={3} placeholder="실험 후 변화를 적어봐요"
              className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 rounded-xl border border-orange-100 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {cfg.enabledSenses.map((sense) => (
          <div key={sense} className="space-y-2">
            <p className="text-sm font-semibold text-gray-600">{SENSE_META[sense].emoji} {SENSE_META[sense].label}</p>
            <div className="flex flex-wrap gap-2">
              {SENSE_HINT_CARDS[sense].map((hint) => {
                const active = senseTags.some((t) => t.sense === sense && t.text === hint);
                return (
                  <button key={hint} type="button" onClick={() => toggleHint(sense, hint)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${active ? "bg-cyan-500 text-white border-cyan-500" : "bg-white text-gray-600 border-gray-200"}`}>{hint}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {measurements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">📏 측정값</p>
          <div className="grid grid-cols-2 gap-3">
            {measurements.map((m, i) => (
              <div key={m.label} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <span className="text-xs text-gray-500 w-12 shrink-0">{m.label}</span>
                <input type="number" value={m.value} onChange={(e) => {
                  const next = [...measurements]; next[i] = { ...m, value: e.target.value }; setMeasurements(next);
                }} placeholder="0" className="flex-1 bg-transparent text-sm font-semibold text-gray-800 focus:outline-none" />
                <span className="text-xs text-gray-400">{m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {cfg.useDrawing && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">✏️ 그림으로 표현하기 <span className="text-gray-400 font-normal">(선택)</span></p>
          <DrawingCanvas onChange={setDrawingData} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onNext({ beforeState, afterState, senseTags, measurements, drawingData })} label="다음 단계로 → 추론하기" />
    </div>
  );
}

function LegacyStep2({ room, onNext }: { room: ScienceRoom; onNext: (d: { inferenceText: string; counterText: string }) => void }) {
  const cfg = room.config;
  const CONNECTORS = ["왜냐하면", "그러므로", "~ 때문에", "~ 덕분에"];
  const [inferenceText, setInferenceText] = useState(cfg.useInferenceTemplate ? "나는 " : "");
  const [counterText, setCounterText] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">💡 생각해요 <span className="text-base font-normal text-gray-400">(추론)</span></h2>
        <p className="text-sm text-gray-400 mt-1">왜 이런 일이 일어났을지 적어봐요.</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">연결어 힌트</p>
        <div className="flex flex-wrap gap-2">
          {CONNECTORS.map((c) => (
            <button key={c} type="button" onClick={() => setInferenceText((p) => p + " " + c + " ")}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-full text-gray-600">{c}</button>
          ))}
        </div>
      </div>
      <textarea value={inferenceText} onChange={(e) => setInferenceText(e.target.value)} rows={5}
        placeholder="나는 ~ 때문에, ~ 라고 생각합니다." className={textareaClass} />
      {cfg.useCounterArgument && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowCounter((v) => !v)}
            className="flex items-center gap-2 text-sm text-indigo-600 font-semibold">🤔 다른 이유 {showCounter ? "▲" : "▼"}</button>
          {showCounter && (
            <textarea value={counterText} onChange={(e) => setCounterText(e.target.value)} rows={3} placeholder="다른 가능성"
              className="w-full px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 rounded-2xl border border-indigo-100 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          )}
        </div>
      )}
      <NextButton disabled={!inferenceText.trim()} onClick={() => onNext({ inferenceText, counterText })} label="다음 단계로 → 질문하기" />
    </div>
  );
}

function LegacyStep3({ room, onNext }: { room: ScienceRoom; onNext: (d: { questionType: string; questionText: string }) => void }) {
  const cfg = room.config;
  const [questionType, setQuestionType] = useState<VariableCardType | "">("");
  const [questionText, setQuestionText] = useState("");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">❓ 궁금해요 <span className="text-base font-normal text-gray-400">(질문)</span></h2>
        <p className="text-sm text-gray-400 mt-1">실험을 보고 생긴 궁금증을 적어봐요.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cfg.enabledVariableCards.map((v) => {
          const meta = VARIABLE_CARD_META[v];
          const active = questionType === v;
          return (
            <button key={v} type="button" onClick={() => { setQuestionType(v); if (!questionText) setQuestionText(meta.placeholder); }}
              className={`flex items-start gap-3 p-4 rounded-2xl border text-left ${active ? "bg-cyan-50 border-cyan-400" : "bg-white border-gray-200"}`}>
              <span className="text-2xl">{meta.emoji}</span>
              <div>
                <p className={`text-sm font-bold ${active ? "text-cyan-700" : "text-gray-700"}`}>{meta.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{meta.placeholder}</p>
              </div>
            </button>
          );
        })}
      </div>
      <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4}
        placeholder="궁금한 점을 자유롭게 적어봐요" className={textareaClass} />
      <NextButton disabled={!questionText.trim()} onClick={() => onNext({ questionType, questionText })} label="제출하기 🎉" />
    </div>
  );
}

// ═══════════════════════════════════════════════
// 메인 페이지
// ═══════════════════════════════════════════════

export default function ScienceActivityPage({ params }: { params: Promise<{ roomId: string }> }) {
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<ScienceRoom | null>(null);
  const [session, setSession] = useState<ScienceSession | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [entered, setEntered] = useState(false);

  // 신규: 현재 진행 중인 스킬 인덱스
  const [currentSkillIdx, setCurrentSkillIdx] = useState(0);
  // legacy: 단계 번호
  const [legacyStep, setLegacyStep] = useState<number>(1);

  // 입장 화면
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const isNewTrack = useMemo(() => Boolean(room?.inquiryTrack && room.enabledSkills.length > 0), [room]);

  useEffect(() => {
    params.then((p) => {
      setRoomId(p.roomId);
      getActiveScienceRoom(p.roomId).then(setRoom);
    });
  }, [params]);

  async function handleEnter() {
    if (!studentNumber || !studentName.trim()) {
      setError("번호와 이름을 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await verifyScienceStudent(roomId, Number(studentNumber), studentName.trim());
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSessionId(result.sessionId);
    const sess = await getScienceSession(result.sessionId);
    setSession(sess);
    // 진입 위치 결정
    if (isNewTrack && room) {
      const completedSet = new Set(sess?.completedSkills ?? []);
      const nextIdx = room.enabledSkills.findIndex((s) => !completedSet.has(s));
      setCurrentSkillIdx(nextIdx === -1 ? room.enabledSkills.length : nextIdx);
    } else {
      setLegacyStep(result.currentStep);
    }
    setEntered(true);
    setLoading(false);
  }

  async function handleSkillSubmit(skill: SkillKey, data: NonNullable<SkillData[SkillKey]>) {
    if (!room) return;
    setSubmitError("");
    const isLast = currentSkillIdx === room.enabledSkills.length - 1;
    const result = await saveScienceSkill(sessionId, skill, data, { markComplete: true, finalizeSession: isLast });
    if ("error" in result) {
      setSubmitError(result.error ?? "저장 중 오류가 발생했습니다.");
      return;
    }
    // local merge
    setSession((prev) => prev ? { ...prev, skillData: { ...prev.skillData, [skill]: data }, completedSkills: prev.completedSkills.includes(skill) ? prev.completedSkills : [...prev.completedSkills, skill] } : prev);
    setCurrentSkillIdx((idx) => idx + 1);
  }

  // 입장 화면
  if (!entered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🔬</div>
            <h1 className="text-2xl font-bold text-gray-800">{room?.title ?? "과학 탐구 활동"}</h1>
            {room?.inquiryTrack && (
              <p className="text-xs font-semibold text-cyan-600 mt-2">
                {TRACK_META[room.inquiryTrack].emoji} {TRACK_META[room.inquiryTrack].label}
              </p>
            )}
            <p className="text-gray-500 mt-2 text-sm">내 번호와 이름을 입력하고 활동을 시작해요</p>
            {room?.topic && <div className="mt-4 rounded-2xl px-4 py-3 text-sm bg-cyan-50 text-cyan-700">오늘 주제: <strong>{room.topic}</strong></div>}
            {room?.instructions && <p className="text-xs text-gray-400 mt-3 leading-relaxed">{room.instructions}</p>}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">출석 번호</label>
              <input type="number" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} min={1} max={100}
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-2xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-400" placeholder="15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} autoComplete="off"
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="홍길동" onKeyDown={(e) => e.key === "Enter" && void handleEnter()} />
            </div>
          </div>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-2xl mb-2">⚠️</p>
              <p className="text-red-600 text-sm whitespace-pre-line font-medium">{error}</p>
            </div>
          )}
          <button type="button" onClick={() => void handleEnter()} disabled={loading || !room}
            className="mt-6 w-full py-4 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white font-bold text-lg rounded-2xl transition-colors">
            {loading ? "확인 중..." : !room ? "활동을 불러오는 중…" : "활동 시작하기 🚀"}
          </button>
        </div>
      </div>
    );
  }

  // 신규 트랙 흐름
  if (isNewTrack && room) {
    const totalSteps = room.enabledSkills.length;
    const stepLabels = [...room.enabledSkills.map((s) => SKILL_META[s].label), ...(room.skillSettings.communication?.usePeerReview || room.config.usePeerReview ? ["나누기"] : [])];
    const isDone = currentSkillIdx >= totalSteps;
    const currentSkill = isDone ? null : room.enabledSkills[currentSkillIdx];

    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-4 md:p-6">
        <div className="max-w-2xl mx-auto pb-16 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm px-6 py-4">
            <p className="text-xs text-gray-400">{room.topic}</p>
            <h1 className="text-base font-bold text-gray-800">{room.title}</h1>
            <div className="mt-4">
              <StepBar steps={stepLabels} current={isDone ? totalSteps + 1 : currentSkillIdx + 1} />
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
            {submitError && (
              <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {submitError}
              </div>
            )}
            {currentSkill && session ? (
              <SkillStep
                key={currentSkill}
                skill={currentSkill}
                settings={room.skillSettings}
                initial={session.skillData}
                isLast={currentSkillIdx === totalSteps - 1}
                onSubmit={(data) => void handleSkillSubmit(currentSkill, data)}
              />
            ) : (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="text-5xl mb-3">🎉</div>
                  <h2 className="text-xl font-bold text-gray-800">탐구 기록 완성!</h2>
                  <p className="text-sm text-gray-400 mt-1">수고했어요! 친구들의 기록도 살펴봐요.</p>
                </div>
                {(room.skillSettings.communication?.usePeerReview || room.config.usePeerReview) && (
                  <PeerReview room={room} mySessionId={sessionId} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy 흐름
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto pb-16 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400">{room?.topic}</p>
          <h1 className="text-base font-bold text-gray-800">{room?.title}</h1>
          <div className="mt-4">
            <StepBar steps={["관찰", "추론", "질문", "완료"]} current={legacyStep} />
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          {legacyStep === 1 && room && (
            <LegacyStep1 room={room} onNext={async (d) => { await saveScienceStep1(sessionId, d); setLegacyStep(2); }} />
          )}
          {legacyStep === 2 && room && (
            <LegacyStep2 room={room} onNext={async (d) => { await saveScienceStep2(sessionId, d); setLegacyStep(3); }} />
          )}
          {legacyStep === 3 && room && (
            <LegacyStep3 room={room} onNext={async (d) => { await saveScienceStep3(sessionId, d); setLegacyStep(4); }} />
          )}
          {legacyStep === 4 && room && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-gray-800">관찰 기록 완성!</h2>
                <p className="text-sm text-gray-400 mt-1">수고했어요! 친구들의 기록도 살펴봐요.</p>
              </div>
              {room.config.usePeerReview && <PeerReview room={room} mySessionId={sessionId} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
