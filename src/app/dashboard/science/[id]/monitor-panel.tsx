"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import QRCode from "qrcode";
import {
  getScienceRoomSessions,
  getScienceRoomReviews,
} from "@/app/actions/science-actions";
import {
  SENSE_META,
  REACTION_META,
  SKILL_META,
  type ScienceSession,
  type ScienceReview,
  type ScienceReaction,
  type InquiryTrack,
  type SkillKey,
  type SkillData,
} from "@/types/science";
import type { RoomStudent } from "@/types";

// ── helpers ─────────────────────────────────────────────────────────────────

function reactionCounts(
  sessionId: string,
  reviews: ScienceReview[],
): Record<ScienceReaction, number> {
  const all: ScienceReaction[] = ["agree", "differ", "discovery"];
  return Object.fromEntries(
    all.map((r) => [
      r,
      reviews.filter((rv) => rv.target_session_id === sessionId && rv.reaction === r).length,
    ]),
  ) as Record<ScienceReaction, number>;
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

function NewTrackBadge({ session, enabledSkills }: { session: ScienceSession; enabledSkills: SkillKey[] }) {
  if (session.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        ✅ 완료
      </span>
    );
  }
  const completedCount = session.completedSkills.length;
  const total = enabledSkills.length;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700">
      {completedCount} / {total} 단계 진행 중
    </span>
  );
}

function LegacyStepBadge({ step, status }: { step: number; status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        ✅ 완료
      </span>
    );
  }
  const labels: Record<number, string> = { 1: "1단계 관찰", 2: "2단계 추론", 3: "3단계 질문" };
  const colors: Record<number, string> = {
    1: "bg-sky-100 text-sky-700",
    2: "bg-violet-100 text-violet-700",
    3: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${colors[step] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[step] ?? `${step}단계`} 진행 중
    </span>
  );
}

function ScienceResultQrModal({
  session,
  onClose,
}: {
  session: ScienceSession;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const shareUrl = `${baseUrl}/share/science/${session.id}`;

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#0e7490", light: "#ffffff" },
    }).then(setQrUrl);
  }, [shareUrl]);

  function copyUrl() {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-7 flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-0.5">과학 탐구 결과 QR</p>
          <h3 className="text-lg font-bold text-gray-800">
            {session.student_number}번 {session.student_name}
          </h3>
        </div>
        {qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="과학 탐구 결과 QR" className="w-48 h-48 rounded-xl" />
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
        )}
        <p className="text-xs text-gray-400 text-center">
          이 QR을 스캔하면 학생의 과학 탐구 기록을 바로 볼 수 있어요
        </p>
        <button
          type="button"
          onClick={copyUrl}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          링크 복사
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-700 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── Skill data renderer ──────────────────────────────────────────────────────

function SkillSummary({ skill, data }: { skill: SkillKey; data: NonNullable<SkillData[SkillKey]> }) {
  const meta = SKILL_META[skill];
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wide">{meta.emoji} {meta.label}</p>
      <div className="text-sm text-gray-600 leading-relaxed">
        {renderSkillBody(skill, data)}
      </div>
    </div>
  );
}

