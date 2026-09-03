import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, MessageReactionCount } from '@/lib/database.types';
import type { Reaction } from '@/theme/tokens';

/**
 * ჩატი's data layer.
 *
 * Two different secrecy contracts live side by side here, and keeping them
 * straight is the whole job:
 *
 *   * MESSAGES are signed. Everyone sees who said what, `messages` is published
 *     to realtime whole, and the client reads the table directly — the same
 *     arrangement `poll_answers` has, and for the same reason: a message is
 *     something you chose to say.
 *   * REACTIONS are not. `message_reactions` is select-own, exactly like
 *     post_reactions, so counts reach the client through an aggregate view and
 *     the identity behind them never does. That is why refreshing them needs
 *     the identity-free `chat_events` ping rather than a subscription to the
 *     rows themselves.
 *
 * "My reactions" carries an explicit `.eq('reactor_id', …)` filter even though
 * RLS already restricts the table. Never let RLS alone define "my rows".
 */

export const chatKeys = {
  messages: ['chat', 'messages'] as const,
  reactions: ['chat', 'reactions'] as const,
  myReactions: (memberId: string | undefined) => ['chat', 'myReactions', memberId] as const,
  unread: ['chat', 'unread'] as const,
};

/** How many messages the room keeps on screen. Twenty friends, not a support desk. */
export const PAGE_SIZE = 200;

export function useMessages() {
  return useQuery({
    queryKey: chatKeys.messages,
    staleTime: 30_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      // Newest-first from the database so LIMIT takes the right end; oldest-first
      // on screen, because that is the direction a conversation reads.
      return (data ?? []).slice().reverse();
    },
  });
}

export function useMessageReactions() {
  const counts = useQuery({
    queryKey: chatKeys.reactions,
    staleTime: 30_000,
    queryFn: async (): Promise<MessageReactionCount[]> => {
      const { data, error } = await supabase.from('message_reaction_counts').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  /** message id -> emoji -> count */
  const byMessage = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const r of counts.data ?? []) {
      const bucket = map.get(r.message_id) ?? {};
      bucket[r.emoji] = r.count;
      map.set(r.message_id, bucket);
    }
    return map;
  }, [counts.data]);

  return { byMessage, isPending: counts.isPending };
}

export function useMyMessageReactions(memberId: string | undefined) {
  const query = useQuery({
    queryKey: chatKeys.myReactions(memberId),
    enabled: memberId !== undefined,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('reactor_id', memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  /** message id -> the emoji you personally put on it */
  const mine = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const r of query.data ?? []) {
      const set = map.get(r.message_id) ?? new Set<string>();
      set.add(r.emoji);
      map.set(r.message_id, set);
    }
    return map;
  }, [query.data]);

  return { mine };
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('send_message', { p_body: body });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages });
    },
  });
}

export function useToggleMessageReaction(memberId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { messageId: number; emoji: Reaction }) => {
      const { error } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: vars.messageId,
        p_emoji: vars.emoji,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.reactions });
      queryClient.invalidateQueries({ queryKey: chatKeys.myReactions(memberId) });
    },
  });
}

/** The nav badge. Counts messages from other people since your cursor. */
export function useChatUnread() {
  return useQuery({
    queryKey: chatKeys.unread,
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('chat_unread');
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

/**
 * Move the read cursor while the room is open.
 *
 * Fires on mount and whenever a new message lands while you are looking, which
 * is what stops the badge counting things already on your screen.
 */
export function useMarkChatRead(active: boolean, newestId: number | undefined) {
  const queryClient = useQueryClient();
  const lastMarked = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    if (newestId !== undefined && lastMarked.current === newestId) return;
    lastMarked.current = newestId;
    void supabase.rpc('mark_chat_read').then(() => {
      queryClient.invalidateQueries({ queryKey: chatKeys.unread });
    });
  }, [active, newestId, queryClient]);
}

/**
 * Who is typing, over Realtime presence.
 *
 * This is the app's ONE deliberate exception to "useRealtime.ts is the only
 * Supabase channel". That rule exists to stop a second postgres_changes
 * subscription causing duplicate refetch storms — this channel carries no
 * postgres_changes, writes to no cache, and is created and torn down with the
 * chat screen. Typing is ephemeral by nature: presence state costs no table, no
 * rows and no prune job, and vanishes correctly when a phone goes to sleep.
 */
export function useTyping(memberId: string | undefined, nickname: string | undefined) {
  const [typing, setTyping] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!memberId || !nickname) return;

    const channel = supabase.channel('chat-typing', {
      config: { presence: { key: memberId } },
    });
    channelRef.current = channel;

    const read = () => {
      const state = channel.presenceState<{ nickname: string; typing: boolean }>();
      const names: string[] = [];
      for (const [key, entries] of Object.entries(state)) {
        if (key === memberId) continue; // your own typing is not news to you
        const latest = entries[entries.length - 1];
        if (latest?.typing) names.push(latest.nickname);
      }
      setTyping(names);
    };

    channel
      .on('presence', { event: 'sync' }, read)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ nickname, typing: false });
      });

    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [memberId, nickname]);

  /** Call on every keystroke. Self-clears, so there is no "stuck typing" state. */
  const setTypingSelf = (isTyping: boolean) => {
    const channel = channelRef.current;
    if (!channel || !nickname) return;
    void channel.track({ nickname, typing: isTyping });
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (isTyping) {
      stopTimer.current = setTimeout(() => {
        void channel.track({ nickname, typing: false });
      }, 3000);
    }
  };

  return { typing, setTypingSelf };
}
