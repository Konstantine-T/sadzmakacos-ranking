import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { standingsKeys } from '@/features/standings/api';
import { postKeys } from '@/features/posts/api';
import { reactionKeys } from '@/features/reactions/api';
import { pollKeys } from '@/features/polls/api';
import { weekKeys } from '@/features/week/api';
import { notificationKeys } from '@/features/notifications/api';
import { triviaKeys } from '@/features/trivia/api';
import { snakeKeys } from '@/features/snake/api';
import { chatKeys } from '@/features/chat/api';

type Signal =
  | 'votes'
  | 'post_vote'
  | 'post_reaction'
  | 'member_reaction'
  | 'posts'
  | 'polls'
  | 'weeks'
  | 'trivia'
  | 'snake'
  | 'chat'
  | 'chat_reaction';

const DEBOUNCE_MS = 400;

/**
 * The realtime layer (§5).
 *
 * Nobody can subscribe to `votes` — RLS would deliver each member only their
 * own rows, and publishing the table would leak the WAL besides. Instead the
 * identity-free `vote_events` / `score_events` tables carry a ping, and the
 * client answers by refetching the aggregate views.
 *
 * A burst of votes therefore causes ONE refetch, not one per vote.
 */
export function useRealtime(weekId: number | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // No early return on a missing week. The chat is not week-scoped, and
    // bailing here meant /chat subscribed to nothing at all — messages only
    // appeared on a refetch. Week-scoped invalidations are guarded individually
    // below instead.

    const pending = new Set<Signal>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      const signals = new Set(pending);
      pending.clear();

      if (signals.has('votes') && weekId !== undefined) {
        queryClient.invalidateQueries({ queryKey: standingsKeys.live(weekId) });
        queryClient.invalidateQueries({ queryKey: weekKeys.turnout(weekId) });
      }
      if (signals.has('post_vote') && weekId !== undefined) {
        queryClient.invalidateQueries({ queryKey: postKeys.scores(weekId) });
      }
      if (signals.has('post_reaction') && weekId !== undefined) {
        queryClient.invalidateQueries({ queryKey: reactionKeys.postCounts(weekId) });
      }
      if (signals.has('member_reaction') && weekId !== undefined) {
        queryClient.invalidateQueries({ queryKey: reactionKeys.memberCounts(weekId) });
      }
      if (signals.has('posts') && weekId !== undefined) {
        queryClient.invalidateQueries({ queryKey: postKeys.list(weekId) });
        queryClient.invalidateQueries({ queryKey: postKeys.scores(weekId) });
      }
      if (signals.has('polls')) {
        queryClient.invalidateQueries({ queryKey: pollKeys.active });
      }
      if (signals.has('chat')) {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages });
        queryClient.invalidateQueries({ queryKey: chatKeys.unread });
      }
      if (signals.has('chat_reaction')) {
        queryClient.invalidateQueries({ queryKey: chatKeys.reactions });
      }
      if (signals.has('snake')) {
        queryClient.invalidateQueries({ queryKey: snakeKeys.board });
      }
      if (signals.has('trivia')) {
        if (weekId !== undefined) {
          queryClient.invalidateQueries({ queryKey: triviaKeys.weekBoard(weekId) });
        }
        queryClient.invalidateQueries({ queryKey: triviaKeys.allTime });
      }
      /*
        Notifications need no subscription of their own — the table is
        deliberately out of the publication, for the same reason `votes` is.
        Every writer sits downstream of a signal already handled above, so any
        ping at all means the feed may have moved. Refetching both queries on
        every flush costs one small round trip per 400ms burst and keeps the
        badge honest without streaming per-member rows to anybody.
      */
      if (signals.size > 0) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list });
        queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
      }

      if (signals.has('weeks')) {
        // A week just closed or was adjusted — everything is suspect.
        queryClient.invalidateQueries({ queryKey: weekKeys.open });
        queryClient.invalidateQueries({ queryKey: weekKeys.all });
        queryClient.invalidateQueries({ queryKey: standingsKeys.prevRanks });
        if (weekId !== undefined) {
          queryClient.invalidateQueries({ queryKey: standingsKeys.live(weekId) });
        }
      }
    };

    const schedule = (signal: Signal) => {
      pending.add(signal);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel('ranki-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vote_events' },
        () => schedule('votes'),
      )
      // trivia_answers is never subscribed to — it is select-own, and
      // publishing it would stream every member's per-question answers to
      // every client, the same reason `votes` is not in the publication.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trivia_events' },
        () => schedule('trivia'),
      )
      // snake_scores is subscribed to DIRECTLY, unlike votes and trivia answers.
      // Every column in it is already on the leaderboard for everybody, so there
      // is no identity to protect and no event table to hide behind.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'snake_scores' },
        () => schedule('snake'),
      )
      // `messages` is signed, so it is published and subscribed to directly.
      // `message_reactions` is select-own and never published — chat_events
      // carries an identity-free ping for it, exactly as vote_events does.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => schedule('chat'),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_events' },
        () => schedule('chat_reaction'),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'score_events' },
        (payload) => {
          const kind = (payload.new as { kind?: Signal } | null)?.kind;
          if (kind) schedule(kind);
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () =>
        schedule('posts'),
      )
      // Safe to subscribe to directly, unlike `votes`: poll answers are signed,
      // so the stream carries nothing the UI does not already show.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_answers' }, () =>
        schedule('polls'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () =>
        schedule('polls'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks' }, () =>
        schedule('weeks'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        queryClient.invalidateQueries({ queryKey: weekKeys.announcements });
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [weekId, queryClient]);
}
