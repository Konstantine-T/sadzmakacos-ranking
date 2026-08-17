/**
 * Competition ranking (§1.3).
 *
 * This MUST stay behaviourally identical to the `rank() over (order by net
 * desc)` in close_current_week() and admin_update_result(). The live board
 * computes ranks here so that the moment a week closes, the frozen snapshot
 * agrees with what everyone was already looking at. If you change one, change
 * all three.
 *
 *   rank:  competition ranking on `net` ALONE — everyone on the same net score
 *          shares a rank, and the next rank skips past all of them:
 *          1, 2, 3, 3, 3, 3, 7, 7, 7, 7, 11.
 *   order: net DESC, total_votes ASC, nickname ASC
 *
 * The same net is the same rank, full stop. +5 is +5 whether it came from 5/0
 * or 6/1, so both are rank 3 — the score is what the group argues about, and
 * two people with identical scores holding different rank numbers reads as a
 * bug however it is justified.
 *
 * Downvotes and nickname order the rows INSIDE a shared rank; neither can move
 * the rank number. Within a tie the clean sheet sits on top: 5/0 above 6/1,
 * 4/0 above 5/1. At a fixed net, up = net + down, so
 * total = up + down = net + 2·down — ordering by total_votes ascending IS
 * ordering by downvotes ascending, which is why the comparator can work off
 * `total_votes` and not carry a `down` field.
 */

export interface Rankable {
  member_id: string;
  nickname: string;
  net: number;
  total_votes: number;
}

export type Ranked<T> = T & { rank: number };

const collator = new Intl.Collator('ka');

/**
 * Display order, everywhere: best net first, then the cleanest sheet, then
 * alphabetical. Used for the live board and to lay out frozen weeks, so a tie
 * never renders in a different order on two screens.
 */
export function compareForBoard(a: Rankable, b: Rankable): number {
  return (
    b.net - a.net ||
    a.total_votes - b.total_votes || // ascending = fewer downvotes first
    collator.compare(a.nickname, b.nickname)
  );
}

export function rankMembers<T extends Rankable>(rows: readonly T[]): Ranked<T>[] {
  const sorted = [...rows].sort(compareForBoard);

  let currentRank = 0;
  let prevNet = Number.NaN;

  return sorted.map((row, index) => {
    if (row.net !== prevNet) {
      currentRank = index + 1; // the skip: index, not a running counter
      prevNet = row.net;
    }
    return { ...row, rank: currentRank };
  });
}

/**
 * Lay out a closed week for display without recomputing its ranks.
 *
 * Rule 3: the frozen `rank` from weekly_results is authoritative and is never
 * derived again. This only decides the order rows appear in, which Postgres
 * leaves unspecified inside a shared rank.
 */
export function sortFrozen<T extends Rankable & { rank: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.rank - b.rank || compareForBoard(a, b));
}

/**
 * Rank movement against the previous closed week (§1.3).
 * Positive = climbed. `null` = no previous week, render as NEW.
 */
export function movementOf(
  rank: number,
  prevRanks: ReadonlyMap<string, number>,
  memberId: string,
): number | null {
  const prev = prevRanks.get(memberId);
  return prev === undefined ? null : prev - rank;
}

/** The widest bar on the board — the scale every HeatBar is drawn against. */
export function maxTotalVotes(rows: readonly { total_votes: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.total_votes), 0);
}
