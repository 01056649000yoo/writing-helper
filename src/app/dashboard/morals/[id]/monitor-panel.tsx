"use client";

import { useEffect, useState, startTransition } from "react";
import { getMoralsRoomSessions, getMoralsRoomReactions } from "@/app/actions/morals-actions";
import {
  MORALS_SKILL_META,
  MORALS_REACTION_META,
  type MoralsSession,
  type MoralsReactionRow,
  type MoralsReaction,
  type MoralsSkillKey,
  type MoralsSkillData,
} from "@/types/morals";

function reactionCounts(sessionId: string, reactions: MoralsReactionRow[]): Record<MoralsReaction, number> {
  const all: MoralsReaction[] = ["empathy", "reflect", "respect"];
  return Object.fromEntries(
    all.map((r) => [r, reactions.filter((rv) => rv.target_session_id === sessionId && rv.reaction === r).length]),
  ) as Record<MoralsReaction, number>;
}

function StatusBadge({ session, total }: { session: MoralsSession; total: number }) {
  if (session.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        ✅ 완료
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
      {session.completedSkills.length} / {total} 단계
    </span>
  );
}

function SkillBody({ skill, data }: { skill: MoralsSkillKey; data: NonNullable<MoralsSkillData[MoralsSkillKey]> }) {
  switch (skill) {
    case "situation": {
      const d = data as NonNullable<MoralsSkillData["situation"]>;
      return (
        <>
          {(d.when || d.where || d.who) && (
            <p className="text-xs text-gray-400">{[d.when, d.where, d.who].filter(Boolean).join(" · ")}</p>
          )}
          {d.summary && <p>{d.summary}</p>}
        </>
      );
    }
    case "emotion": {
      const d = data as NonNullable<MoralsSkillData["emotion"]>;
      return (
        <>
          <div className="flex flex-wrap gap-1">
            {d.selected.map((s) => (
              <span key={s.label} className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
                {s.label}{s.intensity ? ` (${s.intensity})` : ""}
              </span>
            ))}
          </div>
          {d.note && <p className="mt-1">{d.note}</p>}
        </>
      );
    }
    case "value_find": {
      const d = data as NonNullable<MoralsSkillData["value_find"]>;
      return (
        <>
          <div className="flex flex-wrap gap-1">
            {d.values.map((v) => (
              <span key={v} className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">{v}</span>
            ))}
          </div>
          {d.reason && <p className="mt-1 text-gray-500 italic">{d.reason}</p>}
        </>
      );
    }
    case "perspective": {
      const d = data as NonNullable<MoralsSkillData["perspective"]>;
      return (
        <div className="space-y-1">
          {d.parties.map((p, i) => (
            <p key={i}><span className="font-semibold">{p.role}:</span> {p.thought}{p.feeling ? ` (${p.feeling})` : ""}</p>
          ))}
        </div>
      );
    }
    case "resolution": return <p>{(data as NonNullable<MoralsSkillData["resolution"]>).resolution}</p>;
    case "dilemma": {
      const d = data as NonNullable<MoralsSkillData["dilemma"]>;
      return (
        <>
          <p><span className="font-semibold text-rose-600">{d.valueA}</span> ↔ <span className="font-semibold text-rose-600">{d.valueB}</span></p>
          {d.context && <p className="text-gray-500 mt-1">{d.context}</p>}
        </>
      );
    }
    case "stakeholders": {
      const d = data as NonNullable<MoralsSkillData["stakeholders"]>;
      return (
        <div className="space-y-1">
          {d.parties.map((p, i) => (
            <p key={i}><span className="font-semibold">{p.role}:</span> {p.feeling}{p.need ? ` (원하는 것: ${p.need})` : ""}</p>
          ))}
        </div>
      );
    }
    case "principle": {
      const d = data as NonNullable<MoralsSkillData["principle"]>;
      return (
        <div className="space-y-1">
          {d.appliedPrinciples.map((p, i) => (
            <p key={i}><span className="font-semibold">{p.label}:</span> {p.application}</p>
          ))}
        </div>
      );
    }
    case "consequence": {
      const d = data as NonNullable<MoralsSkillData["consequence"]>;
      return (
        <div className="space-y-1">
          {d.shortTerm && <p><span className="text-xs text-gray-400">단기:</span> {d.shortTerm}</p>}
          {d.longTerm && <p><span className="text-xs text-gray-400">장기:</span> {d.longTerm}</p>}
        </div>
      );
    }
    case "action_plan": {
      const d = data as NonNullable<MoralsSkillData["action_plan"]>;
      return (
        <div className="space-y-1">
          {d.actions.map((a, i) => (
            <p key={i} className="text-xs">• {[a.when, a.what, a.how].filter(Boolean).join(" · ")}</p>
          ))}
        </div>
      );
    }
    case "self_review": {
      const d = data as NonNullable<MoralsSkillData["self_review"]>;
      return (
        <div className="space-y-1">
          {d.progress && <p>{d.progress}</p>}
          {d.adjustment && <p className="text-gray-500 italic">보완: {d.adjustment}</p>}
        </div>
      );
    }
  }
}

