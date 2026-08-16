import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AllTimeStanding } from '@/lib/database.types';
import type { StandingsRowData } from '@/features/standings/StandingsRow';

export const allTimeKeys = { standings: ['allTime'] as const };

/**
 * Both measures stay available (§1.7): total net rewards longevity, average net
 * per week is fairer to members who joined later, and weeks at #1 is the one
 * people actually argue about. Neither is "the" ranking — you pick.
 */
export type AllTimeSort = 'total_net' | 'avg_net' | 'weeks_at_one';

export function useAllTimeStandings() {
  return useQuery({
    queryKey: allTimeKeys.standings,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AllTimeStanding[]> => {
      const { data, error } = await supabase
        .from('all_time_standings')
        .select('*')
        .order('total_net', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface AllTimeRow extends StandingsRowData {
  avg_net: number;
  weeks_played: number;
  weeks_at_one: number;
  is_active: boolean;
}

const collator = new Intl.Collator('ka');

/**
 * The all-time view reshaped into board rows, so the same StandingsRow renders
 * both scopes — one row component, one set of ranking rules, one heat scale.
 *
 * Ties share a rank and the next rank skips, exactly as on the weekly board
 * (§1.3). `movement` is always null: there is no "last week" to move against
 * when the scope *is* every week.
 */
export function useRankedAllTime(sort: AllTimeSort) {
  const query = useAllTimeStandings();

  const rows = useMemo<AllTimeRow[]>(() => {
    const key = (row: AllTimeStanding) => Number(row[sort]);

    const sorted = [...(query.data ?? [])].sort(
      (a, b) =>
        key(b) - key(a) ||
        b.total_net - a.total_net ||
        collator.compare(a.nickname, b.nickname),
    );

    let rank = 0;
    let prev = Number.NaN;

    return sorted.map((row, index) => {
      if (key(row) !== prev) {
        rank = index + 1; // the skip: index, not a running counter
        prev = key(row);
      }
      return {
        member_id: row.member_id,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        up: row.total_up,
        down: row.total_down,
        net: row.total_net,
        total_votes: row.total_up + row.total_down,
        rank,
        movement: null,
        avg_net: Number(row.avg_net),
        weeks_played: row.weeks_played,
        weeks_at_one: row.weeks_at_one,
        is_active: row.is_active,
      };
    });
  }, [query.data, sort]);

  /** Nothing has closed yet — the board would be twenty rows of zeroes. */
  const played = rows.some((row) => row.weeks_played > 0);

  return { rows, played, isPending: query.isPending };
}
