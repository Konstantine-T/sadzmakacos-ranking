import { Box, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '@/components/Splash';
import { HeatBar } from '@/features/standings/HeatBar';
import { maxTotalVotes } from '@/lib/ranking';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { WeeklyResult } from '@/lib/database.types';

/**
 * Every closed week, newest first.
 *
 * This was a five-column table, which on a 390px screen meant five numbers
 * competing at the same weight. It is now one row per week carrying the same
 * facts in the board's own language: the rank, the diverging bar, the net. The
 * ▲/▼ columns are gone because the bar already says it, and says it faster.
 */
export function WeekBreakdownTable({ results }: { results: WeeklyResult[] }) {
  if (results.length === 0) {
    return (
      <Paper sx={{ borderRadius: '16px' }}>
        <EmptyState text={ka.profile.noHistory} />
      </Paper>
    );
  }

  const max = maxTotalVotes(results);
  const rows = [...results].reverse();

  return (
    <Paper sx={{ borderRadius: '16px', overflow: 'hidden' }}>
      <Typography
        sx={{
          fontSize: 15,
          fontWeight: 600,
          p: 1.75,
          borderBottom: '1px solid',
          borderColor: 'surface2',
        }}
      >
        {ka.profile.breakdown}
      </Typography>

      {rows.map((row) => (
        <Stack
          key={row.week_id}
          component={RouterLink}
          to={`/weeks/${row.week_id}`}
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            px: 1.75,
            py: 1.4,
            borderBottom: '1px solid',
            borderColor: 'hairline',
            textDecoration: 'none',
            color: 'inherit',
            '&:last-of-type': { borderBottom: 0 },
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ width: 56, flex: 'none' }}>
            {ka.week.number(row.week_id)}
          </Typography>

          <Typography
            variant="numeral"
            sx={{
              width: 26,
              flex: 'none',
              fontSize: 14,
              color: row.rank === 1 ? signal.gold : 'text.primary',
            }}
          >
            {row.rank}
          </Typography>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <HeatBar
              up={row.up}
              down={row.down}
              max={max}
              height={4}
              rounded
              upColor={row.rank === 1 ? signal.gold : undefined}
              label={`${row.up} ${ka.standings.up}, ${row.down} ${ka.standings.down}`}
            />
          </Box>

          <Typography
            sx={{
              width: 36,
              flex: 'none',
              textAlign: 'right',
              fontSize: 12.5,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: row.net >= 0 ? 'signal.up' : 'signal.down',
            }}
          >
            {row.net > 0 ? `+${row.net}` : row.net}
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
}
