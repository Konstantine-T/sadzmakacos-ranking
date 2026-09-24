import { Button, Paper, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface SurvivalGameCardProps {
  /** The ყველა board's leading streak, or 0 when nobody has played. */
  topStreak: number;
  /** Your own ყველა best, when you have one. */
  myBest: number | undefined;
  onOpen: () => void;
}

/**
 * The survival game's card on the games tab.
 *
 * Same shape as the flag card: no week and nothing to finish, just the streak
 * to beat. Only the mixed (ყველა) board is quoted here — eleven numbers do not
 * fit a card, and the mixed board is the headline one.
 */
export function SurvivalGameCard({ topStreak, myBest, onOpen }: SurvivalGameCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.survival.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        {ka.survival.subtitle}
      </Typography>

      <Stack direction="row" spacing={3} sx={{ my: 1.75 }}>
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {topStreak}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.survival.leader}
          </Typography>
        </Stack>
        {myBest !== undefined && (
          <Stack spacing={0.25}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {myBest}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ka.survival.best}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Button fullWidth variant="contained" sx={{ height: 48 }} onClick={onOpen}>
        {ka.survival.start}
      </Button>
    </Paper>
  );
}
