"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createScienceRoom } from "@/app/actions/science-actions";
import {
  SENSE_META,
  PRESET_MEASUREMENTS,
  VARIABLE_CARD_META,
  TRACK_META,
  SKILL_META,
  DEFAULT_SKILL_SETTINGS,
  type SenseType,
  type VariableCardType,
  type InquiryTrack,
  type SkillKey,
  type SkillSettings,
  type DataTransformShape,
} from "@/types/science";
import { useActivityDraft } from "@/lib/use-activity-draft";
import { buildDraftStorageKey, clearActivityDraft, SCIENCE_DRAFT_SLUG, persistActivityDraft } from "@/lib/activity-drafts";

type ScienceDraft = {
  title: string;
  topic: string;
  instructions: string;
  duration_hours: string;
  inquiry_track: InquiryTrack | null;
  enabled_skills: SkillKey[];
  skill_settings: SkillSettings;
};

const INITIAL_SCIENCE_DRAFT: ScienceDraft = {
  title: "",
  topic: "",
  instructions: "",
  duration_hours: "2",
  inquiry_track: null,
  enabled_skills: [],
  skill_settings: {},
};

const ALL_SENSES: SenseType[] = ["sight", "smell", "hearing", "touch"];
const ALL_VARIABLES: VariableCardType[] = [
  "temperature", "amount", "material", "time",
  "light", "length", "concentration", "shape", "distance", "weight", "water",
];
const ALL_DATA_SHAPES: DataTransformShape[] = ["table", "bar_chart", "line_chart"];
const DATA_SHAPE_LABEL: Record<DataTransformShape, string> = {
  table: "📋 표",
  bar_chart: "📊 막대그래프",
  line_chart: "📈 꺾은선그래프",
};

