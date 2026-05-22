"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createMoralsRoom } from "@/app/actions/morals-actions";
import {
  MORALS_TRACK_META,
  MORALS_SKILL_META,
  DEFAULT_MORALS_SKILL_SETTINGS,
  VALUE_CARDS,
  PRINCIPLE_CARDS,
  type MoralsTrack,
  type MoralsSkillKey,
  type MoralsSkillSettings,
} from "@/types/morals";
import { useActivityDraft } from "@/lib/use-activity-draft";
import { buildDraftStorageKey, clearActivityDraft, MORALS_DRAFT_SLUG, persistActivityDraft } from "@/lib/activity-drafts";

type MoralsDraft = {
  title: string;
  topic: string;
  instructions: string;
  duration_hours: string;
  track: MoralsTrack | null;
  enabled_skills: MoralsSkillKey[];
  skill_settings: MoralsSkillSettings;
};

const INITIAL_DRAFT: MoralsDraft = {
  title: "",
  topic: "",
  instructions: "",
  duration_hours: "2",
  track: null,
  enabled_skills: [],
  skill_settings: {},
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white transition";

function ToggleSwitch({ on, onChange, label, desc }: { on: boolean; onChange: (n: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div>
        <p className="text-sm font-semibold text-gray-700 group-hover:text-rose-600 transition-colors">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div onClick={() => onChange(!on)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-rose-500" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </div>
    </label>
  );
}

function ChipToggle({ active, onClick, label, emoji }: { active: boolean; onClick: () => void; label: string; emoji?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
        active ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
      }`}>
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}

function SettingsPanel({ title, emoji, children, badge }: { title: string; emoji: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h3>
        {badge && (
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
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

export default function NewMoralsRoomPageWrapper() {
  return <Suspense><NewMoralsRoomPage /></Suspense>;
}

function NewMoralsRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("class_id") ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const storageKey = useMemo(() => buildDraftStorageKey(classId, MORALS_DRAFT_SLUG), [classId]);
  const [draft, setDraft, draftControls] = useActivityDraft<MoralsDraft>(storageKey, INITIAL_DRAFT);

  const { title, topic, instructions, duration_hours: durationHours, track, enabled_skills: enabledSkills, skill_settings: skillSettings } = draft;
  const trackSkills: MoralsSkillKey[] = track ? [...MORALS_TRACK_META[track].skills] : [];
  const enabledSet = useMemo(() => new Set(enabledSkills), [enabledSkills]);

  if (!classId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-lg p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-700 font-semibold">학급을 선택한 뒤 활동을 만들어야 합니다.</p>
          <Link href="/dashboard" className="inline-block mt-5 text-rose-600 hover:underline text-sm">← 대시보드로</Link>
        </div>
      </div>
    );
  }

  function selectTrack(next: MoralsTrack) {
    setDraft((prev) => ({ ...prev, track: next, enabled_skills: [], skill_settings: {} }));
  }

  function toggleSkill(skill: MoralsSkillKey) {
    setDraft((prev) => {
      const has = prev.enabled_skills.includes(skill);
      const nextSkills = has ? prev.enabled_skills.filter((s) => s !== skill) : [...prev.enabled_skills, skill];
      const nextSettings = { ...prev.skill_settings };
      if (has) delete nextSettings[skill];
      else nextSettings[skill] = DEFAULT_MORALS_SKILL_SETTINGS[skill] as never;
      return { ...prev, enabled_skills: nextSkills, skill_settings: nextSettings };
    });
  }

  function patchSetting<K extends MoralsSkillKey>(skill: K, patch: Partial<NonNullable<MoralsSkillSettings[K]>>) {
    setDraft((prev) => {
      const current = (prev.skill_settings[skill] ?? DEFAULT_MORALS_SKILL_SETTINGS[skill]) as NonNullable<MoralsSkillSettings[K]>;
      return { ...prev, skill_settings: { ...prev.skill_settings, [skill]: { ...current, ...patch } } };
    });
  }

  function updateField<K extends keyof MoralsDraft>(field: K, value: MoralsDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSaveDraftNow() {
    persistActivityDraft(storageKey, draft);
    setLastSavedAt(Date.now());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!track) { setError("트랙을 먼저 선택해주세요."); return; }
    if (enabledSkills.length === 0) { setError("도덕 활동을 1개 이상 선택해주세요."); return; }
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("class_id", classId);
    fd.set("title", title);
    fd.set("topic", topic);
    fd.set("instructions", instructions);
    fd.set("duration_hours", durationHours);
    fd.set("track", track);
    trackSkills.filter((s) => enabledSet.has(s)).forEach((s) => fd.append("enabled_skills", s));
    fd.set("skill_settings_json", JSON.stringify(skillSettings));

    draftControls.suspendAutosave();
    clearActivityDraft(storageKey);

    const result = await createMoralsRoom(fd);
    if ("error" in result) {
      persistActivityDraft(storageKey, draft);
      draftControls.resumeAutosave();
      setError(result.error ?? "오류가 발생했습니다.");
      setPending(false);
    } else {
      router.push(`/dashboard/morals/${result.roomId}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-6">
      <div className="max-w-2xl mx-auto pt-8 pb-16">
        <Link href={`/dashboard/class/${classId}`} className="text-rose-600 text-sm hover:underline">← 학급으로</Link>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🪞</span>
              <div>
                <p className="text-xs font-semibold text-rose-600">교과 연계 글쓰기 활동</p>
                <h1 className="text-2xl font-bold text-gray-800">도덕 가치 글쓰기</h1>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">감정·가치·실천을 단계별로 풀어내는 도덕과 글쓰기 활동입니다.</p>
          </div>

          <div className="bg-white/80 rounded-2xl border border-rose-100 px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-rose-700">📝 자동 초안 저장</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {lastSavedAt
                  ? `마지막 저장: ${new Date(lastSavedAt).toLocaleTimeString("ko-KR")}`
                  : "5초마다 이 브라우저에 자동 저장돼요. 나갔다 돌아와도 이어서 만들 수 있어요."}
              </p>
            </div>
            <button type="button" onClick={handleSaveDraftNow}
              className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg whitespace-nowrap">
              지금 저장
            </button>
          </div>

          {/* Step 1. 트랙 선택 */}
          <TrackSelector track={track} onSelect={selectTrack} />

          {/* Step 2. 기본 정보 */}
          {track && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">📌 기본 정보</h2>
              <Field label="활동 제목">
                <input required value={title} onChange={(e) => updateField("title", e.target.value)}
                  placeholder={track === "reflection" ? "예) 친구와 다툰 어제" : "예) 단체활동에서 약속을 어긴 친구"}
                  className={inputClass} />
              </Field>
              <Field label="활동 주제">
                <input required value={topic} onChange={(e) => updateField("topic", e.target.value)}
                  placeholder={track === "reflection" ? "예) 친구와 사소한 일로 다툰 뒤의 내 마음" : "예) 단체활동 중 약속을 어긴 친구를 어떻게 대해야 할까?"}
                  className={inputClass} />
              </Field>
              <Field label="학생 안내문" optional>
                <textarea rows={3} value={instructions} onChange={(e) => updateField("instructions", e.target.value)}
                  placeholder="활동 시 학생들에게 보여줄 안내문을 적어주세요." className={`${inputClass} resize-none`} />
              </Field>
              <Field label="활동 시간">
                <select value={durationHours} onChange={(e) => updateField("duration_hours", e.target.value)} className={inputClass}>
                  <option value="1">1시간</option>
                  <option value="2">2시간</option>
                  <option value="4">4시간</option>
                  <option value="8">당일 (8시간)</option>
                  <option value="24">1일 (24시간)</option>
                  <option value="168">1주일 (사후 성찰용)</option>
                </select>
              </Field>
            </div>
          )}

          {/* Step 3. 활동 선택 */}
          {track && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">🧩 이번 수업에서 다룰 도덕 활동</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {MORALS_TRACK_META[track].label}의 {MORALS_TRACK_META[track].skills.length}개 활동 중 다룰 것만 골라주세요. 선택한 순서대로 학생 화면에 단계가 표시됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trackSkills.map((skill, idx) => {
                  const meta = MORALS_SKILL_META[skill];
                  const active = enabledSet.has(skill);
                  const orderIdx = trackSkills.filter((s) => enabledSet.has(s)).indexOf(skill);
                  return (
                    <button type="button" key={skill} onClick={() => toggleSkill(skill)}
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                        active ? "bg-rose-50 border-rose-300" : "bg-white border-gray-200 hover:border-rose-200"
                      }`}>
                      <span className="text-2xl shrink-0">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${active ? "text-rose-700" : "text-gray-700"}`}>{idx + 1}. {meta.label}</p>
                        <p className={`text-xs mt-1 leading-snug ${active ? "text-rose-600/70" : "text-gray-400"}`}>{meta.description}</p>
                      </div>
                      {active && (
                        <span className="text-xs font-bold bg-rose-500 text-white px-2 py-1 rounded-lg shrink-0">{orderIdx + 1}단계</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4. 세부 설정 */}
          {track && enabledSkills.length > 0 && (
            <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">⚙️ 활동별 세부 설정</h2>
                <p className="text-xs text-gray-400 mt-1">선택한 활동마다 필요한 옵션만 조정하세요.</p>
              </div>
              <div className="space-y-4">
                {trackSkills.filter((s) => enabledSet.has(s)).map((skill, idx) => (
                  <SkillSettingsBlock key={skill} skill={skill} orderLabel={`${idx + 1}단계`}
                    settings={skillSettings[skill] ?? DEFAULT_MORALS_SKILL_SETTINGS[skill]}
                    patch={(p) => patchSetting(skill, p)} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex items-center gap-2">⚠️ {error}</div>
          )}

          <button type="submit" disabled={pending || !track || enabledSkills.length === 0}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl shadow-lg transition-all">
            {pending ? "활동 만드는 중..." : "활동 시작하기 →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TrackSelector({ track, onSelect }: { track: MoralsTrack | null; onSelect: (t: MoralsTrack) => void }) {
  const tracks: MoralsTrack[] = ["reflection", "judgement"];
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">🎯 어떤 도덕 활동을 할까요?</h2>
        <p className="text-xs text-gray-400 mt-1">학년에 맞는 트랙을 고르면 그 트랙의 활동들이 펼쳐집니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tracks.map((t) => {
          const meta = MORALS_TRACK_META[t];
          const active = track === t;
          return (
            <button type="button" key={t} onClick={() => onSelect(t)}
              className={`text-left rounded-2xl border-2 p-5 transition-all ${
                active ? "border-rose-400 bg-rose-50 shadow-md" : "border-gray-200 bg-white hover:border-rose-200"
              }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{meta.emoji}</span>
                <div>
                  <p className={`text-sm font-bold ${active ? "text-rose-700" : "text-gray-700"}`}>{meta.label}</p>
                  <p className="text-xs text-gray-400">{meta.gradeBand}</p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${active ? "text-rose-700/80" : "text-gray-500"}`}>{meta.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {meta.skills.map((s) => (
                  <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full ${active ? "bg-white text-rose-700" : "bg-gray-50 text-gray-500"}`}>
                    {MORALS_SKILL_META[s].emoji} {MORALS_SKILL_META[s].label}
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

// ── 스킬별 세부 설정 분기 ──
function SkillSettingsBlock({
  skill, orderLabel, settings, patch,
}: {
  skill: MoralsSkillKey;
  orderLabel: string;
  settings: NonNullable<MoralsSkillSettings[MoralsSkillKey]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: (patch: any) => void;
}) {
  const meta = MORALS_SKILL_META[skill];
  switch (skill) {
    case "situation": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <SituationFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "emotion": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <EmotionFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "value_find": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <ValueFindFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "perspective": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <PerspectiveFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "resolution": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <ResolutionFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "dilemma": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <DilemmaFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "stakeholders": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <StakeholdersFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "principle": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <PrincipleFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "consequence": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <ConsequenceFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "action_plan": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <ActionPlanFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
    case "self_review": return (
      <SettingsPanel title={meta.label} emoji={meta.emoji} badge={orderLabel}>
        <SelfReviewFields settings={settings as never} patch={patch} />
      </SettingsPanel>
    );
  }
}

function SituationFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["situation"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["situation"]>>) => void }) {
  return (<>
    <ToggleSwitch on={settings.promptWhen} onChange={(v) => patch({ promptWhen: v })} label="언제 (시간) 묻기" />
    <ToggleSwitch on={settings.promptWhere} onChange={(v) => patch({ promptWhere: v })} label="어디서 (장소) 묻기" />
    <ToggleSwitch on={settings.promptWho} onChange={(v) => patch({ promptWho: v })} label="누구와 (등장인물) 묻기" />
    <ToggleSwitch on={settings.useDrawing} onChange={(v) => patch({ useDrawing: v })} label="그림 그리기" desc="상황을 그림으로 표현" />
  </>);
}

function EmotionFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["emotion"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["emotion"]>>) => void }) {
  const toneLabels: Record<typeof settings.enabledTones[number], string> = {
    joy: "😊 기쁨 계열", anger: "😠 화 계열", sad: "😢 슬픔 계열", fear: "😨 두려움 계열", mixed: "🌀 복합 감정",
  };
  function toggle(t: typeof settings.enabledTones[number]) {
    const has = settings.enabledTones.includes(t);
    patch({ enabledTones: has ? settings.enabledTones.filter((x) => x !== t) : [...settings.enabledTones, t] });
  }
  return (<>
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">활성화할 감정 분류</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(toneLabels) as Array<typeof settings.enabledTones[number]>).map((t) => (
          <ChipToggle key={t} active={settings.enabledTones.includes(t)} onClick={() => toggle(t)} label={toneLabels[t]} />
        ))}
      </div>
    </div>
    <ToggleSwitch on={settings.allowMultiple} onChange={(v) => patch({ allowMultiple: v })} label="여러 감정 동시 선택 허용" />
    <ToggleSwitch on={settings.promptIntensity} onChange={(v) => patch({ promptIntensity: v })} label="감정 강도(1~5) 묻기" desc="고학년 권장" />
  </>);
}

function ValueFindFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["value_find"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["value_find"]>>) => void }) {
  const areaLabels: Record<typeof settings.enabledAreas[number], string> = {
    self: "🌱 자신과의 관계", others: "🤝 타인과의 관계", society: "👫 사회·공동체", nature: "🌿 자연·세계",
  };
  function toggle(a: typeof settings.enabledAreas[number]) {
    const has = settings.enabledAreas.includes(a);
    patch({ enabledAreas: has ? settings.enabledAreas.filter((x) => x !== a) : [...settings.enabledAreas, a] });
  }
  return (<>
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">활성화할 가치 영역</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(areaLabels) as Array<typeof settings.enabledAreas[number]>).map((a) => (
          <ChipToggle key={a} active={settings.enabledAreas.includes(a)} onClick={() => toggle(a)} label={areaLabels[a]} />
        ))}
      </div>
      <p className="text-[11px] text-gray-400">선택한 영역의 카드만 학생에게 보입니다. (전체 {VALUE_CARDS.length}개 가치)</p>
    </div>
    <ToggleSwitch on={settings.requireReason} onChange={(v) => patch({ requireReason: v })} label="왜 그 가치인지 적기" desc="가치 선택 + 이유 필수" />
  </>);
}

function PerspectiveFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["perspective"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["perspective"]>>) => void }) {
  return (<>
    <Field label="입장 바꿔 볼 인원 수">
      <select value={String(settings.partyCount)} onChange={(e) => patch({ partyCount: Math.min(3, Math.max(1, Number(e.target.value))) })} className={inputClass}>
        {[1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}
      </select>
    </Field>
    <ToggleSwitch on={settings.promptFeeling} onChange={(v) => patch({ promptFeeling: v })} label="상대 감정 묻기" />
  </>);
}

function ResolutionFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["resolution"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["resolution"]>>) => void }) {
  return (<>
    <ToggleSwitch on={settings.useTemplate} onChange={(v) => patch({ useTemplate: v })} label="다짐 문장 템플릿" desc="'다음에 ~한 상황이 오면 ~ 하겠다'" />
    <ToggleSwitch on={settings.askPracticePartner} onChange={(v) => patch({ askPracticePartner: v })} label="실천 도우미 묻기" desc="같이 실천할 친구 / 도움 요청 대상" />
  </>);
}

function DilemmaFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["dilemma"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["dilemma"]>>) => void }) {
  return (<>
    <ToggleSwitch on={settings.useTwoValueTemplate} onChange={(v) => patch({ useTwoValueTemplate: v })} label="A vs B 가치 갈등 형식" desc="두 가치 카드를 골라 부딪침을 명확히" />
    <ToggleSwitch on={settings.promptContext} onChange={(v) => patch({ promptContext: v })} label="왜 갈등 상황인지 적기" />
  </>);
}

function StakeholdersFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["stakeholders"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["stakeholders"]>>) => void }) {
  return (<>
    <Field label="분석할 사람 수">
      <select value={String(settings.partyCount)} onChange={(e) => patch({ partyCount: Math.min(4, Math.max(2, Number(e.target.value))) })} className={inputClass}>
        {[2, 3, 4].map((n) => <option key={n} value={n}>{n}명</option>)}
      </select>
    </Field>
    <ToggleSwitch on={settings.requireFeeling} onChange={(v) => patch({ requireFeeling: v })} label="각자의 감정 묻기" />
    <ToggleSwitch on={settings.requireNeed} onChange={(v) => patch({ requireNeed: v })} label="각자가 원하는 것 묻기" />
  </>);
}

function PrincipleFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["principle"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["principle"]>>) => void }) {
  function toggle(label: string) {
    const has = settings.enabledPrinciples.includes(label);
    patch({ enabledPrinciples: has ? settings.enabledPrinciples.filter((x) => x !== label) : [...settings.enabledPrinciples, label] });
  }
  return (<>
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500">제공할 도덕 원칙 카드</p>
      <div className="flex flex-wrap gap-2">
        {PRINCIPLE_CARDS.map((p) => (
          <ChipToggle key={p.label} active={settings.enabledPrinciples.includes(p.label)} onClick={() => toggle(p.label)} label={p.label} />
        ))}
      </div>
    </div>
    <ToggleSwitch on={settings.requireApplication} onChange={(v) => patch({ requireApplication: v })} label="이 상황에 어떻게 적용했는지 적기" />
  </>);
}

function ConsequenceFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["consequence"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["consequence"]>>) => void }) {
  return (<>
    <ToggleSwitch on={settings.splitShortLong} onChange={(v) => patch({ splitShortLong: v })} label="단기·장기 결과 분리" />
    <ToggleSwitch on={settings.considerOthers} onChange={(v) => patch({ considerOthers: v })} label="나·상대·공동체 영향 분리" />
  </>);
}

function ActionPlanFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["action_plan"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["action_plan"]>>) => void }) {
  return (<>
    <ToggleSwitch on={settings.useChecklistFormat} onChange={(v) => patch({ useChecklistFormat: v })} label="점검표 형식 (언제·무엇·어떻게)" />
    <ToggleSwitch on={settings.askObstacles} onChange={(v) => patch({ askObstacles: v })} label="방해 요인·극복 방법 묻기" />
  </>);
}

function SelfReviewFields({ settings, patch }: { settings: NonNullable<MoralsSkillSettings["self_review"]>; patch: (p: Partial<NonNullable<MoralsSkillSettings["self_review"]>>) => void }) {
  return (<>
    <Field label="며칠 뒤 돌아볼지 (학생 안내용)">
      <select value={String(settings.followUpDays)} onChange={(e) => patch({ followUpDays: Math.min(30, Math.max(1, Number(e.target.value))) })} className={inputClass}>
        {[1, 3, 5, 7, 14, 30].map((n) => <option key={n} value={n}>{n}일 뒤</option>)}
      </select>
    </Field>
    <ToggleSwitch on={settings.askProgress} onChange={(v) => patch({ askProgress: v })} label="실천 진행 상황 묻기" />
    <ToggleSwitch on={settings.askAdjustment} onChange={(v) => patch({ askAdjustment: v })} label="보완할 점 묻기" />
  </>);
}

