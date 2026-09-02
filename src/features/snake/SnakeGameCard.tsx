import { Button, Paper, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface SnakeGameCardProps {
  /** The current leader's score, or 0 when nobody has played. */
  topScore: number;
  /** Your own best, when you have one. */
  myBest: number | undefined;
  onOpen: () => void;
}

/**
 * The სნეიკი card on the games tab.
 *
 * Deliberately quieter than the trivia card: no progress bar, no weekly state,
 * because snake has no week and nothing to finish. It shows the record to beat,
 * which is the only number that makes a silly game worth opening.
 */
export function SnakeGameCard({ topScore, myBest, onOpen }: SnakeGameCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.snake.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        {ka.snake.subtitle}
      </Typography>

      <Stack direction="row" spacing={3} sx={{ my: 1.75 }}>
        <Stack spacing={0.25}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {topScore}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.snake.board}
          </Typography>
        </Stack>
        {myBest !== undefined && (
          <Stack spacing={0.25}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {myBest}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {ka.snake.best}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Button fullWidth variant="contained" sx={{ height: 48 }} onClick={onOpen}>
        {ka.snake.start}
      </Button>
    </Paper>
  );
}