function ToggleSwitch({
  on,
  onChange,
  label,
  desc,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div>
        <p className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div
        onClick={() => onChange(!on)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-indigo-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </div>
    </label>
  );
}

function ChipToggle({
  active,
  onClick,
  emoji,
  label,
}: {
  active: boolean;
  onClick: () => void;
  emoji?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
        active
          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
          : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
      }`}
    >
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

function SettingsPanel({
  title,
  emoji,
  children,
  badge,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h3>
        {badge && (
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function NewScienceRoomPageWrapper() {
  return (
    <Suspense>
      <NewScienceRoomPage />
    </Suspense>
  );
}

function NewScienceRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("class_id") ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const storageKey = useMemo(() => buildDraftStorageKey(classId, SCIENCE_DRAFT_SLUG), [classId]);
  const [draft, setDraft, draftControls] = useActivityDraft<ScienceDraft>(storageKey, INITIAL_SCIENCE_DRAFT);

  const { title, topic, instructions, duration_hours: durationHours, inquiry_track: track, enabled_skills: enabledSkills, skill_settings: skillSettings } = draft;
  const trackSkills: SkillKey[] = track ? [...TRACK_META[track].skills] : [];
  const enabledSkillSet = useMemo(() => new Set(enabledSkills), [enabledSkills]);

  if (!classId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-lg p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-700 font-semibold">학급을 선택한 뒤 활동을 만들어야 합니다.</p>
          <Link href="/dashboard" className="inline-block mt-5 text-cyan-600 hover:underline text-sm">
            ← 대시보드로
          </Link>
        </div>
      </div>
    );
  }

  function selectTrack(next: InquiryTrack) {
    // 트랙 바뀌면 활성 스킬·세부 설정 초기화
    setDraft((prev) => ({ ...prev, inquiry_track: next, enabled_skills: [], skill_settings: {} }));
  }

  function toggleSkill(skill: SkillKey) {
    setDraft((prev) => {
      const has = prev.enabled_skills.includes(skill);
      const nextSkills = has ? prev.enabled_skills.filter((s) => s !== skill) : [...prev.enabled_skills, skill];
      const nextSettings = { ...prev.skill_settings };
      if (has) {
        delete nextSettings[skill];
      } else {
        nextSettings[skill] = DEFAULT_SKILL_SETTINGS[skill] as never;
      }
      return { ...prev, enabled_skills: nextSkills, skill_settings: nextSettings };
    });
  }

  function patchSetting<K extends SkillKey>(skill: K, patch: Partial<NonNullable<SkillSettings[K]>>) {
    setDraft((prev) => {
      const current = (prev.skill_settings[skill] ?? DEFAULT_SKILL_SETTINGS[skill]) as NonNullable<SkillSettings[K]>;
      return { ...prev, skill_settings: { ...prev.skill_settings, [skill]: { ...current, ...patch } } };
    });
  }

  function handleSaveDraftNow() {
    persistActivityDraft(storageKey, draft);
    setLastSavedAt(Date.now());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!track) {
      setError("탐구 과정을 먼저 선택해주세요.");
      return;
    }
    if (enabledSkills.length === 0) {
      setError("탐구 활동을 1개 이상 선택해주세요.");
      return;
    }
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("class_id", classId);
    fd.set("title", title);
    fd.set("topic", topic);
    fd.set("instructions", instructions);
    fd.set("duration_hours", durationHours);
    fd.set("inquiry_track", track);
    trackSkills.filter((s) => enabledSkillSet.has(s)).forEach((s) => fd.append("enabled_skills", s));
    fd.set("skill_settings_json", JSON.stringify(skillSettings));

    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);

    const result = await createScienceRoom(fd);
    if ("error" in result) {
      // 실패 시 초안 복원
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setError(result.error ?? "오류가 발생했습니다.");
      setPending(false);
    } else {
      router.push(`/dashboard/science/${result.roomId}`);
    }
  }

  function updateField<K extends keyof ScienceDraft>(field: K, value: ScienceDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-6">
      <div className="max-w-2xl mx-auto pt-8 pb-16">
        <Link href={`/dashboard/class/${classId}`} className="text-cyan-600 text-sm hover:underline">
          ← 학급으로
        </Link>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* 헤더 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔬</span>
              <div>
                <p className="text-xs font-semibold text-cyan-600">교과 연계 글쓰기 활동</p>
                <h1 className="text-2xl font-bold text-gray-800">과학 탐구 글쓰기</h1>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">학년·교육과정에 맞는 탐구 과정을 골라 단계를 설계합니다.</p>
          </div>

          {/* 초안 저장 안내 */}
          <div className="bg-white/80 rounded-2xl border border-cyan-100 px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-cyan-700">📝 자동 초안 저장</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {lastSavedAt
                  ? `마지막 저장: ${new Date(lastSavedAt).toLocaleTimeString("ko-KR")}`
                  : "5초마다 이 브라우저에 자동 저장돼요. 나갔다 돌아와도 이어서 만들 수 있어요."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDraftNow}
              className="text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              지금 저장
            </button>
          </div>

          {/* Step 1. 탐구 과정 선택 */}
          <TrackSelector track={track} onSelect={selectTrack} />

          {/* Step 2. 기본 정보 */}
          {track && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                📌 기본 정보
              </h2>

              <Field label="활동 제목">
                <input
                  required
                  value={title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder={track === "basic" ? "예) 그림자의 변화 관찰" : "예) 진자의 주기 실험"}
                  className={inputClass}
                />
              </Field>

              <Field label="실험·관찰 주제">
                <input
                  required
                  value={topic}
                  onChange={(e) => updateField("topic", e.target.value)}
                  placeholder={track === "basic" ? "예) 시간에 따라 그림자가 어떻게 달라지는지 살펴봐요" : "예) 줄의 길이를 바꾸면 진자의 주기는 어떻게 변할까?"}
                  className={inputClass}
                />
              </Field>

              <Field label="학생 안내문" optional>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => updateField("instructions", e.target.value)}
                  placeholder="활동 시 학생들에게 보여줄 안내문을 적어주세요."
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <Field label="활동 시간">
                <select
                  value={durationHours}
                  onChange={(e) => updateField("duration_hours", e.target.value)}
                  className={inputClass}
                >
                  <option value="1">1시간</option>
                  <option value="2">2시간</option>
                  <option value="4">4시간</option>
                  <option value="8">당일 (8시간)</option>
                  <option value="24">1일 (24시간)</option>
                  <option value="48">2일 (48시간)</option>
                </select>
              </Field>
            </div>
          )}

          {/* Step 3. 탐구 활동 선택 */}
          {track && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                  🧩 이번 수업에서 다룰 탐구 활동
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {TRACK_META[track].label}의 {TRACK_META[track].skills.length}개 활동 중 이번 수업에서 다룰 것만 골라주세요. 교육과정 흐름 순서대로 학생 화면에 단계가 표시됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trackSkills.map((skill, idx) => {
                  const meta = SKILL_META[skill];
                  const active = enabledSkillSet.has(skill);
                  const orderIdx = trackSkills.filter((s) => enabledSkillSet.has(s)).indexOf(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                        active
                          ? "bg-indigo-50 border-indigo-300"
                          : "bg-white border-gray-200 hover:border-indigo-200"
                      }`}
                    >
                      <span className="text-2xl shrink-0">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${active ? "text-indigo-700" : "text-gray-700"}`}>
                          {idx + 1}. {meta.label}
                        </p>
                        <p className={`text-xs mt-1 leading-snug ${active ? "text-indigo-600/70" : "text-gray-400"}`}>
                          {meta.description}
                        </p>
                      </div>
                      {active && (
                        <span className="text-xs font-bold bg-indigo-500 text-white px-2 py-1 rounded-lg shrink-0">
                          {orderIdx + 1}단계
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4. 각 활동 세부 설정 */}
          {track && enabledSkills.length > 0 && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
                  ⚙️ 활동별 세부 설정
                </h2>
                <p className="text-xs text-gray-400 mt-1">선택한 활동마다 필요한 옵션만 조정하세요.</p>
              </div>

              <div className="space-y-4">
                {trackSkills.filter((s) => enabledSkillSet.has(s)).map((skill, idx) => (
                  <SkillSettingsBlock
                    key={skill}
                    skill={skill}
                    orderLabel={`${idx + 1}단계`}
                    settings={skillSettings[skill] ?? DEFAULT_SKILL_SETTINGS[skill]}
                    patch={(p) => patchSetting(skill, p)}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !track || enabledSkills.length === 0}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl shadow-lg transition-all"
          >
            {pending ? "활동 만드는 중..." : "활동 시작하기 →"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition";

function Field({
  label,
  children,
  optional,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-gray-600">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(선택)</span>}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// 트랙 선택 카드
// ─────────────────────────────────────────
function TrackSelector({
  track,
  onSelect,
}: {
  track: InquiryTrack | null;
  onSelect: (track: InquiryTrack) => void;
}) {
  const tracks: InquiryTrack[] = ["basic", "integrated"];
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
          🎯 어떤 탐구 과정을 사용할까요?
        </h2>
        <p className="text-xs text-gray-400 mt-1">학년에 맞는 탐구 과정을 고르면 그 과정의 탐구 활동들이 펼쳐집니다.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tracks.map((t) => {
          const meta = TRACK_META[t];
          const active = track === t;
          return (
            <button
              type="button"
              key={t}
              onClick={() => onSelect(t)}
              className={`text-left rounded-2xl border-2 p-5 transition-all ${
                active
                  ? "border-cyan-400 bg-cyan-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-cyan-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <p className={`text-sm font-bold ${active ? "text-cyan-700" : "text-gray-700"}`}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-gray-400">{meta.gradeBand}</p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${active ? "text-cyan-700/80" : "text-gray-500"}`}>
                {meta.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {meta.skills.map((s) => (
                  <span
                    key={s}
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      active ? "bg-white text-cyan-700" : "bg-gray-50 text-gray-500"
                    }`}
                  >
                    {SKILL_META[s].emoji} {SKILL_META[s].label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 스킬별 세부 설정 블록 — switch로 스킬마다 다른 UI
// ─────────────────────────────────────────
function SkillSettingsBlock({
  skill,
  orderLabel,
  settings,
  patch,
}: {
  skill: SkillKey;
  orderLabel: string;
  settings: NonNullable<SkillSettings[SkillKey]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: (patch: any) => void;
}) {
  const meta = SKILL_META[skill];

  switch (skill) {
    case "observation":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <ObservationFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "classification":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <ClassificationFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "measurement":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <MeasurementFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "prediction":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <PredictionFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "inference":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <InferenceFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "communication":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <CommunicationFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "problem":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <ProblemFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "hypothesis":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <HypothesisFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "variable_control":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <VariableControlFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "data_transform":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <DataTransformFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "data_interpret":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <DataInterpretFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
    case "conclusion":
      return (
        <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
          <ConclusionFields settings={settings as never} patch={patch} />
        </SettingsPanel>
      );
  }
}

// ── 관찰 ──
function ObservationFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["observation"]>;
  patch: (p: Partial<NonNullable<SkillSettings["observation"]>>) => void;
}) {
  function toggleSense(s: SenseType) {
    if (settings.enabledSenses.includes(s) && settings.enabledSenses.length <= 1) return;
    const next = settings.enabledSenses.includes(s)
      ? settings.enabledSenses.filter((x) => x !== s)
      : [...settings.enabledSenses, s];
    patch({ enabledSenses: next });
  }
  return (
    <>
      <ToggleSwitch on={settings.useBeforeAfter} onChange={(v) => patch({ useBeforeAfter: v })} label="변하기 전·후 카드" desc="변화가 있는 실험에서 대비 구조로 관찰" />
      <ToggleSwitch on={settings.useDrawing} onChange={(v) => patch({ useDrawing: v })} label="그림 그리기" desc="태블릿 캔버스로 직접 스케치" />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">활성화할 감각 카드</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SENSES.map((s) => (
            <ChipToggle
              key={s}
              active={settings.enabledSenses.includes(s)}
              onClick={() => toggleSense(s)}
              emoji={SENSE_META[s].emoji}
              label={SENSE_META[s].label}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ── 분류 ──
function ClassificationFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["classification"]>;
  patch: (p: Partial<NonNullable<SkillSettings["classification"]>>) => void;
}) {
  const [draft, setDraft] = useState("");
  function addCriterion() {
    const value = draft.trim();
    if (!value || settings.criteria.includes(value)) return;
    patch({ criteria: [...settings.criteria, value] });
    setDraft("");
  }
  function removeCriterion(c: string) {
    if (settings.criteria.length <= 1) return;
    patch({ criteria: settings.criteria.filter((x) => x !== c) });
  }
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">분류 기준 카드</p>
        <div className="flex flex-wrap gap-2">
          {settings.criteria.map((c) => (
            <span key={c} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
              {c}
              <button type="button" onClick={() => removeCriterion(c)} className="text-indigo-400 hover:text-indigo-700">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCriterion(); } }}
            placeholder="예) 색, 모양, 크기, 사는 곳..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={addCriterion}
            className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200"
          >
            추가
          </button>
        </div>
      </div>
      <ToggleSwitch
        on={settings.allowMultiLevel}
        onChange={(v) => patch({ allowMultiLevel: v })}
        label="다단 분류 허용"
        desc="한 번 나눈 무리를 또 한 번 더 나눌 수 있게 합니다"
      />
    </>
  );
}

