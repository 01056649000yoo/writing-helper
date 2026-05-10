type QuestionVotingRankingItem = {
  questionId: string;
  text: string;
  votes: number;
  reasons: string[];
};

const PODIUM_STYLES = [
  {
    badge: "1위",
    accent: "text-amber-700",
    border: "border-amber-200",
    background: "bg-amber-50",
    vote: "bg-white text-amber-700",
  },
  {
    badge: "2위",
    accent: "text-slate-700",
    border: "border-slate-200",
    background: "bg-slate-50",
    vote: "bg-white text-slate-700",
  },
  {
    badge: "3위",
    accent: "text-orange-700",
    border: "border-orange-200",
    background: "bg-orange-50",
    vote: "bg-white text-orange-700",
  },
] as const;

export function QuestionVotingTopThree({
  ranking,
}: {
  ranking: QuestionVotingRankingItem[];
}) {
  const topThree = ranking.slice(0, 3);

  if (topThree.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {topThree.map((question, index) => {
        const style = PODIUM_STYLES[index] ?? PODIUM_STYLES[2];

        return (
          <div
            key={question.questionId}
            className={`rounded-3xl border p-5 shadow-sm ${style.border} ${style.background}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-sm font-bold ${style.accent}`}>{style.badge}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${style.vote}`}>
                {question.votes}표
              </span>
            </div>
            <p className={`mt-3 text-base font-bold leading-relaxed ${style.accent}`}>
              {question.text}
            </p>
            {question.reasons.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                선택 이유 {question.reasons.length}개
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuestionVotingCompactList({
  ranking,
  showReasons = false,
}: {
  ranking: QuestionVotingRankingItem[];
  showReasons?: boolean;
}) {
  if (ranking.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-white overflow-hidden">
      <div className="border-b border-violet-100 bg-violet-50/70 px-4 py-3">
        <p className="text-sm font-bold text-violet-800">전체 순위</p>
        <p className="mt-1 text-xs text-violet-600">득표가 많은 질문부터 한눈에 비교할 수 있어요.</p>
      </div>
      <div className="divide-y divide-violet-100">
        {ranking.map((question, index) => (
          <div key={question.questionId} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-14 shrink-0 rounded-full bg-violet-50 px-2 py-1 text-center text-xs font-bold text-violet-700">
                {index + 1}위
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed text-gray-900">
                  {question.text}
                </p>
                {showReasons && question.reasons.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-violet-600">
                      선택 이유 {question.reasons.length}개 보기
                    </summary>
                    <div className="mt-2 space-y-1 rounded-2xl bg-violet-50/70 p-3">
                      {question.reasons.map((reason, reasonIndex) => (
                        <p
                          key={`${question.questionId}-reason-${reasonIndex}`}
                          className="text-xs leading-relaxed text-gray-700"
                        >
                          • {reason}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                {question.votes}표
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
