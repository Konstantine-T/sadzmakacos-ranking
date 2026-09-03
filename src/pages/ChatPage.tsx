import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, ButtonBase, Divider, Skeleton, Stack, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/SendRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { useMemberMap } from '@/features/members/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { MessageBubble } from '@/features/chat/MessageBubble';
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
import { ka } from '@/i18n/ka';

const MAX = 500;
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

  const [draft, setDraft] = useState('');
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

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    setTypingSelf(false);
    setPinned(true);
    send.mutate(body, {
      onError: (e) => {
        setDraft(body); // give it back rather than losing what they wrote
        toastError(e);
      },
    });
  };

  const typingLine =
    typing.length === 0
      ? null
      : typing.length === 1
        ? ka.chat.typingOne(typing[0])
        : typing.length === 2
          ? ka.chat.typingTwo(typing[0], typing[1])
          : ka.chat.typingMany(typing.length);

  return (
    <PageTransition>
      <Stack sx={{ height: '100%', minHeight: 0 }}>
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
                  onReact={(emoji) =>
                    toggle.mutate({ messageId: message.id, emoji }, { onError: toastError })
                  }
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

        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-end"
          sx={{
            p: 1.5,
            pb: 'calc(12px + env(safe-area-inset-bottom))',
            borderTop: '1px solid',
            borderColor: 'hairline',
            bgcolor: 'background.paper',
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            value={draft}
            placeholder={ka.chat.placeholder}
            inputProps={{ maxLength: MAX }}
            onChange={(e) => {
              setDraft(e.target.value);
              setTypingSelf(e.target.value.trim().length > 0);
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — but only with a
              // keyboard. On a phone Enter must insert a newline, or the
              // on-screen return key becomes a send button nobody asked for.
              if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                e.preventDefault();
                submit();
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          />
          <ButtonBase
            onClick={submit}
            disabled={draft.trim().length === 0 || send.isPending}
            aria-label={ka.chat.send}
            sx={{
              width: 44,
              height: 44,
              flex: 'none',
              borderRadius: 999,
              bgcolor: draft.trim() ? 'primary.main' : 'surface2',
              color: draft.trim() ? 'primary.contrastText' : 'text.disabled',
              transition: 'background-color .16s linear',
            }}
          >
            <SendIcon fontSize="small" />
          </ButtonBase>
        </Stack>
      </Stack>
    </PageTransition>
  );
}
