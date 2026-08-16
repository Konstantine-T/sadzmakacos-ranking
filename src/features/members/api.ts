import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Member, MemberBadge, WeeklyResult } from '@/lib/database.types';
import { meQueryKey } from '@/app/providers/AuthProvider';

export const memberKeys = {
  all: ['members'] as const,
  one: (id: string) => ['member', id] as const,
  results: (id: string) => ['memberResults', id] as const,
  badges: (id: string) => ['memberBadges', id] as const,
  allBadges: ['badges'] as const,
};

/**
 * Every member, cached. Twenty rows — cheaper to hold the whole roster and
 * join client-side than to embed relations in every other query.
 */
export function useMembers() {
  return useQuery({
    queryKey: memberKeys.all,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('nickname', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMemberMap() {
  const query = useMembers();
  const map = useMemo(
    () => new Map((query.data ?? []).map((m) => [m.id, m])),
    [query.data],
  );
  return { map, ...query };
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: memberKeys.one(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<Member | null> => {
      const { data, error } = await supabase.from('members').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Every closed-week result for one member — the rank-history chart and table. */
export function useMemberResults(id: string | undefined) {
  return useQuery({
    queryKey: memberKeys.results(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<WeeklyResult[]> => {
      const { data, error } = await supabase
        .from('weekly_results')
        .select('*')
        .eq('member_id', id!)
        .order('week_id', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMemberBadges(id: string | undefined) {
  return useQuery({
    queryKey: memberKeys.badges(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<MemberBadge[]> => {
      const { data, error } = await supabase
        .from('member_badges')
        .select('*')
        .eq('member_id', id!)
        .order('awarded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The whole badge wall, for /all-time. */
export function useAllBadges() {
  return useQuery({
    queryKey: memberKeys.allBadges,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MemberBadge[]> => {
      const { data, error } = await supabase
        .from('member_badges')
        .select('*')
        .order('awarded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Editing your own row. Column-level GRANTs mean this UPDATE can only ever
 * touch nickname / bio / avatar_url, whatever the client sends.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: {
      id: string;
      nickname?: string;
      bio?: string | null;
      avatar_url?: string | null;
    }) => {
      const { id, ...fields } = patch;
      const { error } = await supabase.from('members').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, patch) => {
      queryClient.invalidateQueries({ queryKey: meQueryKey });
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      queryClient.invalidateQueries({ queryKey: memberKeys.one(patch.id) });
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
  });
}
