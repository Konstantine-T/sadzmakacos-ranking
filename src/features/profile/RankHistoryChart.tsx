import { Box, Paper, Stack, Typography } from '@mui/material';
import { EmptyState } from '@/components/Splash';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { WeeklyResult } from '@/lib/database.types';

/** The window the bars cover. Past this, a phone-width chart stops being read. */
const WINDOW = 8;

/**
 * Rank over the last eight weeks, as bars.
 *
 * A taller bar is a better rank — the height is inverted from the rank number,
 * so the chart rises when you do. That is the same trick the old inverted-axis
 * line chart played, minus the axis: on a 390px screen the gridlines and tick
 * labels cost more than they explained, and the rank sits under each bar
 * anyway. Gold marks a week at #1, ember the rest of the podium.
 */
export function RankHistoryChart({ results }: { results: WeeklyResult[] }) {
  if (results.length === 0) {
    return (
      <Paper sx={{ borderRadius: '16px' }}>
        <EmptyState text={ka.profile.noHistory} />
      </Paper>
    );
  }

  const window = results.slice(-WINDOW);
  const worst = Math.max(...window.map((r) => r.rank), 2);

  return (
    <Paper sx={{ borderRadius: '16px', p: 2 }}>
      <Stack spacing={1.75}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between">
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{ka.profile.history}</Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.profile.lastWeeks(window.length)}
          </Typography>
        </Stack>

        {/* The design gives the bars more air once the card is half a wide
            column rather than the whole phone. */}
        <Stack
          direction="row"
          spacing={{ xs: '6px', lg: '8px' }}
          alignItems="flex-end"
          sx={{ height: { xs: 96, lg: 132 } }}
        >
          {window.map((result) => {
            const first = result.rank === 1;
            const podium = result.rank <= 3;
            // 14% floor so last place still shows a bar rather than nothing.
            const height = 14 + ((worst - result.rank) / worst) * 86;

            return (
              <Stack
                key={result.week_id}
                spacing="6px"
                alignItems="center"
                sx={{ flex: 1, height: '100%' }}
                aria-label={`${ka.week.number(result.week_id)}: ${ka.standings.rank} ${result.rank}`}
              >
                <Box
                  sx={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}
                  aria-hidden
                >
                  <Box
                    sx={{
                      width: '100%',
                      height: `${height}%`,
                      borderRadius: '4px 4px 2px 2px',
                      bgcolor: first
                        ? signal.gold
                        : podium
                          ? 'rgba(247,55,24,0.62)'
                          : 'surface2',
                    }}
                  />
                </Box>
                <Typography
                  aria-hidden
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: first ? signal.gold : 'textMute',
                  }}
                >
                  {result.rank}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}
