import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FlagScore, Member } from '@/lib/database.types';

/**
 * The flag game's data layer.
 *
 * Nothing here is secret, and there is no country table — the pool is bundled
 * in `countries.ts`. All Postgres holds is one row per member with their best
 * streak, published to realtime whole because every column in it is already on
 * the leaderboard.
 *
 * Deliberately NOT wired into `triviaKeys`. Every game owns its own board:
 * ten-questions-a-week and an endless streak cannot be summed into one number
 * without whoever plays most winning regardless of what they know.
 */

export const flagKeys = {
  board: ['flags', 'board'] as const,
};

export interface FlagRow {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  best_streak: number;
  plays: number;
  rank: number;
}

const collator = new Intl.Collator('ka');

/**
 * Competition ranking on `best_streak` — equal streaks share a rank and the
 * next rank skips, 1, 2, 2, 2, 5, as everywhere else in this app.
 *
 * `plays` breaks a tie ascending: the same streak reached in fewer attempts
 * sits on top. Neither it nor the nickname can move the rank number.
 */
function rankFlags(rows: Omit<FlagRow, 'rank'>[]): FlagRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.best_streak - a.best_streak ||
      a.plays - b.plays ||
      collator.compare(a.nickname, b.nickname),
  );

  let rank = 0;
  let prev = Number.NaN;
  return sorted.map((row, index) => {
    if (row.best_streak !== prev) {
      rank = index + 1; // the skip: index, not a running counter
      prev = row.best_streak;
    }
    return { ...row, rank };
  });
}

export function useFlagBoard() {
  const query = useQuery({
    queryKey: flagKeys.board,
    staleTime: 30_000,
    queryFn: async (): Promise<{ scores: FlagScore[]; members: Member[] }> => {
      const [{ data: scores, error: e1 }, { data: members, error: e2 }] = await Promise.all([
        supabase.from('flag_scores').select('*'),
        supabase.from('members').select('*').eq('is_active', true),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { scores: scores ?? [], members: members ?? [] };
    },
  });

  const rows = useMemo<FlagRow[]>(() => {
    const members = new Map((query.data?.members ?? []).map((m) => [m.id, m]));
    const played = (query.data?.scores ?? []).filter(
      (s) => s.plays > 0 && members.has(s.member_id),
    );
    return rankFlags(
      played.map((s) => {
        const m = members.get(s.member_id)!;
        return {
          member_id: s.member_id,
          nickname: m.nickname,
          avatar_url: m.avatar_url,
          best_streak: s.best_streak,
          plays: s.plays,
        };
      }),
    );
  }, [query.data]);

  return { rows, isPending: query.isPending, played: rows.length > 0 };
}

/**
 * Record a finished run.
 *
 * The server keeps the higher of the two streaks, so submitting a worse run is
 * harmless — it still counts as a play, which is what lets the board tiebreak
 * on persistence.
 */
export function useSubmitFlagScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (streak: number): Promise<number> => {
      const { data, error } = await supabase.rpc('submit_flag_score', { p_streak: streak });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flagKeys.board });
    },
  });
}