// ── 측정 ──
function MeasurementFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["measurement"]>;
  patch: (p: Partial<NonNullable<SkillSettings["measurement"]>>) => void;
}) {
  function toggleMeasurement(label: string, unit: string) {
    const exists = settings.enabledMeasurements.some((m) => m.label === label && m.unit === unit);
    if (exists && settings.enabledMeasurements.length <= 1) return;
    const next = exists
      ? settings.enabledMeasurements.filter((m) => !(m.label === label && m.unit === unit))
      : [...settings.enabledMeasurements, { label, unit }];
    patch({ enabledMeasurements: next });
  }
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">측정 항목·단위</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_MEASUREMENTS.map((m) => {
            const active = settings.enabledMeasurements.some((x) => x.label === m.label && x.unit === m.unit);
            return (
              <ChipToggle
                key={`${m.label}-${m.unit}`}
                active={active}
                onClick={() => toggleMeasurement(m.label, m.unit)}
                emoji="📏"
                label={`${m.label} (${m.unit})`}
              />
            );
          })}
        </div>
      </div>
      <Field label="반복 측정 횟수">
        <select
          value={String(settings.repeatCount)}
          onChange={(e) => patch({ repeatCount: Math.min(5, Math.max(1, Number(e.target.value))) })}
          className={inputClass}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}회</option>
          ))}
        </select>
      </Field>
    </>
  );
}

