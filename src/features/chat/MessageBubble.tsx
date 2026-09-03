import { useState } from 'react';
import { Avatar, Box, ButtonBase, Popover, Stack, Typography } from '@mui/material';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { formatClock } from '@/lib/time';
import { REACTIONS, type Reaction } from '@/theme/tokens';
import { ka } from '@/i18n/ka';
import type { ChatMessage, Member } from '@/lib/database.types';

interface MessageBubbleProps {
  message: ChatMessage;
  author: Member | undefined;
  mine: boolean;
  /** First of a run by the same author — the one that carries avatar and name. */
  leading: boolean;
  counts: Record<string, number> | undefined;
  myReactions: Set<string> | undefined;
  onReact: (emoji: Reaction) => void;
}

/**
 * One message.
 *
 * Consecutive messages from the same person collapse into a run: only the first
 * carries an avatar and a name, the rest are bare bubbles. That grouping is most
 * of what makes a chat read like a conversation rather than a log, and it costs
 * one boolean.
 *
 * Reactions are shown as counts with no names, and your own are outlined. That
 * is not an oversight — `message_reactions` is select-own for the same reason
 * post_reactions is, so who reacted is genuinely not knowable here.
 */
export function MessageBubble({
  message,
  author,
  mine,
  leading,
  counts,
  myReactions,
  onReact,
}: MessageBubbleProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const deleted = message.deleted_at !== null;
  const ava = author
    ? avatarProps(author.id, author.nickname, avatarUrl(author.avatar_url))
    : undefined;

  const entries = Object.entries(counts ?? {}).filter(([, n]) => n > 0);

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ px: 2, pt: leading ? 1.25 : 0.25, alignItems: 'flex-end' }}
      justifyContent={mine ? 'flex-end' : 'flex-start'}
    >
      {!mine &&
        (leading && ava ? (
          <Avatar {...ava} sx={{ ...ava.sx, width: 28, height: 28, fontSize: '0.75rem' }} />
        ) : (
          <Box sx={{ width: 28, flex: 'none' }} />
        ))}

      <Stack sx={{ maxWidth: '78%', minWidth: 0 }} alignItems={mine ? 'flex-end' : 'flex-start'}>
        {leading && !mine && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', pl: 1, pb: 0.25, fontWeight: 600 }}
          >
            {author?.nickname ?? '—'}
          </Typography>
        )}

        <ButtonBase
          disabled={deleted}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            display: 'block',
            textAlign: 'left',
            px: 1.5,
            py: 1,
            borderRadius: '16px',
            // The tail corner points at the speaker, the Messenger convention.
            borderBottomRightRadius: mine ? '4px' : '16px',
            borderBottomLeftRadius: mine ? '16px' : '4px',
            bgcolor: mine ? 'primary.main' : 'surface2',
            color: mine ? 'primary.contrastText' : 'text.primary',
            opacity: deleted ? 0.5 : 1,
          }}
        >
          <Typography
            sx={{
              fontSize: 14.5,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontStyle: deleted ? 'italic' : 'normal',
            }}
          >
            {deleted ? ka.chat.deleted : message.body}
          </Typography>
        </ButtonBase>

        {entries.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
            {entries.map(([emoji, n]) => {
              const isMine = myReactions?.has(emoji) ?? false;
              return (
                <ButtonBase
                  key={emoji}
                  onClick={() => onReact(emoji as Reaction)}
                  sx={{
                    px: 0.75,
                    height: 24,
                    borderRadius: 999,
                    gap: 0.5,
                    fontSize: 12,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: isMine ? 'primary.main' : 'hairline',
                  }}
                >
                  <Box component="span">{emoji}</Box>
                  <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
                </ButtonBase>
              );
            })}
          </Stack>
        )}

        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10.5, px: 1, pt: 0.25 }}>
          {formatClock(message.created_at)}
        </Typography>
      </Stack>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { borderRadius: 999, p: 0.5 } } }}
      >
        <Stack direction="row" spacing={0.25}>
          {REACTIONS.map((emoji) => (
            <ButtonBase
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setAnchor(null);
              }}
              sx={{ width: 44, height: 44, borderRadius: 999, fontSize: 20 }}
            >
              {emoji}
            </ButtonBase>
          ))}
        </Stack>
      </Popover>
    </Stack>
  );
}
