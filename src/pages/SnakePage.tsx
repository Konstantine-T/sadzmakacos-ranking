import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { SnakeBoard } from '@/features/snake/SnakeBoard';
import { SnakeGame } from '@/features/snake/SnakeGame';
import { useSnakeBoard, useSubmitSnakeScore } from '@/features/snake/api';
import { ka } from '@/i18n/ka';

/**
 * სნეიკი: the board first, the game second.
 *
 * Opening a game to a leaderboard rather than straight to play is deliberate —
 * the score only means anything next to everyone else's, and seeing who you
 * have to beat is most of the reason to press start.
 */
export function SnakePage() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { toastError } = useToast();
  const [playing, setPlaying] = useState(false);

  const board = useSnakeBoard();
  const submit = useSubmitSnakeScore();

  const mine = board.rows.find((r) => r.member_id === member?.id);

  return (
    <PageTransition fill>
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2, pt: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h2">{ka.snake.name}</Typography>
          <Button
            // Mid-game the X is a way back to the board, not out of the section.
            // Leaving entirely takes two taps, which is the right cost for
            // abandoning a run you might be doing well in.
            onClick={() => (playing ? setPlaying(false) : navigate('/trivia'))}
            aria-label={ka.snake.close}
            sx={{ minWidth: 44, height: 44, color: 'text.secondary' }}
          >
            <CloseIcon />
          </Button>
        </Stack>

        {playing ? (
          <SnakeGame
            members={board.members}
            onGameOver={(score) => {
              // A zero is a misfire, not a game — don't spend a `plays` on it.
              if (score > 0) submit.mutate(score, { onError: toastError });
            }}
          />
        ) : (
          <>
            <Stack spacing={0.75} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Typography variant="caption" color="text.secondary">
                {ka.snake.board}
              </Typography>
              <SnakeBoard rows={board.rows} loading={board.isPending} myId={member?.id} />
            </Stack>

            {mine && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {ka.snake.best}
                </Typography>
                <Typography
                  sx={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {mine.best_score}
                </Typography>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              sx={{ height: 52 }}
              onClick={() => setPlaying(true)}
            >
              {ka.snake.start}
            </Button>
          </>
        )}
      </Stack>
    </PageTransition>
  );
}
