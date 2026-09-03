import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { FlagBoard } from '@/features/flags/FlagBoard';
import { FlagGame } from '@/features/flags/FlagGame';
import { useFlagBoard, useSubmitFlagScore } from '@/features/flags/api';
import { ka } from '@/i18n/ka';

/**
 * გამოიცანი ქვეყანა დროშის მიხედვით: the board first, the game second.
 *
 * Same shape as სნეიკი — a score only means something next to everyone else's,
 * and seeing the streak you have to beat is most of the reason to press start.
 */
export function FlagsPage() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { toastError } = useToast();
  const [playing, setPlaying] = useState(false);

  const board = useFlagBoard();
  const submit = useSubmitFlagScore();

  const mine = board.rows.find((r) => r.member_id === member?.id);

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2, pt: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h2">{ka.flags.name}</Typography>
          <Button
            // Mid-game the X is a way back to the board, not out of the section.
            // Leaving entirely takes two taps, which is the right cost for
            // abandoning a run you might be doing well in.
            onClick={() => (playing ? setPlaying(false) : navigate('/trivia'))}
            aria-label={ka.flags.close}
            sx={{ minWidth: 44, height: 44, color: 'text.secondary' }}
          >
            <CloseIcon />
          </Button>
        </Stack>

        {playing ? (
          <FlagGame
            onGameOver={(streak) => {
              // A zero-length streak is a first-question miss, not a run —
              // still a play, and still worth recording, since the board
              // tiebreaks on persistence.
              submit.mutate(streak, { onError: toastError });
            }}
          />
        ) : (
          <>
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">
                {ka.flags.board}
              </Typography>
              <FlagBoard rows={board.rows} loading={board.isPending} myId={member?.id} />
            </Stack>

            {mine && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {ka.flags.best}
                </Typography>
                <Typography
                  sx={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {mine.best_streak}
                </Typography>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              sx={{ height: 52 }}
              onClick={() => setPlaying(true)}
            >
              {ka.flags.start}
            </Button>
          </>
        )}
      </Stack>
    </PageTransition>
  );
}
