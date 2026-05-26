import { createSupabaseAdminClient } from "@/lib/supabase-server";
import {
  SKILL_META,
  TRACK_META,
  SENSE_META,
  type InquiryTrack,
  type SkillData,
  type SkillKey,
} from "@/types/science";
import { ScienceCopyButton } from "./copy-button";

function serializeSkill(skill: SkillKey, data: NonNullable<SkillData[SkillKey]>): string {
  switch (skill) {
    case "observation": {
      const d = data as NonNullable<SkillData["observation"]>;
      const lines: string[] = [];
      if (d.beforeState) lines.push(`처음: ${d.beforeState}`);
      if (d.afterState) lines.push(`나중: ${d.afterState}`);
      if (d.senseTags.length > 0) lines.push(`관찰: ${d.senseTags.map((t) => t.text).join(", ")}`);
      return lines.join("\n");
    }
    case "classification": {
      const d = data as NonNullable<SkillData["classification"]>;
      return d.groupings.map((g) =>
        `[${g.basis}]\n` + g.groups.filter((gr) => gr.items.length > 0).map((gr) => `  ${gr.name || "(이름 없음)"}: ${gr.items.join(", ")}`).join("\n")
      ).join("\n\n");
    }
    case "measurement": {
      const d = data as NonNullable<SkillData["measurement"]>;
      return d.entries.map((e) => `${e.label}: ${e.values.filter(Boolean).join("/")}${e.unit}`).join("\n");
    }
    case "prediction": {
      const d = data as NonNullable<SkillData["prediction"]>;
      return d.reasoning ? `${d.prediction}\n근거: ${d.reasoning}` : d.prediction;
    }
    case "inference": {
      const d = data as NonNullable<SkillData["inference"]>;
      return d.counterText ? `${d.inferenceText}\n다른 가능성: ${d.counterText}` : d.inferenceText;
    }
    case "communication": return (data as NonNullable<SkillData["communication"]>).summary;
    case "problem": return (data as NonNullable<SkillData["problem"]>).problemText;
    case "hypothesis": {
      const d = data as NonNullable<SkillData["hypothesis"]>;
      return d.reasoning ? `${d.hypothesisText}\n근거: ${d.reasoning}` : d.hypothesisText;
    }
    case "variable_control": {
      const d = data as NonNullable<SkillData["variable_control"]>;
      return [`조작 변인: ${d.manipulated}`, d.controlled.length > 0 && `통제 변인: ${d.controlled.join(", ")}`, `종속 변인: ${d.dependent}`].filter(Boolean).join("\n");
    }
    case "data_transform": {
      const d = data as NonNullable<SkillData["data_transform"]>;
      if (d.shape === "table") {
        const headers = d.tableHeaders ?? [];
        const rows = d.tableRows ?? [];
        return [headers.join(" | "), ...rows.map((r) => r.join(" | "))].join("\n");
      }
      return (d.chartData ?? []).map((p) => `${p.label}: ${p.value}`).join("\n");
    }
    case "data_interpret": {
      const d = data as NonNullable<SkillData["data_interpret"]>;
      const lines: string[] = [];
      if (d.patterns.length > 0) lines.push(`규칙: ${d.patterns.join(", ")}`);
      if (d.interpretation) lines.push(d.interpretation);
      return lines.join("\n");
    }
    case "conclusion": {
      const d = data as NonNullable<SkillData["conclusion"]>;
      return [d.conclusionText, d.generalization && `일반화: ${d.generalization}`, d.followUp && `더 알아볼 점: ${d.followUp}`].filter(Boolean).join("\n");
    }
  }
}

function buildScienceShareText(opts: {
  title: string;
  topic: string;
  studentNumber: number;
  studentName: string;
  track: InquiryTrack | null;
  enabledSkills: SkillKey[];
  skillData: SkillData;
  // legacy fields
  beforeState?: string;
  afterState?: string;
  senseTags?: Array<{ text: string }>;
  measurements?: Array<{ label: string; value: string; unit: string }>;
  inferenceText?: string;
  counterText?: string;
  questionText?: string;
}): string {
  const parts: string[] = [];
  parts.push(`[과학 탐구 글쓰기] ${opts.title}`);
  parts.push(`주제: ${opts.topic}`);
  parts.push(`${opts.studentNumber}번 ${opts.studentName}`);
  if (opts.track) parts.push(`트랙: ${TRACK_META[opts.track].label}`);
  parts.push("");

  const hasNew = opts.enabledSkills.some((s) => Boolean(opts.skillData[s]));
  if (hasNew) {
    for (const skill of opts.enabledSkills) {
      const data = opts.skillData[skill];
      if (!data) continue;
      const meta = SKILL_META[skill];
      const body = serializeSkill(skill, data);
      if (!body) continue;
      parts.push(`■ ${meta.label}`);
      parts.push(body);
      parts.push("");
    }
  } else {
    if (opts.beforeState) parts.push(`처음: ${opts.beforeState}`);
    if (opts.afterState) parts.push(`나중: ${opts.afterState}`);
    if (opts.senseTags && opts.senseTags.length > 0) parts.push(`관찰: ${opts.senseTags.map((t) => t.text).join(", ")}`);
    if (opts.measurements && opts.measurements.length > 0) parts.push(`측정: ${opts.measurements.map((m) => `${m.label} ${m.value}${m.unit}`).join(", ")}`);
    if (opts.inferenceText) parts.push(`추론: ${opts.inferenceText}`);
    if (opts.counterText) parts.push(`다른 가능성: ${opts.counterText}`);
    if (opts.questionText) parts.push(`질문: ${opts.questionText}`);
  }

  return parts.join("\n").trim();
}