function renderSkillBody(skill: SkillKey, data: NonNullable<SkillData[SkillKey]>) {
  switch (skill) {
    case "observation": {
      const d = data as NonNullable<SkillData["observation"]>;
      return (
        <>
          {d.beforeState && <p><span className="text-xs text-gray-400">전 </span>{d.beforeState}</p>}
          {d.afterState && <p><span className="text-xs text-gray-400">후 </span>{d.afterState}</p>}
          {d.senseTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {d.senseTags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                  {SENSE_META[tag.sense]?.emoji} {tag.text}
                </span>
              ))}
            </div>
          )}
        </>
      );
    }
    case "classification": {
      const d = data as NonNullable<SkillData["classification"]>;
      return (
        <div className="space-y-1.5">
          {d.groupings.map((g, i) => (
            <div key={i}>
              <p className="text-xs text-gray-400">기준: {g.basis}</p>
              {g.groups.map((gr, j) => gr.items.length > 0 && (
                <p key={j} className="text-xs"><span className="font-semibold">{gr.name || "(이름 없음)"}: </span>{gr.items.join(", ")}</p>
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "measurement": {
      const d = data as NonNullable<SkillData["measurement"]>;
      return (
        <div className="flex flex-wrap gap-1">
          {d.entries.map((e, i) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {e.label}: {e.values.filter(Boolean).join("/")} {e.unit}
            </span>
          ))}
        </div>
      );
    }
    case "prediction": {
      const d = data as NonNullable<SkillData["prediction"]>;
      return (
        <>
          <p>{d.prediction}</p>
          {d.reasoning && <p className="text-xs text-gray-400 italic">근거: {d.reasoning}</p>}
        </>
      );
    }
    case "inference": {
      const d = data as NonNullable<SkillData["inference"]>;
      return (
        <>
          <p>{d.inferenceText}</p>
          {d.counterText && <p className="text-xs text-gray-500 italic">반대 생각: {d.counterText}</p>}
        </>
      );
    }
    case "communication": {
      const d = data as NonNullable<SkillData["communication"]>;
      return <p className="whitespace-pre-line">{d.summary}</p>;
    }
    case "problem": return <p>{(data as NonNullable<SkillData["problem"]>).problemText}</p>;
    case "hypothesis": {
      const d = data as NonNullable<SkillData["hypothesis"]>;
      return (
        <>
          <p>{d.hypothesisText}</p>
          {d.reasoning && <p className="text-xs text-gray-400 italic">근거: {d.reasoning}</p>}
        </>
      );
    }
    case "variable_control": {
      const d = data as NonNullable<SkillData["variable_control"]>;
      return (
        <div className="space-y-1 text-xs">
          <p><span className="font-semibold text-amber-700">조작:</span> {d.manipulated}</p>
          {d.controlled.length > 0 && <p><span className="font-semibold text-emerald-700">통제:</span> {d.controlled.join(", ")}</p>}
          <p><span className="font-semibold text-indigo-700">종속:</span> {d.dependent}</p>
        </div>
      );
    }
    case "data_transform": {
      const d = data as NonNullable<SkillData["data_transform"]>;
      if (d.shape === "table") return <p className="text-xs">📋 표 {(d.tableRows ?? []).length}행</p>;
      return <p className="text-xs">{d.shape === "bar_chart" ? "📊" : "📈"} {(d.chartData ?? []).map((p) => `${p.label}:${p.value}`).join(", ")}</p>;
    }
    case "data_interpret": {
      const d = data as NonNullable<SkillData["data_interpret"]>;
      return (
        <>
          {d.patterns.length > 0 && <p className="text-xs"><span className="font-semibold">규칙:</span> {d.patterns.join(", ")}</p>}
          <p>{d.interpretation}</p>
        </>
      );
    }
    case "conclusion": {
      const d = data as NonNullable<SkillData["conclusion"]>;
      return (
        <>
          <p>{d.conclusionText}</p>
          {d.generalization && <p className="text-xs text-gray-500 italic">일반화: {d.generalization}</p>}
          {d.followUp && <p className="text-xs text-cyan-600">다음 탐구: {d.followUp}</p>}
        </>
      );
    }
  }
}

// ── SessionCard ──────────────────────────────────────────────────────────────

function NewTrackSessionCard({
  session,
  enabledSkills,
  counts,
}: {
  session: ScienceSession;
  enabledSkills: SkillKey[];
  counts: Record<ScienceReaction, number>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-800">{session.student_number}번</span>
          <span className="text-sm text-gray-500">{session.student_name}</span>
        </div>
        <NewTrackBadge session={session} enabledSkills={enabledSkills} />
      </div>
      <div className="p-5 space-y-3">
        {enabledSkills.map((skill) => {
          const data = session.skillData[skill];
          if (!data) return (
            <p key={skill} className="text-xs text-gray-300 italic">
              {SKILL_META[skill].emoji} {SKILL_META[skill].label} — 진행 전
            </p>
          );
          return <SkillSummary key={skill} skill={skill} data={data} />;
        })}
        {counts.agree + counts.differ + counts.discovery > 0 && (
          <div className="flex gap-2 pt-2 border-t border-gray-50">
            {(Object.entries(counts) as [ScienceReaction, number][]).map(([r, n]) =>
              n > 0 ? (
                <span key={r} className={`text-xs font-medium px-2.5 py-1 rounded-full ${REACTION_META[r].color}`}>
                  {REACTION_META[r].emoji} {n}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LegacySessionCard({
  session,
  counts,
}: {
  session: ScienceSession;
  counts: Record<ScienceReaction, number>;
}) {
  const reached2 = session.current_step >= 2 || session.status === "done";
  const reached3 = session.current_step >= 3 || session.status === "done";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-800">{session.student_number}번</span>
          <span className="text-sm text-gray-500">{session.student_name}</span>
        </div>
        <LegacyStepBadge step={session.current_step} status={session.status} />
      </div>
      <div className="p-5 space-y-3">
        {reached2 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide">🔍 관찰</p>
            {session.before_state && <p className="text-sm text-gray-600"><span className="text-xs text-gray-400">전 </span>{session.before_state}</p>}
            {session.after_state && <p className="text-sm text-gray-600"><span className="text-xs text-gray-400">후 </span>{session.after_state}</p>}
            {session.sense_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {session.sense_tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                    {SENSE_META[tag.sense]?.emoji} {tag.text}
                  </span>
                ))}
              </div>
            )}
            {session.measurements.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {session.measurements.map((m, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {m.label}: {m.value} {m.unit}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">관찰 작성 중...</p>
        )}
        {reached3 && session.inference_text && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">💡 추론</p>
            <p className="text-sm text-gray-600">{session.inference_text}</p>
            {session.counter_text && <p className="text-sm text-gray-500 italic">반대 생각: {session.counter_text}</p>}
          </div>
        )}
        {session.status === "done" && session.question_text && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">❓ 질문</p>
            <p className="text-sm text-gray-600">{session.question_text}</p>
          </div>
        )}
        {counts.agree + counts.differ + counts.discovery > 0 && (
          <div className="flex gap-2 pt-2 border-t border-gray-50">
            {(Object.entries(counts) as [ScienceReaction, number][]).map(([r, n]) =>
              n > 0 ? (
                <span key={r} className={`text-xs font-medium px-2.5 py-1 rounded-full ${REACTION_META[r].color}`}>
                  {REACTION_META[r].emoji} {n}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScienceMonitorPanel ──────────────────────────────────────────────────────

interface Props {
  roomId: string;
  isActive: boolean;
  inquiryTrack: InquiryTrack | null;
  enabledSkills: SkillKey[];
  students: RoomStudent[];
  initialSessions: ScienceSession[];
  initialReviews: ScienceReview[];
}

export default function ScienceMonitorPanel({
  roomId,
  isActive,
  inquiryTrack,
  enabledSkills,
  students,
  initialSessions,
  initialReviews,
}: Props) {
  const [sessions, setSessions] = useState<ScienceSession[]>(initialSessions);
  const [reviews, setReviews] = useState<ScienceReview[]>(initialReviews);
  const [qrTarget, setQrTarget] = useState<ScienceSession | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isNewTrack = Boolean(inquiryTrack && enabledSkills.length > 0);
  const doneSessions = sessions.filter((session) => session.status === "done");
  const activeSessions = sessions.filter((session) => session.status === "in_progress");
  const connectedNumbers = new Set(sessions.map((session) => session.student_number));
  const notConnected = students.filter((student) => !connectedNumbers.has(student.student_number));
  const totalTargets = students.length || sessions.length;

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const run = async () => {
      const [newSessions, newReviews] = await Promise.all([
        getScienceRoomSessions(roomId),
        getScienceRoomReviews(roomId),
      ]);
      if (cancelled) return;
      startTransition(() => {
        setSessions(newSessions);
        setReviews(newReviews);
        setLastUpdated(new Date());
      });
    };
    const interval = setInterval(() => void run(), 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId, isActive]);

  if (sessions.length === 0 && students.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-white/70 p-10 text-center">
        <p className="text-4xl mb-3">🧑‍🔬</p>
        <p className="text-gray-500 text-sm">아직 표시할 학생 명단이나 참여 기록이 없습니다.</p>
        {isActive && (
          <p className="text-xs text-gray-400 mt-1">학생이 접속하면 자동으로 업데이트됩니다.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {qrTarget && (
        <ScienceResultQrModal
          session={qrTarget}
          onClose={() => setQrTarget(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-700">
          학생 활동 현황
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({sessions.length}/{totalTargets}명 참여)
          </span>
        </h2>
        {isActive && lastUpdated && (
          <p className="text-xs text-gray-400">마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")}</p>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-white/70 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-gray-700">참여 대상 및 실시간 현황</p>
            <p className="text-xs text-gray-400 mt-1">학급 명단을 기준으로 미접속, 활동 중, 완료 학생을 구분합니다.</p>
          </div>
          <div className="flex gap-2 text-xs font-semibold flex-wrap">
            <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">활동 중 {activeSessions.length}명</span>
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">완료 {doneSessions.length}명</span>
            <span className="bg-gray-50 text-gray-500 px-3 py-1.5 rounded-full">대상 {totalTargets}명</span>
            {isActive && (
              <span className="flex items-center gap-1 text-gray-400 px-2 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                실시간
              </span>
            )}
          </div>
        </div>

        {activeSessions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-blue-600 mb-2">✏️ 지금 활동 중</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {activeSessions.map((session) => (
                <div key={session.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-blue-300 font-mono w-5 shrink-0">{session.student_number}</span>
                  <span className="text-sm font-medium text-blue-800 truncate">{session.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {doneSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-emerald-600">✅ 탐구 기록 완료</p>
              <p className="text-xs text-gray-400">QR 버튼 → 학생 개인 결과 QR</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {doneSessions.map((session) => (
                <div key={session.id} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-emerald-300 font-mono w-5 shrink-0">{session.student_number}</span>
                  <span className="text-sm font-medium text-emerald-800 truncate flex-1">{session.student_name}</span>
                  <button
                    type="button"
                    onClick={() => setQrTarget(session)}
                    className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded-lg font-medium transition-colors shrink-0"
                    title="개인 결과 QR 보기"
                  >
                    QR
                  </button>
                  <Link
                    href={`/share/science/${session.id}`}
                    className="text-xs text-emerald-600 hover:text-emerald-800 shrink-0"
                    target="_blank"
                  >
                    보기 →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {notConnected.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-2">⬜ 미접속 ({notConnected.length}명)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
              {notConnected.map((student) => (
                <div key={student.id} className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-300 font-mono w-4 shrink-0">{student.student_number}</span>
                  <span className="text-sm text-gray-500 truncate">{student.student_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && students.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-2 animate-pulse">
            학생이 QR 코드로 접속하면 활동 중 목록에 표시됩니다.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions
          .slice()
          .sort((a, b) => a.student_number - b.student_number)
          .map((s) =>
            isNewTrack ? (
              <NewTrackSessionCard
                key={s.id}
                session={s}
                enabledSkills={enabledSkills}
                counts={reactionCounts(s.id, reviews)}
              />
            ) : (
              <LegacySessionCard
                key={s.id}
                session={s}
                counts={reactionCounts(s.id, reviews)}
              />
            ),
          )}
      </div>
    </div>
  );
}
