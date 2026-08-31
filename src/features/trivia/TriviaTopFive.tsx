import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { TriviaBoard } from './TriviaBoard';
import { useTriviaAllTimeBoard } from './api';
import { ka } from '@/i18n/ka';

interface TriviaTopFiveProps {
  myId: string | undefined;
  onOpen: () => void;
}

/**
 * Trivia's foothold on the screen everyone opens twenty times a day.
 *
 * ALL-TIME, not this week, and that is the whole reason the card works: a
 * weekly card is empty every Monday morning and thin until Wednesday, which on
 * the busiest screen in the app reads as a broken feature.
 */
export function TriviaTopFive({ myId, onOpen }: TriviaTopFiveProps) {
  const allTime = useTriviaAllTimeBoard();

  if (!allTime.isPending && !allTime.played) return null;

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between">
        <Typography variant="h2" sx={{ fontSize: 17 }}>
          {ka.trivia.home.title}
        </Typography>
        <ButtonBase
          onClick={onOpen}
          sx={{ minHeight: 44, px: 1, fontSize: 12.5, color: 'text.secondary' }}
        >
          <Box component="span">{ka.trivia.home.all}</Box>
        </ButtonBase>
      </Stack>

      <TriviaBoard rows={allTime.rows} loading={allTime.isPending} myId={myId} limit={5} />
    </Stack>
  );
}
