import { ChipList, DetailSection, EmptyLine, FactRows } from "./parts";
import type { ActivityTeacherDetailProps } from "./types";

/** 질문 만들기 — 학생에게 주어진 질문 카드 묶음과 안내를 보여 준다. */
export function QuestionGeneratorDetail({ config, room }: ActivityTeacherDetailProps) {
  const raw = isRecord(config) ? config : {};
  const cardSets = Array.isArray(raw.cardSets) ? raw.cardSets.filter(isRecord) : [];
  const enabledIds = new Set(Array.isArray(raw.enabledCardSetIds) ? raw.enabledCardSetIds.map(String) : []);
  const enabled = cardSets.filter((set) => enabledIds.has(String(set.id)));
  const shown = enabled.length > 0 ? enabled : cardSets;
  const roles = Array.isArray(raw.roles) ? raw.roles.filter(isRecord) : [];
  const guidance = typeof raw.guidance === "string" ? raw.guidance.trim() : "";

  return (
    <>
      {room.topicDescription && (
        <DetailSection title="학생에게 준 설명">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{room.topicDescription}</p>
        </DetailSection>
      )}

      <DetailSection title="질문 카드 묶음" hint={`${shown.length}묶음`}>
        {shown.length === 0 ? (
          <EmptyLine>사용할 카드 묶음이 없습니다.</EmptyLine>
        ) : (
          <div className="space-y-2">
            {shown.map((set) => {
              const cards = Array.isArray(set.cards) ? set.cards.map((card) => String(isRecord(card) ? card.text ?? "" : card)) : [];
              return (
                <div key={String(set.id)} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-800">{String(set.label ?? "이름 없는 묶음")}</p>
                  {cards.length > 0 && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{cards.slice(0, 6).join(" · ")}
                      {cards.length > 6 && ` 외 ${cards.length - 6}개`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>

      {roles.length > 0 && (
        <DetailSection title="질문하는 사람 역할">
          <ChipList items={roles.map((role) => String(role.label ?? role.id ?? ""))} tone="amber" />
        </DetailSection>
      )}

      <DetailSection title="설정">
        <FactRows rows={[
          { label: "한 명이 만드는 질문 수", value: `${Number(raw.maxSelections) || 1}개` },
        ]} />
        {guidance && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">{guidance}</p>}
      </DetailSection>
    </>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
