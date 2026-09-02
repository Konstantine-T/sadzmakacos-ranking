import { Box, Button, Paper, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface TriviaGameCardProps {
  answered: number;
  total: number;
  onOpen: () => void;
}

/**
 * The უნარების ტესტები card. One card, one game — the games tab stacks them,
 * so this component knows nothing about its neighbours.
 */
export function TriviaGameCard({ answered, total, onOpen }: TriviaGameCardProps) {
  const done = total > 0 && answered >= total;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <Paper
        elevation={0}
        sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.trivia.skills.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {total === 0
            ? ka.trivia.errors.noTest
            : `${ka.trivia.skills.subtitle} · ${ka.trivia.skills.progress(answered, total)}`}
        </Typography>

        <Box sx={{ height: 4, borderRadius: '2px', bgcolor: 'surface2', my: 1.75 }}>
          <Box
            sx={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: '2px',
              bgcolor: 'primary.main',
              transition: 'width .2s linear',
            }}
          />
        </Box>

        <Button
          fullWidth
          variant={done ? 'outlined' : 'contained'}
          // `done` stays out of `disabled`: TriviaTestPage already renders a
          // complete finish screen (score + back button) when re-entered after
          // the last question, and that was the only route to it. Disabling on
          // `done` made it unreachable the moment you closed the app instead of
          // tapping through — the label alone keeps the button reading finished.
          disabled={total === 0}
          sx={{ height: 48 }}
          onClick={onOpen}
        >
          {done
            ? ka.trivia.skills.done
            : answered > 0
              ? ka.trivia.skills.resume
              : ka.trivia.skills.start}
        </Button>
    </Paper>
  );
}
