import { pickQuestionVotingPodium, rankQuestionVoting } from "@/lib/question-voting";
import { rankLabel } from "@/lib/ranking";

type QuestionVotingRankingItem = {
  questionId: string;
  text: string;
  votes: number;
};

/**
 * 등수별 색. 4·5위는 앞의 셋보다 눈에 덜 띄게 두어 시상대의 무게를 유지한다.
 * 자리(index)가 아니라 **등수**로 고르므로 공동 1위 둘은 같은 금색을 받는다.
 */
const PODIUM_STYLES = [
  {
    accent: "text-amber-700",
    border: "border-amber-200",
    background: "bg-amber-50",
    vote: "bg-white text-amber-700",
  },
  {
    accent: "text-slate-700",
    border: "border-slate-200",
    background: "bg-slate-50",
    vote: "bg-white text-slate-700",
  },
  {
    accent: "text-orange-700",
    border: "border-orange-200",
    background: "bg-orange-50",
    vote: "bg-white text-orange-700",
  },
  {
    accent: "text-violet-700",
    border: "border-violet-200",
    background: "bg-violet-50",
    vote: "bg-white text-violet-700",
  },
  {
    accent: "text-sky-700",
    border: "border-sky-200",
    background: "bg-sky-50",
    vote: "bg-white text-sky-700",
  },
] as const;

export function QuestionVotingTopRanks({
  ranking,
}: {
  ranking: QuestionVotingRankingItem[];
}) {
  const podium = pickQuestionVotingPodium(rankQuestionVoting(ranking));

  if (podium.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {podium.map((question) => {
        const style = PODIUM_STYLES[question.rank - 1] ?? PODIUM_STYLES[PODIUM_STYLES.length - 1];

        return (
          <div
            key={question.questionId}
            className={`rounded-3xl border p-5 shadow-sm ${style.border} ${style.background}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-sm font-bold ${style.accent}`}>{rankLabel(question)}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${style.vote}`}>
                {question.votes}표
              </span>
            </div>
            <p className={`mt-3 text-base font-bold leading-relaxed ${style.accent}`}>
              {question.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionVotingCompactList({
  ranking,
}: {
  ranking: QuestionVotingRankingItem[];
}) {
  const ranked = rankQuestionVoting(ranking);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-white overflow-hidden">
      <div className="border-b border-violet-100 bg-violet-50/70 px-4 py-3">
        <p className="text-sm font-bold text-violet-800">전체 순위</p>
        <p className="mt-1 text-xs text-violet-600">
          득표가 많은 질문부터 한눈에 비교할 수 있어요. 표가 같으면 공동 등수예요.
        </p>
      </div>
      <div className="divide-y divide-violet-100">
        {ranked.map((question) => (
          <div key={question.questionId} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-20 shrink-0 rounded-full bg-violet-50 px-2 py-1 text-center text-xs font-bold text-violet-700">
                {rankLabel(question)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed text-gray-900">
                  {question.text}
                </p>
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
