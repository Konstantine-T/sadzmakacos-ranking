import { Paper, Typography } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme } from '@mui/material/styles';
import { EmptyState } from '@/components/Splash';
import { ka } from '@/i18n/ka';
import type { WeeklyResult } from '@/lib/database.types';

/**
 * Rank over time with an INVERTED y-axis, so rank 1 sits at the top where it
 * belongs and a rising line means you are doing better — the opposite of what
 * a naive chart of the same numbers would show.
 */
export function RankHistoryChart({ results }: { results: WeeklyResult[] }) {
  const theme = useTheme();

  if (results.length === 0) {
    return (
      <Paper sx={{ borderRadius: 3 }}>
        <EmptyState text={ka.profile.noHistory} />
      </Paper>
    );
  }

  const weeks = results.map((r) => r.week_id);
  const ranks = results.map((r) => r.rank);
  const worst = Math.max(...ranks);

  return (
    <Paper sx={{ borderRadius: 3, p: 1, pt: 2 }}>
      <Typography variant="h3" sx={{ px: 1.5, mb: 1 }}>
        {ka.profile.history}
      </Typography>

      <LineChart
        height={220}
        margin={{ left: 44, right: 16, top: 8, bottom: 32 }}
        xAxis={[
          {
            data: weeks,
            scaleType: 'point',
            valueFormatter: (value: number) => String(value),
          },
        ]}
        yAxis={[
          {
            reverse: true, // rank 1 on top
            min: 1,
            max: Math.max(worst, 2),
            tickMinStep: 1,
          },
        ]}
        series={[
          {
            data: ranks,
            label: ka.standings.rank,
            color: theme.palette.primary.main,
            curve: 'monotoneX',
            showMark: true,
            valueFormatter: (value: number | null) => (value === null ? '' : `#${value}`),
          },
        ]}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: theme.palette.divider },
          '& .MuiChartsAxis-tickLabel': { fill: theme.palette.text.secondary, fontSize: 12 },
        }}
      />
    </Paper>
  );
}
