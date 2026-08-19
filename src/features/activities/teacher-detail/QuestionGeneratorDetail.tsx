import { ChipList, DetailSection, EmptyLine, FactRows } from "./parts";
import type { ActivityTeacherDetailProps } from "./types";
import {
  QUESTION_GENERATOR_MODE_META,
  normalizeQuestionGeneratorConfig,
} from "../question-generator/config";
import { groupCardSetsByArea } from "../question-generator/areas";

/** 질문 만들기 — 학생에게 실제로 주어진 방식·질문 카드·안내를 보여 준다. */
export function QuestionGeneratorDetail({ config, room }: ActivityTeacherDetailProps) {
  const normalized = normalizeQuestionGeneratorConfig(config);
  const modeMeta = QUESTION_GENERATOR_MODE_META[normalized.mode];
  const cardSets = normalized.cardSets;
  // 학생은 큰 카테고리부터 고른다 — 선생님도 같은 묶음으로 본다.
  const areas = normalized.mode === "card_remix" ? groupCardSetsByArea(cardSets) : [];

  return (
    <>
      <DetailSection title="질문 작성 방식">
        <p className="text-sm font-semibold text-gray-800">
          {modeMeta.icon} {modeMeta.label}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{modeMeta.teacherHint}</p>
      </DetailSection>

      {room.topicDescription && (
        <DetailSection title="학생에게 준 설명">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{room.topicDescription}</p>
        </DetailSection>
      )}

      {normalized.mode !== "direct" && (
        <DetailSection
          title={normalized.mode === "ai_custom" ? "학생에게 준 질문 예시" : "질문 카드 묶음"}
          hint={normalized.mode === "ai_custom" ? undefined : `${cardSets.length}묶음`}
        >
          {cardSets.length === 0 ? (
            <EmptyLine>학생에게 준 질문이 없습니다.</EmptyLine>
          ) : (
            <div className="space-y-2">
              {cardSets.map((cardSet) => (
                <div key={cardSet.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-800">
                    {cardSet.label}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">{cardSet.prompts.length}개</span>
                  </p>
                  {cardSet.prompts.length > 0 && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {cardSet.prompts.slice(0, 6).join(" · ")}
                      {cardSet.prompts.length > 6 && ` 외 ${cardSet.prompts.length - 6}개`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {areas.length > 0 && (
        <DetailSection title="학생이 고르는 질문 카테고리" hint={`${areas.length}개`}>
          <ChipList items={areas.map((entry) => `${entry.area.emoji} ${entry.area.label}`)} tone="amber" />
        </DetailSection>
      )}

      <DetailSection title="설정">
        <FactRows rows={[
          { label: "한 명이 만드는 질문 수", value: `${normalized.maxSelections}개` },
        ]} />
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{normalized.guidance}</p>
      </DetailSection>
    </>
  );
}