function SessionCard({
  session, enabledSkills, counts,
}: {
  session: MoralsSession;
  enabledSkills: MoralsSkillKey[];
  counts: Record<MoralsReaction, number>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-800">{session.student_number}번</span>
          <span className="text-sm text-gray-500">{session.student_name}</span>
        </div>
        <StatusBadge session={session} total={enabledSkills.length} />
      </div>
      <div className="p-5 space-y-3">
        {enabledSkills.map((skill) => {
          const data = session.skillData[skill];
          if (!data) return (
            <p key={skill} className="text-xs text-gray-300 italic">{MORALS_SKILL_META[skill].emoji} {MORALS_SKILL_META[skill].label} — 진행 전</p>
          );
          return (
            <div key={skill} className="space-y-1">
              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">{MORALS_SKILL_META[skill].emoji} {MORALS_SKILL_META[skill].label}</p>
              <div className="text-sm text-gray-600 leading-relaxed">
                <SkillBody skill={skill} data={data} />
              </div>
            </div>
          );
        })}
        {counts.empathy + counts.reflect + counts.respect > 0 && (
          <div className="flex gap-2 pt-2 border-t border-gray-50">
            {(Object.entries(counts) as [MoralsReaction, number][]).map(([r, n]) =>
              n > 0 ? (
                <span key={r} className={`text-xs font-medium px-2.5 py-1 rounded-full ${MORALS_REACTION_META[r].color}`}>
                  {MORALS_REACTION_META[r].emoji} {n}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MoralsMonitorPanel({
  roomId, isActive, enabledSkills, initialSessions, initialReactions,
}: {
  roomId: string;
  isActive: boolean;
  enabledSkills: MoralsSkillKey[];
  initialSessions: MoralsSession[];
  initialReactions: MoralsReactionRow[];
}) {
  const [sessions, setSessions] = useState<MoralsSession[]>(initialSessions);
  const [reactions, setReactions] = useState<MoralsReactionRow[]>(initialReactions);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const run = async () => {
      const [s, r] = await Promise.all([getMoralsRoomSessions(roomId), getMoralsRoomReactions(roomId)]);
      if (cancelled) return;
      startTransition(() => { setSessions(s); setReactions(r); setLastUpdated(new Date()); });
    };
    const interval = setInterval(() => void run(), 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [roomId, isActive]);

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-white/70 p-10 text-center">
        <p className="text-4xl mb-3">💭</p>
        <p className="text-gray-500 text-sm">아직 참여한 학생이 없습니다.</p>
        {isActive && <p className="text-xs text-gray-400 mt-1">학생이 접속하면 자동으로 업데이트됩니다.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-700">학생 활동 현황<span className="ml-2 text-sm font-normal text-gray-400">({sessions.length}명)</span></h2>
        {isActive && lastUpdated && (
          <p className="text-xs text-gray-400">마지막 갱신: {lastUpdated.toLocaleTimeString("ko-KR")}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.slice().sort((a, b) => a.student_number - b.student_number).map((s) => (
          <SessionCard key={s.id} session={s} enabledSkills={enabledSkills} counts={reactionCounts(s.id, reactions)} />
        ))}
      </div>
    </div>
  );
}
