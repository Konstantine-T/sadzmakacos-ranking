import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Announcement, Week } from '@/lib/database.types';

export const weekKeys = {
  open: ['week', 'open'] as const,
  all: ['weeks'] as const,
  one: (id: number) => ['week', id] as const,
  turnout: (weekId: number | undefined) => ['turnout', weekId] as const,
  announcements: ['announcements'] as const,
  podiums: ['podiums'] as const,
};

export interface PodiumEntry {
  member_id: string;
  rank: number;
  net: number;
}

/** The single open week. Everything on the landing page hangs off this. */
export function useOpenWeek() {
  return useQuery({
    queryKey: weekKeys.open,
    staleTime: 60_000,
    queryFn: async (): Promise<Week | null> => {
      const { data, error } = await supabase
        .from('weeks')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useWeeks() {
  return useQuery({
    queryKey: weekKeys.all,
    staleTime: 60_000,
    queryFn: async (): Promise<Week[]> => {
      const { data, error } = await supabase
        .from('weeks')
        .select('*')
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeek(id: number | undefined) {
  return useQuery({
    queryKey: weekKeys.one(id ?? -1),
    enabled: id !== undefined && Number.isFinite(id),
    staleTime: 60_000,
    queryFn: async (): Promise<Week | null> => {
      const { data, error } = await supabase.from('weeks').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** "14/20 ხმა მიცემულია" (§5). */
export function useTurnout(weekId: number | undefined) {
  return useQuery({
    queryKey: weekKeys.turnout(weekId),
    enabled: weekId !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('week_turnout')
        .select('*')
        .eq('week_id', weekId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { week_id: weekId!, voters: 0, total_members: 0 };
    },
  });
}

/**
 * The top three of every closed week, in one query, keyed by week.
 *
 * The archive index used to be a list of dates you had to open to learn
 * anything. A week is remembered by who won it, so the podium comes to the
 * index instead. Read from `weekly_results`, which is the frozen snapshot
 * (rule 3) — never recomputed from votes.
 */
export function usePodiums() {
  return useQuery({
    queryKey: weekKeys.podiums,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<number, PodiumEntry[]>> => {
      const { data, error } = await supabase
        .from('weekly_results')
        .select('week_id, member_id, rank, net')
        .lte('rank', 3)
        .order('week_id', { ascending: false })
        .order('rank', { ascending: true });
      if (error) throw error;

      const byWeek = new Map<number, PodiumEntry[]>();
      for (const row of data ?? []) {
        const bucket = byWeek.get(row.week_id) ?? [];
        bucket.push({ member_id: row.member_id, rank: row.rank, net: row.net });
        byWeek.set(row.week_id, bucket);
      }
      return byWeek;
    },
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: weekKeys.announcements,
    staleTime: 120_000,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
