import { Avatar, Box, Stack, Typography } from '@mui/material';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { SurvivalRow } from './api';

interface SurvivalBoardProps {
  rows: SurvivalRow[];
  myId: string | undefined;
  /** Show only the first N rows — the preview on the game page. */
  limit?: number;
}

/**
 * One category's high-score board.
 *
 * The same row grammar as the flag board — repeating rank numerals on a tie,
 * gold for #1, your own row tinted — so the games read as siblings. The number
 * is a streak.
 *
 * `limit` cuts by position, not by rank: a four-way tie for #3 still shows four
 * rows, and the full board is one tap away.
 */
export function SurvivalBoard({ rows, myId, limit }: SurvivalBoardProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled" sx={{ px: 1, py: 1.25 }}>
        {ka.survival.empty}
      </Typography>
    );
  }

  const shown = limit === undefined ? rows : rows.slice(0, limit);

  return (
    <Stack>
      {shown.map((row) => {
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
              {ka.survival.plays(row.plays)}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
