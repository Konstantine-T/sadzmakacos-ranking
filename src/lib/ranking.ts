/**
 * Competition ranking (§1.3).
 *
 * This MUST stay behaviourally identical to the `rank() over (order by net
 * desc, total_votes desc)` in close_current_week(). The live board computes
 * ranks here so that the moment a week closes, the frozen snapshot agrees with
 * what everyone was already looking at. If you change one, change both.
 *
 *   sort:  net DESC, total_votes DESC, nickname ASC
 *   rank:  competition ranking on the PAIR (net, total_votes) — ties share a
 *          rank and the next rank skips: 1, 1, 3, 4.
 *
 * nickname breaks display order inside a shared rank, never the rank number.
 *
 * This is what makes +1/−1 (net 0, total 2) outrank 0/0 (net 0, total 0):
 * someone who provoked reactions places above someone nobody thought about.
 */

export interface Rankable {
  member_id: string;
  nickname: string;
  net: number;
  total_votes: number;
}

export type Ranked<T> = T & { rank: number };

const collator = new Intl.Collator('ka');

export function rankMembers<T extends Rankable>(rows: readonly T[]): Ranked<T>[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.net - a.net ||
      b.total_votes - a.total_votes ||
      collator.compare(a.nickname, b.nickname),
  );

  let currentRank = 0;
  let prevNet = Number.NaN;
  let prevTotal = Number.NaN;

  return sorted.map((row, index) => {
    if (row.net !== prevNet || row.total_votes !== prevTotal) {
      currentRank = index + 1; // the skip: index, not a running counter
      prevNet = row.net;
      prevTotal = row.total_votes;
    }
    return { ...row, rank: currentRank };
  });
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
