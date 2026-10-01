import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, ButtonBase, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { useMemberMap } from '@/features/members/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { MessageBubble } from '@/features/chat/MessageBubble';
import { Composer } from '@/features/chat/Composer';
import {
  useMarkChatRead,
  useMessageReactions,
  useMessages,
  useMyMessageReactions,
  useSendMessage,
  useToggleMessageReaction,
  useTyping,
} from '@/features/chat/api';
import { dayKey, formatDay } from '@/lib/time';
import type { Reaction } from '@/theme/tokens';
import { ka } from '@/i18n/ka';

/** A gap this long starts a new run even for the same author. */
const RUN_BREAK_MS = 5 * 60_000;

/**
 * ჩატი — one room.
 *
 * Two scroll behaviours make or break a chat, and they pull against each other:
 * a new message should pin you to the bottom when you are already there, and
 * must NOT yank you down when you have scrolled up to read. So the distance
 * from the bottom is measured before every render and only a reader within
 * ~80px of it gets auto-scrolled; everyone else gets a button instead.
 */
export function ChatPage() {
  const { member } = useAuth();
  const { toastError } = useToast();
  const { map: members } = useMemberMap();

  useRealtime(undefined);

  const messagesQuery = useMessages();
  const { byMessage } = useMessageReactions();
  const { mine } = useMyMessageReactions(member?.id);
  const send = useSendMessage();
  const toggle = useToggleMessageReaction(member?.id);
  const { typing, setTypingSelf } = useTyping(member?.id, member?.nickname);

  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const scroller = useRef<HTMLDivElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  const list = messagesQuery.data ?? [];
  const newest = list[list.length - 1]?.id;

  useMarkChatRead(true, newest);

  // Rows with their grouping decided once, rather than in the render loop.
  const rows = useMemo(
    () =>
      list.map((m, i) => {
        const before = list[i - 1];
        const sameAuthor = before?.author_id === m.author_id;
        const soonAfter =
          before !== undefined &&
          new Date(m.created_at).getTime() - new Date(before.created_at).getTime() < RUN_BREAK_MS;
        return {
          message: m,
          leading: !sameAuthor || !soonAfter,
          daySeparator: before === undefined || dayKey(before.created_at) !== dayKey(m.created_at),
        };
      }),
    [list],
  );

  // Measure before the browser paints, so the decision uses the pre-append
  // scroll position rather than the post-append one.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 80);
  }, [rows.length]);

  useEffect(() => {
    if (pinned) {
      bottom.current?.scrollIntoView({ behavior: 'auto' });
      setUnseen(0);
    } else {
      setUnseen((n) => n + 1);
    }
    // Only when the count changes — re-running on `pinned` would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const jumpToBottom = () => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
    setUnseen(0);
    setPinned(true);
  };

  const sendMutate = send.mutate;
  const sendBody = useCallback(
    (body: string, giveBack: () => void) => {
      setPinned(true);
      sendMutate(body, {
        onError: (e) => {
          giveBack(); // rather than losing what they wrote
          toastError(e);
        },
      });
    },
    [sendMutate, toastError],
  );

  // One callback for every bubble, so a memoized bubble sees the same prop on
  // every render and stays put. An inline arrow per row defeated that.
  const toggleMutate = toggle.mutate;
  const reactTo = useCallback(
    (messageId: number, emoji: Reaction) =>
      toggleMutate({ messageId, emoji }, { onError: toastError }),
    [toggleMutate, toastError],
  );

  const typingLine =
    typing.length === 0
      ? null
      : typing.length === 1
        ? ka.chat.typingOne(typing[0])
        : typing.length === 2
          ? ka.chat.typingTwo(typing[0], typing[1])
          : ka.chat.typingMany(typing.length);

  return (
    <PageTransition fill>
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <Box
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            setPinned(near);
            if (near) setUnseen(0);
          }}
          sx={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', pb: 1 }}
        >
          {messagesQuery.isPending ? (
            <Stack spacing={1} sx={{ p: 2 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: '16px' }} />
              ))}
            </Stack>
          ) : rows.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ borderRadius: '12px' }}>
                {ka.chat.empty}
              </Alert>
            </Box>
          ) : (
            rows.map(({ message, leading, daySeparator }) => (
              <Box key={message.id}>
                {daySeparator && (
                  <Divider sx={{ my: 1.5, mx: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {formatDay(message.created_at)}
                    </Typography>
                  </Divider>
                )}
                <MessageBubble
                  message={message}
                  author={members.get(message.author_id)}
                  mine={message.author_id === member?.id}
                  leading={leading}
                  counts={byMessage.get(message.id)}
                  myReactions={mine.get(message.id)}
                  onReact={reactTo}
                />
              </Box>
            ))
          )}
          <div ref={bottom} />
        </Box>

        {unseen > 0 && !pinned && (
          <Box sx={{ position: 'relative' }}>
            <ButtonBase
              onClick={jumpToBottom}
              sx={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                px: 2,
                height: 36,
                borderRadius: 999,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: 12.5,
                fontWeight: 700,
                boxShadow: 3,
              }}
            >
              {ka.chat.newMessages}
            </ButtonBase>
          </Box>
        )}

        <Box sx={{ px: 2, height: 18 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
            {typingLine ?? ''}
          </Typography>
        </Box>

        <Composer sending={send.isPending} onTyping={setTypingSelf} onSend={sendBody} />
      </Stack>
    </PageTransition>
  );
}
