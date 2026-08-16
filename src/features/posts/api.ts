import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Post, PostScore } from '@/lib/database.types';
import type { VoteValue } from '@/features/standings/api';

export const postKeys = {
  list: (weekId: number | undefined) => ['posts', weekId] as const,
  scores: (weekId: number | undefined) => ['postScores', weekId] as const,
  myVotes: ['myPostVotes'] as const,
};

export function usePosts(weekId: number | undefined) {
  return useQuery({
    queryKey: postKeys.list(weekId),
    enabled: weekId !== undefined,
    staleTime: 30_000,
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('week_id', weekId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePostScores(weekId: number | undefined) {
  return useQuery({
    queryKey: postKeys.scores(weekId),
    enabled: weekId !== undefined,
    staleTime: 10_000,
    queryFn: async (): Promise<PostScore[]> => {
      const { data, error } = await supabase.from('post_scores').select('*').eq('week_id', weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** All of my post ballots. RLS scopes this to me; it stays tiny. */
export function useMyPostVotes() {
  return useQuery({
    queryKey: postKeys.myVotes,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, VoteValue>> => {
      const { data, error } = await supabase.from('post_votes').select('post_id, value');
      if (error) throw error;
      const map: Record<string, VoteValue> = {};
      for (const row of data ?? []) map[row.post_id] = row.value;
      return map;
    },
  });
}

export interface ScoredPost extends Post {
  up: number;
  down: number;
  net: number;
}

/** Posts sorted by net score descending (§1.4). */
export function useScoredPosts(weekId: number | undefined) {
  const posts = usePosts(weekId);
  const scores = usePostScores(weekId);

  const rows = useMemo<ScoredPost[]>(() => {
    if (!posts.data) return [];
    const byId = new Map((scores.data ?? []).map((s) => [s.post_id, s]));
    return posts.data
      .map((post) => {
        const score = byId.get(post.id);
        return {
          ...post,
          up: score?.up ?? 0,
          down: score?.down ?? 0,
          net: score?.net ?? 0,
        };
      })
      .sort((a, b) => b.net - a.net || b.up - a.up || a.created_at.localeCompare(b.created_at));
  }, [posts.data, scores.data]);

  return { rows, isPending: posts.isPending, isError: posts.isError };
}

export function useCreatePost(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc('create_post', { p_body: body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.list(weekId) });
      queryClient.invalidateQueries({ queryKey: postKeys.scores(weekId) });
    },
  });
}

/** Optimistic, same as person votes — self-voting on your own post is allowed. */
export function useVotePost(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, value }: { postId: string; value: VoteValue }) => {
      const { error } = await supabase.rpc('vote_post', { p_post_id: postId, p_value: value });
      if (error) throw error;
    },

    onMutate: async ({ postId, value }) => {
      const scoresKey = postKeys.scores(weekId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: scoresKey }),
        queryClient.cancelQueries({ queryKey: postKeys.myVotes }),
      ]);

      const prevScores = queryClient.getQueryData<PostScore[]>(scoresKey);
      const prevMine = queryClient.getQueryData<Record<string, VoteValue>>(postKeys.myVotes);

      const before = prevMine?.[postId] ?? null;
      const upDelta = (value === 1 ? 1 : 0) - (before === 1 ? 1 : 0);
      const downDelta = (value === -1 ? 1 : 0) - (before === -1 ? 1 : 0);

      if (prevMine) {
        const next = { ...prevMine };
        if (value === null) delete next[postId];
        else next[postId] = value;
        queryClient.setQueryData(postKeys.myVotes, next);
      }

      if (prevScores) {
        queryClient.setQueryData(
          scoresKey,
          prevScores.map((s) =>
            s.post_id === postId
              ? {
                  ...s,
                  up: s.up + upDelta,
                  down: s.down + downDelta,
                  net: s.net + upDelta - downDelta,
                }
              : s,
          ),
        );
      }

      return { prevScores, prevMine };
    },

    onError: (_error, _vars, context) => {
      if (context?.prevScores) {
        queryClient.setQueryData(postKeys.scores(weekId), context.prevScores);
      }
      if (context?.prevMine) queryClient.setQueryData(postKeys.myVotes, context.prevMine);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.scores(weekId) });
      queryClient.invalidateQueries({ queryKey: postKeys.myVotes });
    },
  });
}
