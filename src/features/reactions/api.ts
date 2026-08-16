import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Reactions follow the same contract as votes: counts are public, identity is
 * not. Counts come from the aggregate views; `my*` comes from the raw tables,
 * which RLS scopes to your own rows.
 */

export const reactionKeys = {
  memberCounts: (weekId: number | undefined) => ['reactions', 'member', weekId] as const,
  myMember: (weekId: number | undefined) => ['reactions', 'myMember', weekId] as const,
  postCounts: (weekId: number | undefined) => ['reactions', 'post', weekId] as const,
  myPost: ['reactions', 'myPost'] as const,
};

/** target id → { emoji: count } */
export type CountsByTarget = Map<string, Record<string, number>>;
/** target id → the emoji *you* have on it */
export type MineByTarget = Map<string, Set<string>>;

export const NO_REACTIONS: Set<string> = new Set();

function groupMine(rows: { emoji: string }[], idOf: (row: never) => string): MineByTarget {
  const map: MineByTarget = new Map();
  for (const row of rows) {
    const id = idOf(row as never);
    const bucket = map.get(id) ?? new Set<string>();
    bucket.add(row.emoji);
    map.set(id, bucket);
  }
  return map;
}

export function useMemberReactionCounts(weekId: number | undefined) {
  const query = useQuery({
    queryKey: reactionKeys.memberCounts(weekId),
    enabled: weekId !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_reaction_counts')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo<CountsByTarget>(() => {
    const map: CountsByTarget = new Map();
    for (const row of query.data ?? []) {
      const bucket = map.get(row.member_id) ?? {};
      bucket[row.emoji] = row.count;
      map.set(row.member_id, bucket);
    }
    return map;
  }, [query.data]);

  return { counts, ...query };
}

export function useMyMemberReactions(weekId: number | undefined) {
  const query = useQuery({
    queryKey: reactionKeys.myMember(weekId),
    enabled: weekId !== undefined,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_reactions')
        .select('member_id, emoji')
        .eq('week_id', weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = useMemo(
    () => groupMine(query.data ?? [], (r: { member_id: string }) => r.member_id),
    [query.data],
  );

  return { mine, ...query };
}

export function usePostReactionCounts(weekId: number | undefined) {
  const query = useQuery({
    queryKey: reactionKeys.postCounts(weekId),
    enabled: weekId !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_reaction_counts')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo<CountsByTarget>(() => {
    const map: CountsByTarget = new Map();
    for (const row of query.data ?? []) {
      const bucket = map.get(row.post_id) ?? {};
      bucket[row.emoji] = row.count;
      map.set(row.post_id, bucket);
    }
    return map;
  }, [query.data]);

  return { counts, ...query };
}

export function useMyPostReactions() {
  const query = useQuery({
    queryKey: reactionKeys.myPost,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('post_reactions').select('post_id, emoji');
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = useMemo(
    () => groupMine(query.data ?? [], (r: { post_id: string }) => r.post_id),
    [query.data],
  );

  return { mine, ...query };
}

export function useToggleMemberReaction(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, emoji }: { memberId: string; emoji: string }) => {
      const { data, error } = await supabase.rpc('toggle_member_reaction', {
        p_member_id: memberId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reactionKeys.memberCounts(weekId) });
      queryClient.invalidateQueries({ queryKey: reactionKeys.myMember(weekId) });
    },
  });
}

export function useTogglePostReaction(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      const { data, error } = await supabase.rpc('toggle_post_reaction', {
        p_post_id: postId,
        p_emoji: emoji,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reactionKeys.postCounts(weekId) });
      queryClient.invalidateQueries({ queryKey: reactionKeys.myPost });
    },
  });
}
