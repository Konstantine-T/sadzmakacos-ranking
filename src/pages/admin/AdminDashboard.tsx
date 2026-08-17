import { Box, Paper, Stack, Typography } from '@mui/material';
import { Splash } from '@/components/Splash';
import { useAdminDashboard } from '@/features/admin/api';
import { countdownTo, formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

function Tile({ value, label, warn }: { value: string | number; label: string; warn?: boolean }) {
  return (
    <Paper sx={{ borderRadius: 3, p: 2, flex: '1 1 30%', minWidth: 96 }}>
      <Typography
        variant="numeral"
        sx={{ fontSize: 26, color: warn ? 'primary.main' : 'text.primary' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Paper>
  );
}

export function AdminDashboard() {
  const dashboard = useAdminDashboard();

  if (dashboard.isPending) return <Splash />;
  const stats = dashboard.data;
  if (!stats) return null;

  const countdown = stats.ends_at ? countdownTo(stats.ends_at) : null;
  const timeLeft = countdown
    ? countdown.done
      ? ka.week.finished
      : `${countdown.days}${ka.week.days} ${countdown.hours}${ka.week.hours}`
    : '–';

  return (
    <Stack spacing={2} sx={{ px: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Tile
          value={`${stats.voters}/${stats.total_members}`}
          label={ka.admin.stats.turnout}
        />
        <Tile value={stats.votes_cast} label={ka.admin.stats.votesCast} />
        <Tile value={timeLeft} label={ka.admin.stats.timeLeft} />
        <Tile value={stats.posts} label={ka.admin.stats.posts} />
        <Tile value={stats.pending} label={ka.admin.stats.pending} warn={stats.pending > 0} />
        <Tile value={stats.unlinked} label={ka.admin.stats.unlinked} warn={stats.unlinked > 0} />
      </Box>

      {stats.ends_at && (
        <Typography variant="caption" color="text.secondary">
          {ka.admin.endsAt}: {formatDateTime(stats.ends_at)}
          {stats.is_paused ? ` · ${ka.week.paused}` : ''}
        </Typography>
      )}
    </Stack>
  );
}
