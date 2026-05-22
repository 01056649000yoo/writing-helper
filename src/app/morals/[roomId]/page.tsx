"use client";

import { useEffect, useMemo, useRef, useState, useCallback, startTransition } from "react";
import {
  getActiveMoralsRoom,
  verifyMoralsStudent,
  saveMoralsSkill,
  getMoralsSession,
  toggleMoralsReaction,
  getMoralsRoomSessions,
  getMoralsRoomReactions,
} from "@/app/actions/morals-actions";
import type {
  MoralsRoom,
  MoralsSession,
  MoralsReactionRow,
  MoralsReaction,
  MoralsSkillKey,
  MoralsSkillData,
  MoralsSkillSettings,
} from "@/types/morals";
import {
  MORALS_SKILL_META,
  MORALS_TRACK_META,
  MORALS_REACTION_META,
  DEFAULT_MORALS_SKILL_SETTINGS,
  EMOTION_CARDS,
  VALUE_CARDS,
  PRINCIPLE_CARDS,
} from "@/types/morals";

// ── 공용 ──

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white transition";
const textareaClass = `${inputClass} resize-none`;

function DrawingCanvas({ onChange, initial }: { onChange: (dataUrl: string) => void; initial?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#1e293b");
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    if (!initial || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => { canvasRef.current!.getContext("2d")!.drawImage(img, 0, 0); };
    img.src = initial;
  }, [initial]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault(); drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange("");
  }
  const COLORS = ["#1e293b", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#f97316"];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-gray-600 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-2 ml-2">
          <button type="button" onClick={() => setLineWidth(2)} className={`px-3 py-1 text-xs rounded-lg border ${lineWidth === 2 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>얇게</button>
          <button type="button" onClick={() => setLineWidth(5)} className={`px-3 py-1 text-xs rounded-lg border ${lineWidth === 5 ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-200 text-gray-500"}`}>굵게</button>
        </div>
        <button type="button" onClick={clearCanvas} className="ml-auto px-3 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">전체 지우기</button>
      </div>
      <canvas ref={canvasRef} width={600} height={320}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
    </div>
  );
}

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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                done ? "bg-rose-500 text-white" : active ? "bg-rose-600 text-white ring-4 ring-rose-200" : "bg-gray-100 text-gray-400"
              }`}>
                {done ? "✓" : stepNum}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${active ? "text-rose-700" : done ? "text-rose-500" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? "bg-rose-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillHeader({ skill }: { skill: MoralsSkillKey }) {
  const meta = MORALS_SKILL_META[skill];
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
      className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl">
      {label}
    </button>
  );
}

// ── 스킬별 단계 컴포넌트 ──

type SkillStepProps<K extends MoralsSkillKey> = {
  settings: NonNullable<MoralsSkillSettings[K]>;
  initial?: MoralsSkillData[K];
  onSubmit: (data: NonNullable<MoralsSkillData[K]>) => void;
  isLast: boolean;
};

function SituationStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"situation">) {
  const [when, setWhen] = useState(initial?.when ?? "");
  const [where, setWhere] = useState(initial?.where ?? "");
  const [who, setWho] = useState(initial?.who ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [drawingData, setDrawingData] = useState(initial?.drawingData ?? "");
  const canProceed = summary.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="situation" />
      {settings.promptWhen && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">📅 언제</p>
          <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="예) 어제 점심시간" className={inputClass} />
        </div>
      )}
      {settings.promptWhere && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">📍 어디서</p>
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="예) 교실, 운동장" className={inputClass} />
        </div>
      )}
      {settings.promptWho && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">👥 누구와</p>
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="예) 친구와, 동생과" className={inputClass} />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-600">✍️ 무슨 일이 있었는지</p>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4}
          placeholder="누가 무엇을 했고, 어떻게 흘러갔는지 자세히 적어봐요." className={textareaClass} />
      </div>
      {settings.useDrawing && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">🎨 그림으로 표현 <span className="text-gray-400 font-normal">(선택)</span></p>
          <DrawingCanvas onChange={setDrawingData} initial={initial?.drawingData} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ when, where, who, summary, drawingData })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function EmotionStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"emotion">) {
  const [selected, setSelected] = useState<Array<{ label: string; intensity?: number }>>(initial?.selected ?? []);
  const [note, setNote] = useState(initial?.note ?? "");

  const availableCards = EMOTION_CARDS.filter((c) => settings.enabledTones.includes(c.tone));

  function toggle(label: string) {
    const has = selected.some((s) => s.label === label);
    if (has) setSelected((p) => p.filter((s) => s.label !== label));
    else if (settings.allowMultiple) setSelected((p) => [...p, { label, intensity: settings.promptIntensity ? 3 : undefined }]);
    else setSelected([{ label, intensity: settings.promptIntensity ? 3 : undefined }]);
  }
  function updateIntensity(label: string, intensity: number) {
    setSelected((p) => p.map((s) => s.label === label ? { ...s, intensity } : s));
  }
  const canProceed = selected.length > 0;

  return (
    <div className="space-y-6">
      <SkillHeader skill="emotion" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">💗 그때 내 마음에 가까운 감정</p>
        <div className="flex flex-wrap gap-2">
          {availableCards.map((c) => {
            const active = selected.some((s) => s.label === c.label);
            return (
              <button key={c.label} type="button" onClick={() => toggle(c.label)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm font-medium ${
                  active ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                }`}>
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {settings.promptIntensity && selected.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📊 감정 강도 (1=약함 / 5=강함)</p>
          {selected.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-24 shrink-0">{s.label}</span>
              <input type="range" min={1} max={5} value={s.intensity ?? 3} onChange={(e) => updateIntensity(s.label, Number(e.target.value))} className="flex-1" />
              <span className="text-sm font-bold text-rose-600 w-6 text-right">{s.intensity ?? 3}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-600">📝 한 줄로 이 마음을 표현한다면</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="예) 친구가 미웠지만 한편으론 미안하기도 했다." className={textareaClass} />
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ selected, note })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function ValueFindStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"value_find">) {
  const [values, setValues] = useState<string[]>(initial?.values ?? []);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const availableCards = VALUE_CARDS.filter((c) => settings.enabledAreas.includes(c.area));

  function toggle(label: string) {
    setValues((p) => p.includes(label) ? p.filter((x) => x !== label) : [...p, label]);
  }
  const canProceed = values.length > 0 && (!settings.requireReason || reason.trim().length > 0);

  return (
    <div className="space-y-6">
      <SkillHeader skill="value_find" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">✨ 이 상황과 어울리는 가치 (여러 개 선택 가능)</p>
        <div className="flex flex-wrap gap-2">
          {availableCards.map((c) => {
            const active = values.includes(c.label);
            return (
              <button key={c.label} type="button" onClick={() => toggle(c.label)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm font-medium ${
                  active ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                }`}>
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {settings.requireReason && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">🤔 왜 이 가치들이 떠올랐나요?</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="가치와 상황을 연결해서 적어봐요." className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ values, reason })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function PerspectiveStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"perspective">) {
  const [parties, setParties] = useState<Array<{ role: string; feeling: string; thought: string }>>(
    initial?.parties ?? Array.from({ length: settings.partyCount }, () => ({ role: "", feeling: "", thought: "" }))
  );
  function update(idx: number, field: "role" | "feeling" | "thought", v: string) {
    setParties((p) => p.map((x, i) => i === idx ? { ...x, [field]: v } : x));
  }
  const canProceed = parties.every((p) => p.role.trim() && p.thought.trim());

  return (
    <div className="space-y-6">
      <SkillHeader skill="perspective" />
      <div className="space-y-4">
        {parties.map((p, idx) => (
          <div key={idx} className="bg-rose-50/50 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-600">상대 {idx + 1}</p>
            <input value={p.role} onChange={(e) => update(idx, "role", e.target.value)} placeholder="누구의 입장? (예: 친구, 동생)" className={inputClass} />
            {settings.promptFeeling && (
              <input value={p.feeling} onChange={(e) => update(idx, "feeling", e.target.value)} placeholder="그 사람의 마음은 어땠을까?" className={inputClass} />
            )}
            <textarea value={p.thought} onChange={(e) => update(idx, "thought", e.target.value)} rows={2}
              placeholder="그 사람은 무엇을 생각했을까?" className={textareaClass} />
          </div>
        ))}
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ parties })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function ResolutionStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"resolution">) {
  const [resolution, setResolution] = useState(initial?.resolution ?? (settings.useTemplate ? "다음에 " : ""));
  const [practicePartner, setPracticePartner] = useState(initial?.practicePartner ?? "");
  const canProceed = resolution.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="resolution" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-600">🌱 나의 다짐</p>
        <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3}
          placeholder={settings.useTemplate ? "다음에 ~한 상황이 오면 ~ 하겠다." : "어떻게 하면 좋을지 적어봐요"} className={textareaClass} />
      </div>
      {settings.askPracticePartner && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">🤝 같이 실천하거나 도와줄 사람</p>
          <input value={practicePartner} onChange={(e) => setPracticePartner(e.target.value)}
            placeholder="예) 짝꿍, 엄마, 선생님" className={inputClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ resolution, practicePartner })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function DilemmaStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"dilemma">) {
  const [valueA, setValueA] = useState(initial?.valueA ?? "");
  const [valueB, setValueB] = useState(initial?.valueB ?? "");
  const [context, setContext] = useState(initial?.context ?? "");
  const canProceed = valueA.trim() && valueB.trim();
  return (
    <div className="space-y-6">
      <SkillHeader skill="dilemma" />
      {settings.useTwoValueTemplate ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-rose-600">가치 A</p>
            <input value={valueA} onChange={(e) => setValueA(e.target.value)} placeholder="예) 정직" className={inputClass} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-rose-600">가치 B</p>
            <input value={valueB} onChange={(e) => setValueB(e.target.value)} placeholder="예) 친구와의 약속" className={inputClass} />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">⚖️ 부딪치는 두 가치</p>
          <input value={valueA} onChange={(e) => setValueA(e.target.value)} placeholder="첫 번째" className={inputClass} />
          <input value={valueB} onChange={(e) => setValueB(e.target.value)} placeholder="두 번째" className={inputClass} />
        </div>
      )}
      {settings.promptContext && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">📍 왜 갈등 상황인가요?</p>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3}
            placeholder="어떤 상황에서 이 두 가치가 부딪치는지 설명해봐요." className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ valueA, valueB, context })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function StakeholdersStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"stakeholders">) {
  const [parties, setParties] = useState<Array<{ role: string; feeling: string; need: string }>>(
    initial?.parties ?? Array.from({ length: settings.partyCount }, () => ({ role: "", feeling: "", need: "" }))
  );
  function update(idx: number, field: "role" | "feeling" | "need", v: string) {
    setParties((p) => p.map((x, i) => i === idx ? { ...x, [field]: v } : x));
  }
  const canProceed = parties.every((p) => p.role.trim());
  return (
    <div className="space-y-6">
      <SkillHeader skill="stakeholders" />
      <div className="space-y-4">
        {parties.map((p, idx) => (
          <div key={idx} className="bg-violet-50/50 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-violet-600">관련된 사람 {idx + 1}</p>
            <input value={p.role} onChange={(e) => update(idx, "role", e.target.value)} placeholder="누구? (예: 친구, 선생님, 부모님)" className={inputClass} />
            {settings.requireFeeling && (
              <input value={p.feeling} onChange={(e) => update(idx, "feeling", e.target.value)} placeholder="이 사람의 감정" className={inputClass} />
            )}
            {settings.requireNeed && (
              <input value={p.need} onChange={(e) => update(idx, "need", e.target.value)} placeholder="이 사람이 원하는 것" className={inputClass} />
            )}
          </div>
        ))}
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ parties })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function PrincipleStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"principle">) {
  const enabledCards = PRINCIPLE_CARDS.filter((c) => settings.enabledPrinciples.includes(c.label));
  const [applied, setApplied] = useState<Array<{ label: string; application: string }>>(initial?.appliedPrinciples ?? []);

  function toggle(label: string) {
    const has = applied.some((a) => a.label === label);
    if (has) setApplied((p) => p.filter((a) => a.label !== label));
    else setApplied((p) => [...p, { label, application: "" }]);
  }
  function updateApplication(label: string, v: string) {
    setApplied((p) => p.map((a) => a.label === label ? { ...a, application: v } : a));
  }
  const canProceed = applied.length > 0 && (!settings.requireApplication || applied.every((a) => a.application.trim()));

  return (
    <div className="space-y-6">
      <SkillHeader skill="principle" />
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">📐 적용할 도덕 원칙 선택</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {enabledCards.map((c) => {
            const active = applied.some((a) => a.label === c.label);
            return (
              <button key={c.label} type="button" onClick={() => toggle(c.label)}
                className={`text-left p-3 rounded-2xl border ${
                  active ? "bg-rose-50 border-rose-300" : "bg-white border-gray-200 hover:border-rose-200"
                }`}>
                <p className={`text-sm font-bold ${active ? "text-rose-700" : "text-gray-700"}`}>{c.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
              </button>
            );
          })}
        </div>
      </div>
      {settings.requireApplication && applied.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📝 이 원칙을 이 상황에 어떻게 적용하나요?</p>
          {applied.map((a) => (
            <div key={a.label} className="space-y-1">
              <p className="text-xs font-semibold text-rose-600">{a.label}</p>
              <textarea value={a.application} onChange={(e) => updateApplication(a.label, e.target.value)} rows={2}
                placeholder={`'${a.label}'을(를) 적용하면 어떻게 행동해야 할지 적어봐요.`} className={textareaClass} />
            </div>
          ))}
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ appliedPrinciples: applied })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function ConsequenceStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"consequence">) {
  const [shortTerm, setShortTerm] = useState(initial?.shortTerm ?? "");
  const [longTerm, setLongTerm] = useState(initial?.longTerm ?? "");
  const [impactSelf, setImpactSelf] = useState(initial?.impactSelf ?? "");
  const [impactOthers, setImpactOthers] = useState(initial?.impactOthers ?? "");
  const canProceed = shortTerm.trim().length > 0 || longTerm.trim().length > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="consequence" />
      {settings.splitShortLong ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-600">⏱️ 단기 결과 (오늘·이번 주)</p>
            <textarea value={shortTerm} onChange={(e) => setShortTerm(e.target.value)} rows={3} placeholder="바로 어떤 일이 일어날까?" className={textareaClass} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-600">📅 장기 결과 (한 달·일년 후)</p>
            <textarea value={longTerm} onChange={(e) => setLongTerm(e.target.value)} rows={3} placeholder="시간이 지나면 어떤 영향이 있을까?" className={textareaClass} />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">🔮 예상되는 결과</p>
          <textarea value={shortTerm} onChange={(e) => setShortTerm(e.target.value)} rows={4} placeholder="어떤 결과가 따라올지 적어봐요" className={textareaClass} />
        </div>
      )}
      {settings.considerOthers && (
        <>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-600">🙋 나에게 미치는 영향</p>
            <textarea value={impactSelf} onChange={(e) => setImpactSelf(e.target.value)} rows={2} className={textareaClass} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-600">👫 상대·공동체에 미치는 영향</p>
            <textarea value={impactOthers} onChange={(e) => setImpactOthers(e.target.value)} rows={2} className={textareaClass} />
          </div>
        </>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ shortTerm, longTerm, impactSelf, impactOthers })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function ActionPlanStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"action_plan">) {
  const [actions, setActions] = useState<Array<{ when: string; what: string; how: string }>>(
    initial?.actions ?? [{ when: "", what: "", how: "" }]
  );
  const [obstacles, setObstacles] = useState(initial?.obstacles ?? "");

  function update(idx: number, field: "when" | "what" | "how", v: string) {
    setActions((p) => p.map((a, i) => i === idx ? { ...a, [field]: v } : a));
  }
  function addAction() { setActions((p) => [...p, { when: "", what: "", how: "" }]); }
  function removeAction(idx: number) { setActions((p) => p.filter((_, i) => i !== idx)); }

  const canProceed = actions.some((a) => a.what.trim());

  return (
    <div className="space-y-6">
      <SkillHeader skill="action_plan" />
      <div className="space-y-3">
        {actions.map((a, idx) => (
          <div key={idx} className="bg-emerald-50/50 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-600">실천 {idx + 1}</p>
              {actions.length > 1 && (
                <button type="button" onClick={() => removeAction(idx)} className="text-xs text-gray-400 hover:text-red-500">✕ 삭제</button>
              )}
            </div>
            {settings.useChecklistFormat ? (
              <>
                <input value={a.when} onChange={(e) => update(idx, "when", e.target.value)} placeholder="📅 언제 (예: 내일 아침)" className={inputClass} />
                <input value={a.what} onChange={(e) => update(idx, "what", e.target.value)} placeholder="✅ 무엇을" className={inputClass} />
                <input value={a.how} onChange={(e) => update(idx, "how", e.target.value)} placeholder="🛠️ 어떻게" className={inputClass} />
              </>
            ) : (
              <textarea value={a.what} onChange={(e) => update(idx, "what", e.target.value)} rows={2}
                placeholder="실천할 행동을 구체적으로 적어봐요" className={textareaClass} />
            )}
          </div>
        ))}
        <button type="button" onClick={addAction} className="text-xs text-rose-600 font-semibold hover:underline">+ 실천 추가</button>
      </div>
      {settings.askObstacles && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">🚧 방해가 될 수 있는 일과 극복 방법</p>
          <textarea value={obstacles} onChange={(e) => setObstacles(e.target.value)} rows={3}
            placeholder="실천을 막을 수 있는 것과 어떻게 넘어갈지 적어봐요." className={textareaClass} />
        </div>
      )}
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ actions, obstacles })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

function SelfReviewStep({ settings, initial, onSubmit, isLast }: SkillStepProps<"self_review">) {
  const [progress, setProgress] = useState(initial?.progress ?? "");
  const [adjustment, setAdjustment] = useState(initial?.adjustment ?? "");
  const [feeling, setFeeling] = useState(initial?.feeling ?? "");
  const canProceed = (progress.trim().length + feeling.trim().length) > 0;
  return (
    <div className="space-y-6">
      <SkillHeader skill="self_review" />
      <div className="bg-rose-50 rounded-2xl p-4 text-xs text-rose-700">
        💡 {settings.followUpDays}일 전 다짐을 되돌아보는 시간이에요. 정말 그렇게 실천했는지 솔직하게 적어봐요.
      </div>
      {settings.askProgress && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">✅ 실천 진행 상황</p>
          <textarea value={progress} onChange={(e) => setProgress(e.target.value)} rows={3}
            placeholder="무엇을 했고, 어디까지 했는지 적어봐요." className={textareaClass} />
        </div>
      )}
      {settings.askAdjustment && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">🔧 보완할 점</p>
          <textarea value={adjustment} onChange={(e) => setAdjustment(e.target.value)} rows={3}
            placeholder="다음에는 어떻게 다르게 할지 적어봐요." className={textareaClass} />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-600">💗 지나고 보니 드는 마음</p>
        <textarea value={feeling} onChange={(e) => setFeeling(e.target.value)} rows={2}
          placeholder="지금 이 일에 대해 어떤 마음이 드나요?" className={textareaClass} />
      </div>
      <NextButton disabled={!canProceed} onClick={() => onSubmit({ progress, adjustment, feeling })}
        label={isLast ? "제출하기 🎉" : "다음 단계로 →"} />
    </div>
  );
}

// ── 스킬 라우터 ──

function SkillStep({
  skill, settings, initial, onSubmit, isLast,
}: {
  skill: MoralsSkillKey;
  settings: MoralsSkillSettings;
  initial: MoralsSkillData;
  onSubmit: (data: NonNullable<MoralsSkillData[MoralsSkillKey]>) => void;
  isLast: boolean;
}) {
  const merged = { ...DEFAULT_MORALS_SKILL_SETTINGS, ...settings };
  switch (skill) {
    case "situation": return <SituationStep settings={merged.situation} initial={initial.situation} onSubmit={onSubmit as never} isLast={isLast} />;
    case "emotion": return <EmotionStep settings={merged.emotion} initial={initial.emotion} onSubmit={onSubmit as never} isLast={isLast} />;
    case "value_find": return <ValueFindStep settings={merged.value_find} initial={initial.value_find} onSubmit={onSubmit as never} isLast={isLast} />;
    case "perspective": return <PerspectiveStep settings={merged.perspective} initial={initial.perspective} onSubmit={onSubmit as never} isLast={isLast} />;
    case "resolution": return <ResolutionStep settings={merged.resolution} initial={initial.resolution} onSubmit={onSubmit as never} isLast={isLast} />;
    case "dilemma": return <DilemmaStep settings={merged.dilemma} initial={initial.dilemma} onSubmit={onSubmit as never} isLast={isLast} />;
    case "stakeholders": return <StakeholdersStep settings={merged.stakeholders} initial={initial.stakeholders} onSubmit={onSubmit as never} isLast={isLast} />;
    case "principle": return <PrincipleStep settings={merged.principle} initial={initial.principle} onSubmit={onSubmit as never} isLast={isLast} />;
    case "consequence": return <ConsequenceStep settings={merged.consequence} initial={initial.consequence} onSubmit={onSubmit as never} isLast={isLast} />;
    case "action_plan": return <ActionPlanStep settings={merged.action_plan} initial={initial.action_plan} onSubmit={onSubmit as never} isLast={isLast} />;
    case "self_review": return <SelfReviewStep settings={merged.self_review} initial={initial.self_review} onSubmit={onSubmit as never} isLast={isLast} />;
  }
}

// ── 동료 반응 (peer review) ──

function PeerReactions({ room, mySessionId }: { room: MoralsRoom; mySessionId: string }) {
  const [sessions, setSessions] = useState<MoralsSession[]>([]);
  const [reactions, setReactions] = useState<MoralsReactionRow[]>([]);
  const roomId = room.id;

  const runLoad = useCallback(async (cancelled: { value: boolean }) => {
    const [s, r] = await Promise.all([getMoralsRoomSessions(roomId), getMoralsRoomReactions(roomId)]);
    if (cancelled.value) return;
    startTransition(() => {
      setSessions(s.filter((sess) => sess.id !== mySessionId && sess.status === "done"));
      setReactions(r);
    });
  }, [roomId, mySessionId]);

  useEffect(() => {
    const cancelled = { value: false };
    void runLoad(cancelled);
    const t = setInterval(() => void runLoad(cancelled), 5000);
    return () => { cancelled.value = true; clearInterval(t); };
  }, [runLoad]);

  async function react(targetId: string, reaction: MoralsReaction) {
    await toggleMoralsReaction(roomId, mySessionId, targetId, reaction);
    const cancelled = { value: false };
    void runLoad(cancelled);
  }
  function myReaction(targetId: string, reaction: MoralsReaction) {
    return reactions.some((r) => r.reviewer_session_id === mySessionId && r.target_session_id === targetId && r.reaction === reaction);
  }
  function reactionCount(targetId: string, reaction: MoralsReaction) {
    return reactions.filter((r) => r.target_session_id === targetId && r.reaction === reaction).length;
  }

  const ALL: MoralsReaction[] = ["empathy", "reflect", "respect"];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">💬 친구 글에 마음 전하기</h2>
        <p className="text-sm text-gray-400 mt-1">친구들의 글을 읽고 따뜻한 반응을 남겨봐요!</p>
      </div>
      {sessions.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">아직 완료한 친구가 없어요. 잠시 기다려주세요 ⏳</div>
      )}
      {sessions.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-gray-700">{s.student_number}번 {s.student_name}</p>
          <div className="space-y-2">
            {room.enabledSkills.map((skill) => {
              const data = s.skillData[skill];
              if (!data) return null;
              return (
                <div key={skill} className="bg-rose-50/50 rounded-xl p-3 text-xs">
                  <p className="font-semibold text-rose-600 mb-1">{MORALS_SKILL_META[skill].emoji} {MORALS_SKILL_META[skill].label}</p>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">{summarizeSkill(skill, data)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 flex-wrap pt-1">
            {ALL.map((r) => {
              const meta = MORALS_REACTION_META[r];
              const active = myReaction(s.id, r);
              const count = reactionCount(s.id, r);
              return (
                <button key={r} type="button" onClick={() => react(s.id, r)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                    active ? `${meta.color} border-current font-semibold` : "bg-white border-gray-200 text-gray-500"
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

function summarizeSkill(skill: MoralsSkillKey, data: NonNullable<MoralsSkillData[MoralsSkillKey]>): string {
  switch (skill) {
    case "situation": {
      const d = data as NonNullable<MoralsSkillData["situation"]>;
      return [d.when, d.where, d.who].filter(Boolean).join(" · ") + (d.summary ? `\n${d.summary}` : "");
    }
    case "emotion": {
      const d = data as NonNullable<MoralsSkillData["emotion"]>;
      const tags = d.selected.map((s) => s.intensity ? `${s.label}(${s.intensity})` : s.label).join(", ");
      return [tags, d.note].filter(Boolean).join("\n");
    }
    case "value_find": {
      const d = data as NonNullable<MoralsSkillData["value_find"]>;
      return `${d.values.join(", ")}${d.reason ? `\n${d.reason}` : ""}`;
    }
    case "perspective": {
      const d = data as NonNullable<MoralsSkillData["perspective"]>;
      return d.parties.map((p) => `${p.role}: ${p.thought}`).join("\n");
    }
    case "resolution": return (data as NonNullable<MoralsSkillData["resolution"]>).resolution;
    case "dilemma": {
      const d = data as NonNullable<MoralsSkillData["dilemma"]>;
      return `${d.valueA} ↔ ${d.valueB}${d.context ? `\n${d.context}` : ""}`;
    }
    case "stakeholders": {
      const d = data as NonNullable<MoralsSkillData["stakeholders"]>;
      return d.parties.map((p) => `${p.role}: ${p.feeling || ""} ${p.need ? `· ${p.need}` : ""}`).join("\n");
    }
    case "principle": {
      const d = data as NonNullable<MoralsSkillData["principle"]>;
      return d.appliedPrinciples.map((p) => `${p.label}${p.application ? `: ${p.application}` : ""}`).join("\n");
    }
    case "consequence": {
      const d = data as NonNullable<MoralsSkillData["consequence"]>;
      return [d.shortTerm && `단기: ${d.shortTerm}`, d.longTerm && `장기: ${d.longTerm}`].filter(Boolean).join("\n");
    }
    case "action_plan": {
      const d = data as NonNullable<MoralsSkillData["action_plan"]>;
      return d.actions.map((a) => [a.when, a.what, a.how].filter(Boolean).join(" · ")).join("\n");
    }
    case "self_review": {
      const d = data as NonNullable<MoralsSkillData["self_review"]>;
      return [d.progress && `진행: ${d.progress}`, d.adjustment && `보완: ${d.adjustment}`, d.feeling].filter(Boolean).join("\n");
    }
  }
}

// ── 메인 ──

export default function MoralsActivityPage({ params }: { params: Promise<{ roomId: string }> }) {
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState<MoralsRoom | null>(null);
  const [session, setSession] = useState<MoralsSession | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [entered, setEntered] = useState(false);
  const [currentSkillIdx, setCurrentSkillIdx] = useState(0);

  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setRoomId(p.roomId);
      getActiveMoralsRoom(p.roomId).then(setRoom);
    });
  }, [params]);

  async function handleEnter() {
    if (!studentNumber || !studentName.trim()) { setError("번호와 이름을 모두 입력해주세요."); return; }
    setLoading(true); setError("");
    const result = await verifyMoralsStudent(roomId, Number(studentNumber), studentName.trim());
    if ("error" in result) { setError(result.error); setLoading(false); return; }
    setSessionId(result.sessionId);
    const sess = await getMoralsSession(result.sessionId);
    setSession(sess);
    if (room) {
      const completed = new Set(sess?.completedSkills ?? []);
      const nextIdx = room.enabledSkills.findIndex((s) => !completed.has(s));
      setCurrentSkillIdx(nextIdx === -1 ? room.enabledSkills.length : nextIdx);
    }
    setEntered(true); setLoading(false);
  }

  async function handleSkillSubmit(skill: MoralsSkillKey, data: NonNullable<MoralsSkillData[MoralsSkillKey]>) {
    if (!room) return;
    const isLast = currentSkillIdx === room.enabledSkills.length - 1;
    await saveMoralsSkill(sessionId, skill, data, { markComplete: true, finalizeSession: isLast });
    setSession((prev) => prev ? {
      ...prev,
      skillData: { ...prev.skillData, [skill]: data },
      completedSkills: prev.completedSkills.includes(skill) ? prev.completedSkills : [...prev.completedSkills, skill],
    } : prev);
    setCurrentSkillIdx((idx) => idx + 1);
  }

  const trackMeta = useMemo(() => room ? MORALS_TRACK_META[room.track] : null, [room]);

  if (!entered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🪞</div>
            <h1 className="text-2xl font-bold text-gray-800">{room?.title ?? "도덕 가치 글쓰기"}</h1>
            {trackMeta && (
              <p className="text-xs font-semibold text-rose-600 mt-2">{trackMeta.emoji} {trackMeta.label}</p>
            )}
            <p className="text-gray-500 mt-2 text-sm">내 번호와 이름을 입력하고 활동을 시작해요</p>
            {room?.topic && <div className="mt-4 rounded-2xl px-4 py-3 text-sm bg-rose-50 text-rose-700">오늘 주제: <strong>{room.topic}</strong></div>}
            {room?.instructions && <p className="text-xs text-gray-400 mt-3 leading-relaxed">{room.instructions}</p>}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">출석 번호</label>
              <input type="number" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} min={1} max={100}
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-2xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rose-400" placeholder="15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} autoComplete="off"
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-xl font-bold text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rose-400"
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
            className="mt-6 w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-lg rounded-2xl">
            {loading ? "확인 중..." : !room ? "활동을 불러오는 중…" : "활동 시작하기 🚀"}
          </button>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const total = room.enabledSkills.length;
  const stepLabels = room.enabledSkills.map((s) => MORALS_SKILL_META[s].label);
  const labels = [...stepLabels, "나누기"];
  const isDone = currentSkillIdx >= total;
  const currentSkill = isDone ? null : room.enabledSkills[currentSkillIdx];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto pb-16 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400">{room.topic}</p>
          <h1 className="text-base font-bold text-gray-800">{room.title}</h1>
          <div className="mt-4">
            <StepBar steps={labels} current={isDone ? total + 1 : currentSkillIdx + 1} />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          {currentSkill && session ? (
            <SkillStep key={currentSkill} skill={currentSkill} settings={room.skillSettings} initial={session.skillData}
              isLast={currentSkillIdx === total - 1}
              onSubmit={(data) => void handleSkillSubmit(currentSkill, data)} />
          ) : (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-gray-800">도덕 글쓰기 완성!</h2>
                <p className="text-sm text-gray-400 mt-1">수고했어요. 친구들의 글에도 마음을 나눠봐요.</p>
              </div>
              <PeerReactions room={room} mySessionId={sessionId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