// ── 예상 ──
function PredictionFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["prediction"]>;
  patch: (p: Partial<NonNullable<SkillSettings["prediction"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="예상 문장 템플릿" desc="'나는 ~ 라고 예상한다' 문장 틀을 제공합니다" />
      <ToggleSwitch on={settings.useReasoningPrompt} onChange={(v) => patch({ useReasoningPrompt: v })} label="예상의 근거 묻기" desc="'왜 그렇게 예상했나요?' 칸을 필수로 표시" />
    </>
  );
}

// ── 추리 ──
function InferenceFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["inference"]>;
  patch: (p: Partial<NonNullable<SkillSettings["inference"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="문장 템플릿" desc="'나는 ~ 때문에 ~ 라고 생각합니다' 구조 제공" />
      <ToggleSwitch on={settings.useCounterArgument} onChange={(v) => patch({ useCounterArgument: v })} label="반대 생각 카드" desc="자기 추리를 비판적으로 재검토" />
    </>
  );
}

// ── 의사소통 ──
function CommunicationFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["communication"]>;
  patch: (p: Partial<NonNullable<SkillSettings["communication"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.useThreeLineSummary} onChange={(v) => patch({ useThreeLineSummary: v })} label="3줄 요약 카드" desc="관찰·추리 결과를 3줄로 정리" />
      <ToggleSwitch on={settings.usePeerReview} onChange={(v) => patch({ usePeerReview: v })} label="동료 리뷰" desc="친구 글에 공감·토론 반응 남기기" />
      <ToggleSwitch on={settings.useAiSummary} onChange={(v) => patch({ useAiSummary: v })} label="AI 글 정리" desc="이전 단계 내용을 바탕으로 AI가 정리 글을 만들어 줌" />
    </>
  );
}

