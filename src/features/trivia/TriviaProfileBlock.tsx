import { Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useTriviaStats } from './api';
import { ka } from '@/i18n/ka';

interface TriviaProfileBlockProps {
  memberId: string | undefined;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 64 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * Trivia on a profile: four numbers, no board.
 *
 * Works for your own profile and for somebody else's — every number here is
 * already public on the leaderboard, so there is nothing to gate. Individual
 * answers are not among them and never will be.
 */
export function TriviaProfileBlock({ memberId }: TriviaProfileBlockProps) {
  const { stats, isPending } = useTriviaStats(memberId);

  if (isPending) return <Skeleton variant="rounded" height={96} />;

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5 }}>
        {ka.trivia.profile.title}
      </Typography>

      {!stats || stats.testsTaken === 0 ? (
        <Typography variant="caption" color="text.secondary">
          {ka.trivia.profile.empty}
        </Typography>
      ) : (
        <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
          <Stat value={stats.totalCorrect} label={ka.trivia.profile.totalCorrect} />
          <Stat value={stats.testsTaken} label={ka.trivia.profile.testsTaken} />
          <Stat value={stats.bestWeek} label={ka.trivia.profile.bestWeek} />
          <Stat value={stats.rank !== null ? `#${stats.rank}` : '—'} label={ka.trivia.profile.rank} />
        </Stack>
      )}
    </Paper>
  );
}
