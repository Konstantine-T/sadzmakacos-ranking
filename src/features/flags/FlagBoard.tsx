import { Alert, Avatar, Box, Skeleton, Stack, Typography } from '@mui/material';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { FlagRow } from './api';

interface FlagBoardProps {
  rows: FlagRow[];
  loading: boolean;
  myId: string | undefined;
}

/**
 * The flag game's high-score board.
 *
 * Deliberately the same row grammar as the snake and trivia boards — repeating
 * rank numerals on a tie, gold for #1, your own row tinted — so all three read
 * as siblings even though they rank different quantities and share no code.
 * The number here is a streak.
 */
export function FlagBoard({ rows, loading, myId }: FlagBoardProps) {
  if (loading) {
    return (
      <Stack spacing={0.5}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: '12px' }}>
        {ka.flags.empty}
      </Alert>
    );
  }

  return (
    <Stack>
      {rows.map((row) => {
        const ava = avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url));
        return (
          <Stack
            key={row.member_id}
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{
              minHeight: 48,
              px: 1,
              borderBottom: '1px solid',
              borderColor: 'hairline',
              bgcolor: row.member_id === myId ? 'rgba(247,55,24,0.07)' : 'transparent',
              borderRadius: row.member_id === myId ? '8px' : 0,
            }}
          >
            <Box
              component="span"
              sx={{
                width: 22,
                textAlign: 'right',
                flex: 'none',
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: (t) => (row.rank === 1 ? t.palette.signal.gold : 'text.disabled'),
              }}
            >
              {row.rank}
            </Box>

            <Avatar {...ava} sx={{ ...ava.sx, width: 28, height: 28, fontSize: '0.8rem' }} />

            <Typography
              sx={{
                flex: 1,
                fontSize: 14,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {row.nickname}
            </Typography>

            <Box
              component="span"
              sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {row.best_streak}
            </Box>
            <Box
              component="span"
              sx={{ fontSize: 11, color: 'text.disabled', minWidth: 58, textAlign: 'right' }}
            >
              {ka.flags.plays(row.plays)}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
