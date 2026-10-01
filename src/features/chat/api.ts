import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, MessageReactionCount } from '@/lib/database.types';
import type { Reaction } from '@/theme/tokens';
import { PAGE_SIZE, mergeFetched, upsertRow } from './room';

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

export function useMessages() {
  const queryClient = useQueryClient();
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
      // Merged with the cache rather than replacing it, so a row realtime
      // patched in while this request was in flight survives (room.ts).
      return mergeFetched(
        (data ?? []).slice().reverse(),
        queryClient.getQueryData<ChatMessage[]>(chatKeys.messages) ?? [],
      );
    },
  });
}

/**
 * Fold one realtime row into the cached room, or take one out.
 *
 * `messages` is published whole, so the payload IS the row and a refetch would
 * add nothing. Invalidating instead waited out the 400ms debounce and then
 * pulled all two hundred rows again before anything appeared — the delay
 * between someone sending and you seeing it. No cache yet means the room has
 * never been opened, and its first fetch will include the row anyway.
 */
export function upsertMessage(queryClient: QueryClient, row: ChatMessage) {
  queryClient.setQueryData<ChatMessage[]>(chatKeys.messages, (old) =>
    old ? upsertRow(old, row) : old,
  );
}

export function removeMessage(queryClient: QueryClient, id: number) {
  queryClient.setQueryData<ChatMessage[]>(chatKeys.messages, (old) =>
    old?.filter((m) => m.id !== id),
  );
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
 *
 * Presence is sent on the EDGES only — when you start typing and when you stop
 * — never per keystroke. Each `track()` is a websocket message that fans out as
 * a sync to everyone with the room open, and every sync used to re-render each
 * of their rooms. Tracking per keystroke turned one person typing into a stream
 * of full re-renders on every phone in the group.
 */
export function useTyping(memberId: string | undefined, nickname: string | undefined) {
  const [typing, setTyping] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** What we last told the channel, so a keystroke that changes nothing sends nothing. */
  const sent = useRef(false);

  useEffect(() => {
    if (!memberId || !nickname) return;

    const channel = supabase.channel('chat-typing', {
      config: { presence: { key: memberId } },
    });
    channelRef.current = channel;
    sent.current = false;

    const read = () => {
      const state = channel.presenceState<{ nickname: string; typing: boolean }>();
      const names: string[] = [];
      for (const [key, entries] of Object.entries(state)) {
        if (key === memberId) continue; // your own typing is not news to you
        const latest = entries[entries.length - 1];
        if (latest?.typing) names.push(latest.nickname);
      }
      // A sync that changes nobody's state must not re-render the room.
      setTyping((prev) =>
        prev.length === names.length && prev.every((n, i) => n === names[i]) ? prev : names,
      );
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

  /**
   * Call on every keystroke — it sends only when the state flips. Self-clears
   * 3s after the last keystroke, so there is no "stuck typing" state.
   */
  const setTypingSelf = (isTyping: boolean) => {
    const channel = channelRef.current;
    if (!channel || !nickname) return;
    const announce = (value: boolean) => {
      if (sent.current === value) return;
      sent.current = value;
      void channel.track({ nickname, typing: value });
    };
    if (stopTimer.current) clearTimeout(stopTimer.current);
    announce(isTyping);
    if (isTyping) stopTimer.current = setTimeout(() => announce(false), 3000);
  };

  return { typing, setTypingSelf };
}