function isSkillKey(value: string): value is SkillKey {
  return value in SKILL_META;
}

function isInquiryTrack(value: string | null): value is InquiryTrack {
  return value === "basic" || value === "integrated";
}

function renderSkillBody(skill: SkillKey, data: NonNullable<SkillData[SkillKey]>) {
  switch (skill) {
    case "observation": {
      const d = data as NonNullable<SkillData["observation"]>;
      return (
        <div className="space-y-2">
          {d.beforeState && <p><span className="text-gray-400">처음: </span>{d.beforeState}</p>}
          {d.afterState && <p><span className="text-gray-400">나중: </span>{d.afterState}</p>}
          {d.senseTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {d.senseTags.map((tag, index) => (
                <span key={index} className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700">
                  {SENSE_META[tag.sense]?.emoji} {tag.text}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "classification": {
      const d = data as NonNullable<SkillData["classification"]>;
      return (
        <div className="space-y-2">
          {d.groupings.map((grouping, index) => (
            <div key={index}>
              <p className="text-xs font-semibold text-gray-400">기준: {grouping.basis}</p>
              {grouping.groups.map((group, groupIndex) => (
                group.items.length > 0 && (
                  <p key={groupIndex}>
                    <span className="font-semibold">{group.name || "이름 없는 무리"}: </span>
                    {group.items.join(", ")}
                  </p>
                )
              ))}
            </div>
          ))}
        </div>
      );
    }
    case "measurement": {
      const d = data as NonNullable<SkillData["measurement"]>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {d.entries.map((entry, index) => (
            <span key={index} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {entry.label}: {entry.values.filter(Boolean).join("/")} {entry.unit}
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
          {d.reasoning && <p className="mt-2 text-sm text-gray-500">근거: {d.reasoning}</p>}
        </>
      );
    }
    case "inference": {
      const d = data as NonNullable<SkillData["inference"]>;
      return (
        <>
          <p>{d.inferenceText}</p>
          {d.counterText && <p className="mt-2 text-sm text-gray-500">다른 가능성: {d.counterText}</p>}
        </>
      );
    }
    case "communication": {
      const d = data as NonNullable<SkillData["communication"]>;
      return <p className="whitespace-pre-line">{d.summary}</p>;
    }
    case "problem": {
      const d = data as NonNullable<SkillData["problem"]>;
      return <p>{d.problemText}</p>;
    }
    case "hypothesis": {
      const d = data as NonNullable<SkillData["hypothesis"]>;
      return (
        <>
          <p>{d.hypothesisText}</p>
          {d.reasoning && <p className="mt-2 text-sm text-gray-500">근거: {d.reasoning}</p>}
        </>
      );
    }
    case "variable_control": {
      const d = data as NonNullable<SkillData["variable_control"]>;
      return (
        <div className="space-y-1">
          <p><span className="font-semibold text-amber-700">조작 변인: </span>{d.manipulated}</p>
          {d.controlled.length > 0 && <p><span className="font-semibold text-emerald-700">통제 변인: </span>{d.controlled.join(", ")}</p>}
          <p><span className="font-semibold text-indigo-700">종속 변인: </span>{d.dependent}</p>
        </div>
      );
    }
    case "data_transform": {
      const d = data as NonNullable<SkillData["data_transform"]>;
      if (d.shape === "table") {
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm">
              <thead>
                <tr>
                  {(d.tableHeaders ?? []).map((header, index) => (
                    <th key={index} className="border border-gray-200 bg-gray-50 px-2 py-1 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(d.tableRows ?? []).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border border-gray-200 px-2 py-1">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return <p>{(d.chartData ?? []).map((point) => `${point.label}: ${point.value}`).join(", ")}</p>;
    }
    case "data_interpret": {
      const d = data as NonNullable<SkillData["data_interpret"]>;
      return (
        <>
          {d.patterns.length > 0 && <p className="text-sm text-gray-500">규칙: {d.patterns.join(", ")}</p>}
          <p className="mt-2">{d.interpretation}</p>
        </>
      );
    }
    case "conclusion": {
      const d = data as NonNullable<SkillData["conclusion"]>;
      return (
        <div className="space-y-2">
          <p>{d.conclusionText}</p>
          {d.generalization && <p className="text-sm text-gray-500">일반화: {d.generalization}</p>}
          {d.followUp && <p className="text-sm text-cyan-700">더 알아볼 점: {d.followUp}</p>}
        </div>
      );
    }
  }
}

export default async function ScienceSharePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .schema("writing_helper")
    .from("science_sessions")
    .select("id, room_id, student_number, student_name, skill_data, completed_skills, status, before_state, after_state, sense_tags, measurements, inference_text, counter_text, question_text")
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
    .from("science_rooms")
    .select("title, topic, inquiry_track, enabled_skills")
    .eq("id", session.room_id)
    .maybeSingle();

  const inquiryTrackRaw = typeof room?.inquiry_track === "string" ? room.inquiry_track : null;
  const inquiryTrack: InquiryTrack | null = isInquiryTrack(inquiryTrackRaw) ? inquiryTrackRaw : null;
  const enabledSkills = Array.isArray(room?.enabled_skills)
    ? (room.enabled_skills as string[]).filter(isSkillKey)
    : [];
  const skillData = (session.skill_data ?? {}) as SkillData;
  const hasNewTrackResult = enabledSkills.some((skill) => Boolean(skillData[skill]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-4">
      <div className="max-w-2xl mx-auto pt-8 pb-16 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
          <div className="text-5xl mb-2">🔬</div>
          <h1 className="text-2xl font-bold text-gray-800">과학 탐구 기록</h1>
          <p className="text-gray-500 mt-1 text-sm">
            <strong className="text-cyan-700">
              {session.student_number}번 {session.student_name}
            </strong>
            의 <strong>{room?.topic}</strong> 기록
          </p>
          {room?.title && <p className="text-xs text-gray-400 mt-1">{room.title}</p>}
          {inquiryTrack && (
            <p className="mt-3 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
              {TRACK_META[inquiryTrack].emoji} {TRACK_META[inquiryTrack].label}
            </p>
          )}
        </div>

        {hasNewTrackResult ? (
          <div className="space-y-3">
            {enabledSkills.map((skill) => {
              const data = skillData[skill];
              if (!data) return null;
              const meta = SKILL_META[skill];
              return (
                <section key={skill} className="bg-white rounded-3xl shadow-xl p-5">
                  <p className="text-xs font-bold text-cyan-600 uppercase tracking-wide mb-2">
                    {meta.emoji} {meta.label}
                  </p>
                  <div className="text-sm leading-7 text-gray-800">
                    {renderSkillBody(skill, data)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-5 space-y-4 text-sm leading-7 text-gray-800">
            {session.before_state && <p><span className="text-gray-400">처음: </span>{session.before_state}</p>}
            {session.after_state && <p><span className="text-gray-400">나중: </span>{session.after_state}</p>}
            {Array.isArray(session.sense_tags) && session.sense_tags.length > 0 && (
              <p><span className="text-gray-400">관찰: </span>{session.sense_tags.map((tag: { text: string }) => tag.text).join(", ")}</p>
            )}
            {Array.isArray(session.measurements) && session.measurements.length > 0 && (
              <p><span className="text-gray-400">측정: </span>{session.measurements.map((m: { label: string; value: string; unit: string }) => `${m.label} ${m.value}${m.unit}`).join(", ")}</p>
            )}
            {session.inference_text && <p><span className="text-gray-400">추론: </span>{session.inference_text}</p>}
            {session.counter_text && <p><span className="text-gray-400">다른 가능성: </span>{session.counter_text}</p>}
            {session.question_text && <p><span className="text-gray-400">질문: </span>{session.question_text}</p>}
          </div>
        )}

        {session.status !== "done" && (
          <p className="text-center text-xs text-amber-600 bg-white/70 rounded-2xl py-3">
            아직 활동이 완료되지 않은 기록입니다.
          </p>
        )}

        <ScienceCopyButton
          text={buildScienceShareText({
            title: room?.title ?? "",
            topic: room?.topic ?? "",
            studentNumber: session.student_number,
            studentName: session.student_name,
            track: inquiryTrack,
            enabledSkills,
            skillData,
            beforeState: session.before_state ?? "",
            afterState: session.after_state ?? "",
            senseTags: (Array.isArray(session.sense_tags) ? session.sense_tags : []) as Array<{ text: string }>,
            measurements: (Array.isArray(session.measurements) ? session.measurements : []) as Array<{ label: string; value: string; unit: string }>,
            inferenceText: session.inference_text ?? "",
            counterText: session.counter_text ?? "",
            questionText: session.question_text ?? "",
          })}
        />
      </div>
    </div>
  );
}
