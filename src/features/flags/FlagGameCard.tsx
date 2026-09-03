import { Button, Paper, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface FlagGameCardProps {
  /** The current leader's score, or 0 when nobody has played. */
  topStreak: number;
  /** Your own best, when you have one. */
  myBest: number | undefined;
  onOpen: () => void;
}

/**
 * The flag game's card on the games tab.
 *
 * Like the სნეიკი card and unlike the trivia one: no progress bar and no weekly
 * state, because this game has no week and nothing to finish. It shows the
 * streak to beat, which is the number that makes it worth opening.
 */
export function FlagGameCard({ topStreak, myBest, onOpen }: FlagGameCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.flags.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        {ka.flags.subtitle}
      </Typography>

      <Stack direction="row" spacing={3} sx={{ my: 1.75 }}>
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {topStreak}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.flags.board}
          </Typography>
        </Stack>
        {myBest !== undefined && (
          <Stack spacing={0.25}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {myBest}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ka.flags.best}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Button fullWidth variant="contained" sx={{ height: 48 }} onClick={onOpen}>
        {ka.flags.start}
      </Button>
    </Paper>
  );
}
