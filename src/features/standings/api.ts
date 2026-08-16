import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { LiveStanding, WeekStanding } from '@/lib/database.types';
import { rankMembers, type Ranked } from '@/lib/ranking';

export type VoteValue = 1 | -1 | null;

export const standingsKeys = {
  live: (weekId: number | undefined) => ['standings', weekId] as const,
  frozen: (weekId: number) => ['weekStandings', weekId] as const,
  myVotes: (weekId: number | undefined) => ['myVotes', weekId] as const,
  prevRanks: ['prevClosedRanks'] as const,
};

/** Live aggregates for the open week. Counts only — never voter identity. */
export function useLiveStandings(weekId: number | undefined) {
  return useQuery({
    queryKey: standingsKeys.live(weekId),
    enabled: weekId !== undefined,
    staleTime: 10_000,
    queryFn: async (): Promise<LiveStanding[]> => {
      const { data, error } = await supabase.from('live_standings').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The frozen snapshot of a closed week (rule 3 — never recomputed). */
export function useWeekStandings(weekId: number | undefined) {
  return useQuery({
    queryKey: standingsKeys.frozen(weekId ?? -1),
    enabled: weekId !== undefined,
    staleTime: Infinity, // closed weeks are immutable
    queryFn: async (): Promise<WeekStanding[]> => {
      const { data, error } = await supabase
        .from('week_standings')
        .select('*')
        .eq('week_id', weekId!)
        .order('rank', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Your own ballots for the open week. RLS makes this return your rows and
 * nobody else's, which is the whole trick — the client never has the data it
 * would need to reveal anyone.
 */
export function useMyVotes(weekId: number | undefined) {
  return useQuery({
    queryKey: standingsKeys.myVotes(weekId),
    enabled: weekId !== undefined,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, VoteValue>> => {
      const { data, error } = await supabase
        .from('votes')
        .select('target_id, value')
        .eq('week_id', weekId!);
      if (error) throw error;
      const map: Record<string, VoteValue> = {};
      for (const row of data ?? []) map[row.target_id] = row.value;
      return map;
    },
  });
}

/** Ranks from the most recent closed week — the baseline for ▲/▼ on the live board. */
export function usePrevClosedRanks() {
  return useQuery({
    queryKey: standingsKeys.prevRanks,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data: lastWeek, error: weekError } = await supabase
        .from('weeks')
        .select('id')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (weekError) throw weekError;
      if (!lastWeek) return new Map();

      const { data, error } = await supabase
        .from('weekly_results')
        .select('member_id, rank')
        .eq('week_id', lastWeek.id);
      if (error) throw error;

      return new Map((data ?? []).map((r) => [r.member_id, r.rank]));
    },
  });
}

export interface RankedStanding extends Ranked<LiveStanding> {
  /** prev_rank − rank. Positive = climbed. null = NEW. */
  movement: number | null;
}

/**
 * The board as rendered: ranked client-side with exactly the rules
 * close_current_week() uses, so nothing jumps when the week closes.
 */
export function useRankedStandings(weekId: number | undefined) {
  const standings = useLiveStandings(weekId);
  const prevRanks = usePrevClosedRanks();

  const rows = useMemo<RankedStanding[]>(() => {
    if (!standings.data) return [];
    const prev = prevRanks.data ?? new Map<string, number>();
    return rankMembers(standings.data).map((row) => {
      const before = prev.get(row.member_id);
      return { ...row, movement: before === undefined ? null : before - row.rank };
    });
  }, [standings.data, prevRanks.data]);

  return {
    rows,
    isPending: standings.isPending,
    isError: standings.isError,
    error: standings.error,
  };
}

/**
 * Casting a vote (§8.3): optimistic, because the board has to feel instant.
 * Realtime reconciles a moment later; a failure rolls back and says so in
 * Georgian.
 */
export function useCastVote(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, value }: { targetId: string; value: VoteValue }) => {
      const { error } = await supabase.rpc('cast_vote', {
        p_target_id: targetId,
        p_value: value,
      });
      if (error) throw error;
    },

    onMutate: async ({ targetId, value }) => {
      const liveKey = standingsKeys.live(weekId);
      const mineKey = standingsKeys.myVotes(weekId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: liveKey }),
        queryClient.cancelQueries({ queryKey: mineKey }),
      ]);

      const prevLive = queryClient.getQueryData<LiveStanding[]>(liveKey);
      const prevMine = queryClient.getQueryData<Record<string, VoteValue>>(mineKey);

      const previousValue = prevMine?.[targetId] ?? null;
      const upDelta = (value === 1 ? 1 : 0) - (previousValue === 1 ? 1 : 0);
      const downDelta = (value === -1 ? 1 : 0) - (previousValue === -1 ? 1 : 0);

      if (prevMine) {
        const next = { ...prevMine };
        if (value === null) delete next[targetId];
        else next[targetId] = value;
        queryClient.setQueryData(mineKey, next);
      }

      if (prevLive) {
        queryClient.setQueryData(
          liveKey,
          prevLive.map((row) =>
            row.member_id === targetId
              ? {
                  ...row,
                  up: row.up + upDelta,
                  down: row.down + downDelta,
                  net: row.net + upDelta - downDelta,
                  total_votes: row.total_votes + upDelta + downDelta,
                }
              : row,
          ),
        );
      }

      return { prevLive, prevMine };
    },

    onError: (_error, _vars, context) => {
      if (context?.prevLive) {
        queryClient.setQueryData(standingsKeys.live(weekId), context.prevLive);
      }
      if (context?.prevMine) {
        queryClient.setQueryData(standingsKeys.myVotes(weekId), context.prevMine);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: standingsKeys.live(weekId) });
      queryClient.invalidateQueries({ queryKey: standingsKeys.myVotes(weekId) });
      queryClient.invalidateQueries({ queryKey: ['turnout', weekId] });
    },
  });
}