// ── 문제 인식 ──
function ProblemFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["problem"]>;
  patch: (p: Partial<NonNullable<SkillSettings["problem"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.useObservationLink} onChange={(v) => patch({ useObservationLink: v })} label="관찰 → 문제 변환 도움" desc="관찰한 내용을 문제 문장으로 바꾸는 가이드 제공" />
      <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="문제 문장 템플릿" desc="'왜 ~할까?' / '~인가?' 같은 틀 제공" />
    </>
  );
}

// ── 가설 설정 ──
function HypothesisFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["hypothesis"]>;
  patch: (p: Partial<NonNullable<SkillSettings["hypothesis"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="가설 문장 템플릿" desc="'만약 ~한다면 ~일 것이다' 틀 제공" />
      <ToggleSwitch on={settings.requireReasoning} onChange={(v) => patch({ requireReasoning: v })} label="가설의 근거 필수" desc="'왜 그렇게 생각하는지'를 함께 적게 합니다" />
    </>
  );
}

// ── 변인 통제 ──
function VariableControlFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["variable_control"]>;
  patch: (p: Partial<NonNullable<SkillSettings["variable_control"]>>) => void;
}) {
  function toggleCard(v: VariableCardType) {
    const next = settings.enabledVariableCards.includes(v)
      ? settings.enabledVariableCards.filter((x) => x !== v)
      : [...settings.enabledVariableCards, v];
    patch({ enabledVariableCards: next });
  }
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">제공할 변인 카드 후보</p>
        <div className="flex flex-wrap gap-2">
          {ALL_VARIABLES.map((v) => (
            <ChipToggle
              key={v}
              active={settings.enabledVariableCards.includes(v)}
              onClick={() => toggleCard(v)}
              emoji={VARIABLE_CARD_META[v].emoji}
              label={VARIABLE_CARD_META[v].label.replace("를 바꾼다면?", "")}
            />
          ))}
        </div>
      </div>
      <ToggleSwitch on={settings.useControlChecklist} onChange={(v) => patch({ useControlChecklist: v })} label="통제 변인 체크리스트" desc="조작 변인 외에 통제할 조건을 학생이 체크하도록 함" />
    </>
  );
}

