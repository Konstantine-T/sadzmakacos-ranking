/**
 * Competition ranking for trivia.
 *
 * This MUST stay behaviourally identical to the `rank() over (order by correct
 * desc)` in trg_week_freeze_trivia() (20260830000100_trivia.sql). The live
 * board ranks here so that the moment a week closes, the frozen snapshot agrees
 * with what everyone was already looking at.
 *
 *   rank:  competition ranking on `correct` ALONE — the same score is the same
 *          rank, and the next rank skips past all of them: 1, 2, 2, 2, 5.
 *   order: correct DESC, answered ASC, nickname ASC
 *
 * `answered` and `nickname` order rows INSIDE a shared rank and can never move
 * the rank number. At a fixed `correct`, answered = correct + wrong, so
 * ascending `answered` IS ascending wrong answers — the cleanest sheet sits on
 * top, 8/8 above 8/10, exactly as `total_votes` behaves on the vote board.
 *
 * Unanswered questions count for nothing on either side: stop at six and you
 * score what you got right out of six.
 *
 * DELIBERATELY NOT src/lib/ranking.ts. That one ranks on `net` and is shared by
 * four call sites; this one ranks on `correct` and is shared by two. They look
 * alike and mean different things — do not merge them.
 */

export interface TriviaRankable {
  member_id: string;
  nickname: string;
  correct: number;
  answered: number;
}

export type TriviaRanked<T> = T & { rank: number };

const collator = new Intl.Collator('ka');

/** Display order, everywhere: best score, then the cleanest sheet, then alphabetical. */
export function compareForTriviaBoard(a: TriviaRankable, b: TriviaRankable): number {
  return (
    b.correct - a.correct ||
    a.answered - b.answered || // ascending = fewer wrong answers first
    collator.compare(a.nickname, b.nickname)
  );
}

export function rankTrivia<T extends TriviaRankable>(rows: readonly T[]): TriviaRanked<T>[] {
  const sorted = [...rows].sort(compareForTriviaBoard);

  let currentRank = 0;
  let prevCorrect = Number.NaN;

  return sorted.map((row, index) => {
    if (row.correct !== prevCorrect) {
      currentRank = index + 1; // the skip: index, not a running counter
      prevCorrect = row.correct;
    }
    return { ...row, rank: currentRank };
  });
}
