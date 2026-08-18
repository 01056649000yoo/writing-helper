import { getDefaultOutlineTemplate, type OutlineTemplate } from "@/lib/outline-templates";
import type { SubjectType } from "@/types";
import { DetailSection, EmptyLine, FactRows } from "./parts";
import type { ActivityTeacherDetailProps } from "./types";

/** 글 개요 짜기 — 학생이 채울 개요 틀을 처음·가운데·끝으로 보여 준다. */
export function OutlineBuilderDetail({ config, room }: ActivityTeacherDetailProps) {
  const raw = isRecord(config) ? config : {};
  const subjectType = (room.subjectType || "생활문") as SubjectType;
  const saved = raw.outlineTemplate as OutlineTemplate | null | undefined;

  // 방마다 세 경우가 있다(운영 16개 기준 3 / 7 / 6).
  //   ① 새 방식 — activity_config.outlineTemplate 에 교사가 만든 틀이 있다
  //   ② 옛 방식 — 틀이 없고 rooms.question_sets 에 문항이 있다(v1 시절)
  //   ③ 둘 다 없다
  // ①이 아닌데 기본 틀을 보여 주면 **학생이 본 적 없는 내용**을 보여 주는 것이라 그러지 않는다.
  const hasSavedTemplate = Boolean(saved && Array.isArray(saved.sections) && saved.sections.length > 0);
  const legacyQuestions = collectLegacyQuestions(raw.questionSets);

  // 틀을 따로 만들지 않은 방(운영 16개 중 13개)에서도 **학생은 글 종류 기본 틀을 본다**
  // (`room/[id]/activity/page.tsx`: `data.outline_template ?? getDefaultOutlineTemplate(subjectType)`).
  // 그러니 교사에게도 그 기본 틀을 보여 주는 것이 맞다. 다만 교사가 만든 것과 헷갈리지 않게
  // `글 종류 기본 틀` 이라고 밝힌다.
  // 예외는 v1 시절 방이다 — 그때는 틀이 아니라 문항 목록으로 물었으므로 그것을 보여 준다.
  if (!hasSavedTemplate && legacyQuestions.length > 0) {
    return (
      <>
        <DetailSection title="학생이 답한 문항" hint="예전 방식으로 만든 활동입니다">
          <ol className="space-y-1.5">
            {legacyQuestions.map((question, index) => (
              <li key={`${index}-${question}`} className="flex gap-2 text-sm text-gray-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[0.68rem] font-bold text-gray-500">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">{question}</span>
              </li>
            ))}
          </ol>
        </DetailSection>

        <DetailSection title="설정">
          <FactRows rows={[
            { label: "글 종류", value: room.subjectType || "-" },
            { label: "학년", value: room.gradeLevel || "-" },
          ]} />
        </DetailSection>
      </>
    );
  }

  const template = saved ?? getDefaultOutlineTemplate(subjectType);
  const itemCount = template.sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <>
      <DetailSection
        title="개요 틀"
        hint={hasSavedTemplate
          ? `학생이 채울 칸 ${itemCount}개`
          : `글 종류 기본 틀 · 학생이 채울 칸 ${itemCount}개`}
      >
        {template.sections.length === 0 ? (
          <EmptyLine>개요 틀이 비어 있습니다.</EmptyLine>
        ) : (
          <div className="space-y-3">
            {template.sections.map((section) => (
              <div key={section.key}>
                <p className="mb-1 text-xs font-bold text-indigo-600">{section.key}</p>
                {section.items.length === 0 ? (
                  <EmptyLine>이 칸에는 항목이 없습니다.</EmptyLine>
                ) : (
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.id} className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-sm font-semibold text-gray-800">{item.label || "(이름 없는 항목)"}</p>
                        {item.placeholder && (
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.placeholder}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title="설정">
        <FactRows rows={[
          { label: "글 종류", value: room.subjectType || "-" },
          { label: "학년", value: room.gradeLevel || "-" },
        ]} />
      </DetailSection>
    </>
  );
}

/** v1 시절 `question_sets` 는 수준별(low/mid/high)로 문항을 담았다. 한 벌만 골라 보여 준다. */
function collectLegacyQuestions(value: unknown): string[] {
  if (!isRecord(value)) return [];
  for (const level of ["mid", "low", "high"]) {
    const bucket = value[level];
    if (!isRecord(bucket) || !Array.isArray(bucket.questions)) continue;
    const questions = bucket.questions
      .filter(isRecord)
      .map((entry) => (typeof entry.question === "string" ? entry.question.trim() : ""))
      .filter((text) => text.length > 0);
    if (questions.length > 0) return questions;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
