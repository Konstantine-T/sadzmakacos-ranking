import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers/AuthProvider';

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

/**
 * Whether a board row should render its reaction bar at all.
 *
 * Showing reactions and being able to add one are two different things, and
 * the board used to conflate them by gating on `onReact`. A closed week has no
 * `onReact` — `toggle_member_reaction` resolves the OPEN week server-side, so
 * an archived reaction can never change — but it still holds a week's worth of
 * counts that are the whole point of looking back at it.
 *
 * A member nobody reacted to that week gets no bar rather than an empty strip.
 */
export function showReactions(
  counts: Record<string, number> | undefined,
  interactive: boolean,
): boolean {
  if (interactive) return true;
  return counts !== undefined && Object.values(counts).some((count) => count > 0);
}

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

/**
 * Explicit `reactor_id` filter, not RLS: `member_reactions_select_own` is
 * `reactor_id = current_member_id() OR public.is_admin()`, so without it an
 * admin reads everyone's reactions and every emoji renders as already-mine.
 * See the note on useMyVotes in features/standings/api.ts.
 */
export function useMyMemberReactions(weekId: number | undefined) {
  const { member } = useAuth();
  const memberId = member?.id;

  const query = useQuery({
    queryKey: reactionKeys.myMember(weekId),
    enabled: weekId !== undefined && memberId !== undefined,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_reactions')
        .select('member_id, emoji')
        .eq('week_id', weekId!)
        .eq('reactor_id', memberId!);
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

/** Same reason as useMyMemberReactions: `or public.is_admin()` on the policy. */
export function useMyPostReactions() {
  const { member } = useAuth();
  const memberId = member?.id;

  const query = useQuery({
    queryKey: reactionKeys.myPost,
    enabled: memberId !== undefined,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('post_id, emoji')
        .eq('reactor_id', memberId!);
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
