import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers/AuthProvider';
import type { Notification, NotificationKind } from '@/lib/database.types';

/**
 * Notifications (§ in-app only — push and email remain non-goals).
 *
 * Unlike votes and reactions, there is nothing to hide here: RLS already
 * narrows `notifications` to rows addressed to you or broadcast to everyone,
 * and drops anything you caused yourself. So this layer does no filtering of
 * its own — the server decided what you may see, and a row that arrives here
 * is a row you are allowed to read.
 *
 * The bell count and the პოსტები chip are NOT two counters. Both come out of
 * `unread_counts()`: the bell sums it, the chip takes the 'post' entry. They
 * cannot disagree because they are the same rows counted once.
 */

/** How many rows the popover holds. Twenty people cannot outrun this. */
const FEED_LIMIT = 50;

export const notificationKeys = {
  list: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  reads: ['notifications', 'reads'] as const,
};

export type UnreadCounts = Record<NotificationKind, number>;

const NO_UNREAD: UnreadCounts = { post: 0, rank: 0, reaction: 0, post_vote: 0 };

export function useNotifications() {
  const { member } = useAuth();

  return useQuery({
    queryKey: notificationKeys.list,
    enabled: member?.id !== undefined,
    staleTime: 15_000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Drives both the bell badge and the nav chip. */
export function useUnreadCounts() {
  const { member } = useAuth();

  const query = useQuery({
    queryKey: notificationKeys.unread,
    enabled: member?.id !== undefined,
    staleTime: 15_000,
    queryFn: async (): Promise<UnreadCounts> => {
      const { data, error } = await supabase.rpc('unread_counts');
      if (error) throw error;

      const counts = { ...NO_UNREAD };
      for (const row of data ?? []) counts[row.kind] = row.unread;
      return counts;
    },
  });

  const counts = query.data ?? NO_UNREAD;
  const total = counts.post + counts.rank + counts.reaction + counts.post_vote;

  return { counts, total, ...query };
}

/**
 * The read cursors themselves, one per kind.
 *
 * Needed separately from the counts because the popover freezes them on open
 * to decide which rows still show a dot — see NotificationBell. Without this
 * the dots would vanish the instant you looked at them.
 */
export function useNotificationReads() {
  const { member } = useAuth();
  const memberId = member?.id;

  const query = useQuery({
    queryKey: notificationKeys.reads,
    enabled: memberId !== undefined,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_reads')
        .select('kind, read_at')
        .eq('member_id', memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  /** kind → the moment you last read that stream, or null if you never have. */
  const cursors = useMemo(() => {
    const map = new Map<NotificationKind, string>();
    for (const row of query.data ?? []) map.set(row.kind, row.read_at);
    return map;
  }, [query.data]);

  return { cursors, ...query };
}

/**
 * Advance one cursor, or all four.
 *
 * Called with 'post' when the posts tab opens and with nothing when the bell
 * opens. Because the chip is a slice of the same query, marking 'post' read
 * drops the bell total by exactly the same amount — the "one truth" rule.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kind?: NotificationKind) => {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_kind: kind ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
      queryClient.invalidateQueries({ queryKey: notificationKeys.reads });
    },
  });
}
