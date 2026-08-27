import type { OneLineShareBoardEntry } from "@/features/activities/types";
import { pickOneLineSharePodium, rankOneLineShare } from "@/lib/one-line-share";
import { rankLabel } from "@/lib/ranking";

/**
 * 등수별 색. 4·5위는 앞의 셋보다 눈에 덜 띄게 두어 시상대의 무게를 유지한다.
 * 자리(index)가 아니라 **등수**로 고르므로 공동 1위 둘은 같은 색을 받는다.
 */
const PODIUM_STYLES = [
  "border-rose-200 bg-rose-50",
  "border-slate-200 bg-slate-50",
  "border-orange-200 bg-orange-50",
  "border-violet-200 bg-violet-50",
  "border-sky-200 bg-sky-50",
] as const;

export function OneLineShareTopRanks({
  entries,
  showStudentName = false,
}: {
  entries: OneLineShareBoardEntry[];
  showStudentName?: boolean;
}) {
  const podium = pickOneLineSharePodium(rankOneLineShare(entries));

  if (podium.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {podium.map((entry) => (
        <div
          key={entry.entryId}
          className={`rounded-3xl border p-5 shadow-sm ${
            PODIUM_STYLES[entry.rank - 1] ?? PODIUM_STYLES[PODIUM_STYLES.length - 1]
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-bold text-gray-700">{rankLabel(entry)}</span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-rose-700">
              ❤️ {entry.likeCount}
            </span>
          </div>
          <p className="mt-3 text-base font-bold leading-relaxed text-gray-900">{entry.content}</p>
          {showStudentName && (
            <p className="mt-3 text-xs text-gray-500">
              {entry.studentNumber}번 {entry.studentName}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function OneLineShareBoard({
  entries,
  showStudentName = false,
  interactive = false,
  closed = false,
  maxReactionsPerStudent = 0,
  currentReactionCount = 0,
  onToggleLike,
  pendingEntryId,
}: {
  entries: OneLineShareBoardEntry[];
  showStudentName?: boolean;
  interactive?: boolean;
  closed?: boolean;
  maxReactionsPerStudent?: number;
  currentReactionCount?: number;
  onToggleLike?: (entryId: string) => void;
  pendingEntryId?: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-rose-200 bg-rose-50/70 p-10 text-center">
        <p className="text-base font-semibold text-rose-800">아직 모인 한 줄이 없어요.</p>
        <p className="mt-2 text-sm text-rose-600">학생들이 문장을 제출하면 여기에 모여 보여요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interactive && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          좋아요 {currentReactionCount} / {maxReactionsPerStudent}개를 사용했어요.
          {closed ? " 활동이 종료되어 이제 반응은 남길 수 없어요." : " 마음에 드는 문장을 눌러 반응해보세요."}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rankOneLineShare(entries).map((entry, index) => {
          const blocked = interactive
            && !closed
            && !entry.isMine
            && !entry.likedByCurrentSession
            && currentReactionCount >= maxReactionsPerStudent;

          return (
            <div key={entry.entryId} className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-rose-500">
                    {showStudentName
                      ? `${rankLabel(entry)} · ${entry.studentNumber}번 ${entry.studentName}`
                      : entry.isMine
                        ? "내 문장"
                        : `친구 문장 ${index + 1}`}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-gray-900 break-words">{entry.content}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    ❤️ {entry.likeCount}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {entry.containsKeywords && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      핵심단어 포함
                    </span>
                  )}
                </div>

                {interactive && (
                  <button
                    type="button"
                    onClick={() => onToggleLike?.(entry.entryId)}
                    disabled={closed || entry.isMine || blocked || pendingEntryId === entry.entryId}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      entry.likedByCurrentSession
                        ? "bg-rose-500 text-white hover:bg-rose-600"
                        : "bg-gray-100 text-gray-700 hover:bg-rose-50 hover:text-rose-700"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {entry.isMine
                      ? "내 문장"
                      : pendingEntryId === entry.entryId
                        ? "처리 중..."
                        : entry.likedByCurrentSession
                          ? "좋아요 취소"
                          : blocked
                            ? "좋아요 꽉 참"
                            : "좋아요"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
