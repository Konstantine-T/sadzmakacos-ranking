import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Announcement, AuditEntry, PendingAccount } from '@/lib/database.types';
import { memberKeys } from '@/features/members/api';
import { weekKeys } from '@/features/week/api';
import { standingsKeys } from '@/features/standings/api';
import { postKeys } from '@/features/posts/api';

/**
 * Every mutation here is a security-definer RPC that writes to audit_log before
 * it returns. There are no admin RLS policies for INSERT/UPDATE/DELETE, so
 * these functions are the only door — an admin action that skipped its audit
 * row would have to be a new migration, not a new fetch call.
 */

export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  pending: ['admin', 'pending'] as const,
  matrix: (weekId: number) => ['admin', 'matrix', weekId] as const,
  audit: ['admin', 'audit'] as const,
  announcements: ['admin', 'announcements'] as const,
};

export interface DashboardStats {
  week_id: number | null;
  ends_at: string | null;
  is_paused: boolean;
  voters: number;
  total_members: number;
  votes_cast: number;
  posts: number;
  pending: number;
  unlinked: number;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard,
    staleTime: 15_000,
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('admin_dashboard');
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
  });
}

export function usePendingAccounts() {
  return useQuery({
    queryKey: adminKeys.pending,
    staleTime: 15_000,
    queryFn: async (): Promise<PendingAccount[]> => {
      const { data, error } = await supabase
        .from('pending_accounts')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAdminMutation<TArgs>(
  run: (args: TArgs) => Promise<void>,
  invalidate: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: adminKeys.audit });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
}

export function useLinkAccount() {
  return useAdminMutation(
    async ({ authUserId, memberId }: { authUserId: string; memberId: string }) => {
      const { error } = await supabase.rpc('admin_link_account', {
        p_auth_user_id: authUserId,
        p_member_id: memberId,
      });
      if (error) throw error;
    },
    [adminKeys.pending, memberKeys.all],
  );
}

export function useRejectAccount() {
  return useAdminMutation(async (authUserId: string) => {
    const { error } = await supabase.rpc('admin_reject_account', { p_auth_user_id: authUserId });
    if (error) throw error;
  }, [adminKeys.pending]);
}

export function useCreateMember() {
  return useAdminMutation(
    async ({ nickname, bio }: { nickname: string; bio?: string | null }) => {
      const { error } = await supabase.rpc('admin_create_member', {
        p_nickname: nickname,
        p_bio: bio ?? null,
      });
      if (error) throw error;
    },
    [memberKeys.all, ['standings']],
  );
}

export function useUpdateMember() {
  return useAdminMutation(
    async (patch: {
      memberId: string;
      nickname?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
      isActive?: boolean | null;
    }) => {
      const { error } = await supabase.rpc('admin_update_member', {
        p_member_id: patch.memberId,
        p_nickname: patch.nickname ?? null,
        p_bio: patch.bio ?? null,
        p_avatar_url: patch.avatarUrl ?? null,
        p_is_active: patch.isActive ?? null,
      });
      if (error) throw error;
    },
    [memberKeys.all, ['standings']],
  );
}

export function useUnlinkMember() {
  return useAdminMutation(async (memberId: string) => {
    const { error } = await supabase.rpc('admin_unlink_member', { p_member_id: memberId });
    if (error) throw error;
  }, [memberKeys.all, adminKeys.pending]);
}

/** The 20×20 grid: exactly who voted for whom. Admin only, by construction. */
export function useVoteMatrix(weekId: number | undefined) {
  return useQuery({
    queryKey: adminKeys.matrix(weekId ?? -1),
    enabled: weekId !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_vote_matrix', { p_week_id: weekId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetWeek() {
  return useAdminMutation(
    async ({
      weekId,
      endsAt,
      isPaused,
    }: {
      weekId: number;
      endsAt?: string | null;
      isPaused?: boolean | null;
    }) => {
      const { error } = await supabase.rpc('admin_set_week', {
        p_week_id: weekId,
        p_ends_at: endsAt ?? null,
        p_is_paused: isPaused ?? null,
      });
      if (error) throw error;
    },
    [weekKeys.open, weekKeys.all],
  );
}

export function useCloseWeek() {
  return useAdminMutation(async () => {
    const { error } = await supabase.rpc('admin_close_week');
    if (error) throw error;
  }, [weekKeys.open, weekKeys.all, standingsKeys.prevRanks, ['standings'], ['weekStandings']]);
}

export function useAdminDeletePost(weekId: number | undefined) {
  return useAdminMutation(async (postId: string) => {
    const { error } = await supabase.rpc('admin_delete_post', { p_post_id: postId });
    if (error) throw error;
  }, [postKeys.list(weekId), postKeys.scores(weekId)]);
}

export function useVoidVote(weekId: number | undefined) {
  return useAdminMutation(
    async ({ voterId, targetId }: { voterId: string; targetId: string }) => {
      const { error } = await supabase.rpc('admin_void_vote', {
        p_week_id: weekId!,
        p_voter_id: voterId,
        p_target_id: targetId,
      });
      if (error) throw error;
    },
    [adminKeys.matrix(weekId ?? -1), standingsKeys.live(weekId)],
  );
}

export function useUpdateResult() {
  return useAdminMutation(
    async ({
      weekId,
      memberId,
      up,
      down,
    }: {
      weekId: number;
      memberId: string;
      up: number;
      down: number;
    }) => {
      const { error } = await supabase.rpc('admin_update_result', {
        p_week_id: weekId,
        p_member_id: memberId,
        p_up: up,
        p_down: down,
      });
      if (error) throw error;
    },
    [['weekStandings'], ['allTime']],
  );
}

export function useAllAnnouncements() {
  return useQuery({
    queryKey: adminKeys.announcements,
    staleTime: 30_000,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateAnnouncement() {
  return useAdminMutation(async (body: string) => {
    const { error } = await supabase.rpc('admin_create_announcement', { p_body: body });
    if (error) throw error;
  }, [adminKeys.announcements, weekKeys.announcements]);
}

export function useSetAnnouncement() {
  return useAdminMutation(
    async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.rpc('admin_set_announcement', {
        p_id: id,
        p_is_active: isActive,
      });
      if (error) throw error;
    },
    [adminKeys.announcements, weekKeys.announcements],
  );
}

export function useAuditLog() {
  return useQuery({
    queryKey: adminKeys.audit,
    staleTime: 15_000,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
