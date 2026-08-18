import { normalizeQuestionVotingConfig } from "@/lib/question-voting";
import { ChipList, DetailSection, EmptyLine, FactRows, NumberedList } from "./parts";
import type { ActivityTeacherDetailProps } from "./types";

/** 좋은 질문 고르기 — 학생이 고를 질문 후보와 판단 기준을 보여 준다. */
export function QuestionVotingDetail({ config }: ActivityTeacherDetailProps) {
  const normalized = normalizeQuestionVotingConfig(config);
  const questions = normalized?.sourceQuestions ?? [];

  return (
    <>
      <DetailSection title="질문 후보" hint={`${questions.length}개 중 ${normalized?.maxSelections ?? 1}개를 고릅니다`}>
        <NumberedList items={questions.map((question) => ({ key: question.id, text: question.text }))} />
      </DetailSection>

      <DetailSection title="좋은 질문을 고르는 기준">
        {normalized?.evaluationCriteria?.length ? (
          <ChipList items={normalized.evaluationCriteria} tone="indigo" />
        ) : (
          <EmptyLine>기준을 정하지 않았습니다.</EmptyLine>
        )}
      </DetailSection>

      <DetailSection title="설정">
        <FactRows rows={[
          { label: "한 명이 고르는 수", value: `${normalized?.maxSelections ?? 1}개` },
          { label: "질문을 가져온 활동", value: normalized?.sourceRoomTitle || "-" },
        ]} />
      </DetailSection>
    </>
  );
}
