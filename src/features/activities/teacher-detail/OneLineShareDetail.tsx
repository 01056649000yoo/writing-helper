import { normalizeOneLineShareConfig } from "@/lib/one-line-share";
import { ChipList, DetailSection, EmptyLine, FactRows } from "./parts";
import type { ActivityTeacherDetailProps } from "./types";

/** 한줄모아 — 학생이 답할 한 줄 주제와 넣어야 할 낱말을 보여 준다. */
export function OneLineShareDetail({ config }: ActivityTeacherDetailProps) {
  const normalized = normalizeOneLineShareConfig(config);

  return (
    <>
      <DetailSection title="한 줄 주제">
        {normalized?.promptTitle ? (
          <>
            <p className="text-sm font-semibold text-gray-800">{normalized.promptTitle}</p>
            {normalized.promptDescription && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {normalized.promptDescription}
              </p>
            )}
          </>
        ) : (
          <EmptyLine>주제를 적지 않았습니다.</EmptyLine>
        )}
      </DetailSection>

      <DetailSection title="꼭 넣을 낱말" hint="학생 글에 이 낱말이 들어갔는지 표시됩니다">
        <ChipList items={normalized?.coreKeywords ?? []} tone="indigo" />
      </DetailSection>

      {(normalized?.auxiliaryKeywords?.length ?? 0) > 0 && (
        <DetailSection title="넣으면 좋은 낱말">
          <ChipList items={normalized!.auxiliaryKeywords} />
        </DetailSection>
      )}

      <DetailSection title="설정">
        <FactRows rows={[
          { label: "한 명이 누를 수 있는 공감", value: `${normalized?.maxReactionsPerStudent ?? 0}번` },
        ]} />
      </DetailSection>
    </>
  );
}