// ── 자료 변환 ──
function DataTransformFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["data_transform"]>;
  patch: (p: Partial<NonNullable<SkillSettings["data_transform"]>>) => void;
}) {
  function toggleShape(s: DataTransformShape) {
    if (settings.enabledShapes.includes(s) && settings.enabledShapes.length <= 1) return;
    const next = settings.enabledShapes.includes(s)
      ? settings.enabledShapes.filter((x) => x !== s)
      : [...settings.enabledShapes, s];
    patch({ enabledShapes: next });
  }
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">허용할 표·그래프 형식</p>
        <div className="flex flex-wrap gap-2">
          {ALL_DATA_SHAPES.map((s) => (
            <ChipToggle
              key={s}
              active={settings.enabledShapes.includes(s)}
              onClick={() => toggleShape(s)}
              label={DATA_SHAPE_LABEL[s]}
            />
          ))}
        </div>
      </div>
      <ToggleSwitch on={settings.allowPhotoUpload} onChange={(v) => patch({ allowPhotoUpload: v })} label="사진·이미지 첨부 허용" desc="실험 결과 사진을 함께 올릴 수 있게 합니다" />
    </>
  );
}

// ── 자료 해석 ──
function DataInterpretFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["data_interpret"]>;
  patch: (p: Partial<NonNullable<SkillSettings["data_interpret"]>>) => void;
}) {
  const [draft, setDraft] = useState("");
  function addPattern() {
    const value = draft.trim();
    if (!value || settings.patternCards.includes(value)) return;
    patch({ patternCards: [...settings.patternCards, value] });
    setDraft("");
  }
  function removePattern(p: string) {
    patch({ patternCards: settings.patternCards.filter((x) => x !== p) });
  }
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">패턴 카드 (학생이 자료에서 찾는 규칙)</p>
        <div className="flex flex-wrap gap-2">
          {settings.patternCards.map((p) => (
            <span key={p} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
              {p}
              <button type="button" onClick={() => removePattern(p)} className="text-indigo-400 hover:text-indigo-700">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPattern(); } }}
            placeholder="예) 증가, 감소, 일정, 주기..."
            className={inputClass}
          />
          <button
            type="button"
            onClick={addPattern}
            className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200"
          >
            추가
          </button>
        </div>
      </div>
      <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="해석 문장 템플릿" desc="'~할수록 ~가 ~다' 같은 틀 제공" />
    </>
  );
}

// ── 결론 도출 ──
function ConclusionFields({
  settings,
  patch,
}: {
  settings: NonNullable<SkillSettings["conclusion"]>;
  patch: (p: Partial<NonNullable<SkillSettings["conclusion"]>>) => void;
}) {
  return (
    <>
      <ToggleSwitch on={settings.compareWithHypothesis} onChange={(v) => patch({ compareWithHypothesis: v })} label="가설과 비교 단계" desc="결론에서 가설이 맞았는지/달랐는지 짚어보기" />
      <ToggleSwitch on={settings.includeGeneralization} onChange={(v) => patch({ includeGeneralization: v })} label="일반화 문장 포함" desc="이 결론이 다른 상황에도 적용되는지 생각해 보기" />
      <ToggleSwitch on={settings.askFollowUp} onChange={(v) => patch({ askFollowUp: v })} label="후속 탐구 질문" desc="'더 알아보고 싶은 점'을 적게 합니다" />
    </>
  );
}
