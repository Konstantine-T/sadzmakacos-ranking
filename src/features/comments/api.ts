import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Comment } from '@/lib/database.types';

export const commentKeys = {
  list: (weekId: number | undefined) => ['comments', weekId] as const,
};

/**
 * One thread per week, attached to the week rather than to any person (§1.5).
 * Soft-deleted rows still come back so the UI can render „წაშლილია".
 */
export function useComments(weekId: number | undefined) {
  return useQuery({
    queryKey: commentKeys.list(weekId),
    enabled: weekId !== undefined,
    staleTime: 15_000,
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('week_id', weekId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateComment(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc('create_comment', { p_body: body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(weekId) }),
  });
}

export function useUpdateComment(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('comments').update({ body }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(weekId) }),
  });
}

/** Soft delete — the row stays so the thread keeps its shape. */
export function useDeleteComment(weekId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(weekId) }),
  });
}
