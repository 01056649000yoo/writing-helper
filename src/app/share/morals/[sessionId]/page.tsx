import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  MORALS_SKILL_META,
  MORALS_TRACK_META,
  type MoralsTrack,
  type MoralsSkillData,
  type MoralsSkillKey,
} from "@/types/morals";

function isSkillKey(value: string): value is MoralsSkillKey {
  return value in MORALS_SKILL_META;
}

function isTrack(value: string | null): value is MoralsTrack {
  return value === "reflection" || value === "judgement";
}

function renderSkillBody(skill: MoralsSkillKey, data: NonNullable<MoralsSkillData[MoralsSkillKey]>) {
  switch (skill) {
    case "situation": {
      const d = data as NonNullable<MoralsSkillData["situation"]>;
      return (
        <div className="space-y-2">
          {(d.when || d.where || d.who) && (
            <p className="text-xs text-gray-400">{[d.when, d.where, d.who].filter(Boolean).join(" · ")}</p>
          )}
          {d.summary && <p>{d.summary}</p>}
        </div>
      );
    }
    case "emotion": {
      const d = data as NonNullable<MoralsSkillData["emotion"]>;
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {d.selected.map((s) => (
              <span key={s.label} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                {s.label}{s.intensity ? ` (${s.intensity})` : ""}
              </span>
            ))}
          </div>
          {d.note && <p>{d.note}</p>}
        </div>
      );
    }
    case "value_find": {
      const d = data as NonNullable<MoralsSkillData["value_find"]>;
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {d.values.map((v) => (
              <span key={v} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{v}</span>
            ))}
          </div>
          {d.reason && <p className="text-gray-500 italic">{d.reason}</p>}
        </div>
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
        <div className="space-y-1">
          <p><span className="font-semibold text-rose-600">{d.valueA}</span> ↔ <span className="font-semibold text-rose-600">{d.valueB}</span></p>
          {d.context && <p className="text-gray-500">{d.context}</p>}
        </div>
      );
    }
    case "stakeholders": {
      const d = data as NonNullable<MoralsSkillData["stakeholders"]>;
      return (
        <div className="space-y-1">
          {d.parties.map((p, i) => (
            <p key={i}><span className="font-semibold">{p.role}:</span> {p.feeling}{p.need ? ` · ${p.need}` : ""}</p>
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
        <ul className="space-y-1">
          {d.actions.map((a, i) => (
            <li key={i} className="text-sm">• {[a.when, a.what, a.how].filter(Boolean).join(" · ")}</li>
          ))}
        </ul>
      );
    }
    case "self_review": {
      const d = data as NonNullable<MoralsSkillData["self_review"]>;
      return (
        <div className="space-y-1">
          {d.progress && <p>{d.progress}</p>}
          {d.adjustment && <p className="text-gray-500 italic">보완: {d.adjustment}</p>}
          {d.feeling && <p className="text-rose-600">{d.feeling}</p>}
        </div>
      );
    }
  }
}

export default async function MoralsSharePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .schema("writing_helper")
    .from("morals_sessions")
    .select("id, student_number, student_name, room_id, skill_data, completed_skills, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">😅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">결과를 찾을 수 없어요</h1>
          <p className="text-gray-500 text-sm">선생님께 QR 코드를 다시 받아보세요.</p>
        </div>
      </div>
    );
  }

  const { data: room } = await admin
    .schema("writing_helper")
    .from("morals_rooms")
    .select("title, topic, track, enabled_skills")
    .eq("id", session.room_id)
    .maybeSingle();

  const track = room && isTrack(room.track) ? room.track : null;
  const enabledSkills: MoralsSkillKey[] = Array.isArray(room?.enabled_skills)
    ? (room?.enabled_skills as string[]).filter(isSkillKey)
    : [];
  const skillData = (session.skill_data ?? {}) as MoralsSkillData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-100 p-4">
      <div className="max-w-lg mx-auto pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-5xl mb-2">🪞</div>
          <h1 className="text-2xl font-bold text-gray-800">도덕 글쓰기 완성!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            <strong className="text-rose-600">{session.student_number}번 {session.student_name}</strong>의{" "}
            <strong>{room?.topic}</strong>
          </p>
          {room?.title && <p className="text-xs text-gray-400 mt-1">{room.title}</p>}
          {track && (
            <p className="text-xs font-semibold text-rose-600 mt-2">
              {MORALS_TRACK_META[track].emoji} {MORALS_TRACK_META[track].label}
            </p>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {enabledSkills.map((skill, idx) => {
            const data = skillData[skill];
            if (!data) return null;
            const meta = MORALS_SKILL_META[skill];
            return (
              <div key={skill} className={`p-5 ${idx < enabledSkills.length - 1 ? "border-b border-gray-100" : ""}`}>
                <p className="text-xs font-bold text-rose-500 uppercase tracking-wide mb-2">
                  {meta.emoji} {meta.label}
                </p>
                <div className="text-gray-800 text-sm leading-relaxed">
                  {renderSkillBody(skill, data)}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400">이 글을 보면서 다짐을 다시 떠올려 봐요 🌱</p>
      </div>
    </div>
  );
}
