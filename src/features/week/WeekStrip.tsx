import { useEffect, useState } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { WeekCountdown } from './WeekCountdown';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { Week } from '@/lib/database.types';
import type { StandingsRowData } from '@/features/standings/StandingsRow';

interface WeekStripProps {
  week: Week;
  /** The board, already ranked — only the top three are read. */
  rows: StandingsRowData[];
  onExpire?: () => void;
}

/** How much of the week is already gone, 0–100. */
function elapsedPct(week: Week, now: number): number {
  const start = new Date(week.starts_at).getTime();
  const end = new Date(week.ends_at).getTime();
  if (!(end > start)) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

/**
 * The week, laid out sideways.
 *
 * The phone stacks the same facts down a card because it has one column. Given
 * a wide main column they sit in a single band — close time, countdown, and the
 * current podium — so the state of the week is one glance above the board
 * instead of a scroll before it.
 */
export function WeekStrip({ week, rows, onExpire }: WeekStripProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // A minute is plenty for a bar that takes a week to cross the card.
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Paper
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        // The week card is the one lit surface on the page — a diagonal warm
        // gradient, not the flat paper every other card uses.
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(120deg, #241C1A 0%, #1E1918 58%)'
            : t.palette.background.paper,
      }}
    >
      <Box sx={{ height: 2, bgcolor: 'surface2' }}>
        <Box
          sx={{
            height: '100%',
            width: `${elapsedPct(week, now)}%`,
            background: (t) =>
              `linear-gradient(90deg, rgba(247,55,24,0.25), ${t.palette.primary.main})`,
            transition: 'width .6s linear',
          }}
        />
      </Box>

      {/* Wraps rather than overflows: at 1440 the right rail leaves ~800px
          here, which the close time, countdown and podium only just fill. If
          they don't, the podium drops to a second line instead of clipping. */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={3}
        useFlexGap
        flexWrap="wrap"
        sx={{ p: 2.5, rowGap: 2 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 150 }}>
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: 'text.secondary',
            }}
          >
            {ka.week.closes}
          </Typography>
          <Typography variant="h3" sx={{ fontFamily: (t) => t.typography.h1.fontFamily }}>
            {formatDateTime(week.ends_at)}
          </Typography>
        </Stack>

        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: 'divider' }} />

        <WeekCountdown endsAt={week.ends_at} size="wide" onExpire={onExpire} />

        <Box sx={{ flexGrow: 1 }} />

        {week.is_paused ? (
          <Alert severity="warning" variant="outlined" sx={{ borderRadius: '12px', flex: 'none' }}>
            {ka.week.paused}
          </Alert>
        ) : (
          <Stack direction="row" spacing={1.25} sx={{ flex: 'none' }}>
            {rows.slice(0, 3).map((row) => {
              const first = row.rank === 1;
              return (
                <Stack
                  key={row.member_id}
                  spacing={0.75}
                  sx={{
                    width: 104,
                    p: 1.25,
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: first ? 'rgba(255,206,92,0.34)' : 'divider',
                    // Recessed, not raised: the podium sits *inside* the strip's
                    // own gradient, so it has to be darker than the card it is
                    // on, which `surface2` is not.
                    bgcolor: first
                      ? 'rgba(255,206,92,0.08)'
                      : (t) => (t.palette.mode === 'dark' ? '#1A1514' : t.palette.surface2),
                  }}
                >
                  <Typography
                    variant="numeral"
                    sx={{ fontSize: 12, color: first ? signal.gold : 'textMute' }}
                  >
                    #{row.rank}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                    {row.nickname}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: row.net >= 0 ? 'signal.up' : 'signal.down',
                    }}
                  >
                    {row.net > 0 ? `+${row.net}` : row.net}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
