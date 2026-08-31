import { Alert, Avatar, Box, Skeleton, Stack, Typography } from '@mui/material';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { TriviaBoardRow } from './api';

interface TriviaBoardProps {
  rows: TriviaBoardRow[];
  loading: boolean;
  myId: string | undefined;
  /** Cut the list short — the home card shows five. */
  limit?: number;
}

/**
 * A trivia leaderboard.
 *
 * Rank numerals repeat on a tie, on purpose: three people on 8 are all #3 and
 * the next player is #6. Only `correct` moves the number; `answered` orders
 * rows inside a shared rank and cannot.
 */
export function TriviaBoard({ rows, loading, myId, limit }: TriviaBoardProps) {
  if (loading) {
    return (
      <Stack spacing={0.5}>
        {Array.from({ length: limit ?? 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: '12px' }}>
        {ka.trivia.board.empty}
      </Alert>
    );
  }

  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <Stack>
      {shown.map((row) => {
        // Same two-step every board uses: storage path -> public URL, then the
        // colour/initial fallback for members with no avatar.
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
            {ka.trivia.board.score(row.correct, row.answered)}
          </Box>
        </Stack>
        );
      })}
    </Stack>
  );
}
