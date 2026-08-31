import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface TriviaGameCardProps {
  answered: number;
  total: number;
  onOpen: () => void;
}

/**
 * One card per game. There is one game.
 *
 * The dashed slot underneath is not decoration: it is the promise that adding
 * the next game is a row in this list rather than a redesign of the page.
 */
export function TriviaGameCard({ answered, total, onOpen }: TriviaGameCardProps) {
  const done = total > 0 && answered >= total;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <Stack spacing={1.25}>
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
          disabled={total === 0 || done}
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

      <Box
        sx={{
          p: 2,
          borderRadius: '16px',
          border: '1px dashed',
          borderColor: 'hairline',
          textAlign: 'center',
          fontSize: 12.5,
          color: 'text.disabled',
        }}
      >
        {ka.trivia.soon}
      </Box>
    </Stack>
  );
}
