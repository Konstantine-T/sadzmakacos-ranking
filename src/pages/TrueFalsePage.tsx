import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, Chip, Skeleton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import ChevronIcon from '@mui/icons-material/ChevronRightRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { useRealtime } from '@/features/realtime/useRealtime';
import { TrueFalseBoard } from '@/features/truefalse/TrueFalseBoard';
import { TrueFalseGame } from '@/features/truefalse/TrueFalseGame';
import { useSubmitTrueFalseScore, useTrueFalseBoards } from '@/features/truefalse/api';
import { CATEGORIES, categoryLabel, type Category } from '@/features/truefalse/categories';
import { ka } from '@/i18n/ka';

/** Rows per board on this page; the rest is one tap away. */
const PREVIEW = 4;

/**
 * მართალია თუ ტყუილი: pick a category, play, and eleven boards underneath.
 *
 * The picker and the start button sit ABOVE the boards. Eleven boards of four
 * rows is a long page on a phone, and the thing you came to do should not be at
 * the bottom of it. Each board is a link to that category's full ranking.
 */
export function TrueFalsePage() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const { toastError } = useToast();
  const [category, setCategory] = useState<Category>('all');
  const [playing, setPlaying] = useState(false);

  useRealtime(undefined);

  const { boards, isPending } = useTrueFalseBoards();
  const submit = useSubmitTrueFalseScore();

  const mine = boards[category].find((r) => r.member_id === member?.id);

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2, pt: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h2">{ka.truefalse.name}</Typography>
          <Button
            // Mid-game the X is a way back to the boards, not out of the section,
            // exactly as in the flag game.
            onClick={() => (playing ? setPlaying(false) : navigate('/trivia'))}
            aria-label={ka.truefalse.close}
            sx={{ minWidth: 44, height: 44, color: 'text.secondary' }}
          >
            <CloseIcon />
          </Button>
        </Stack>

        {playing ? (
          <TrueFalseGame
            // A new category is a new game: remount rather than reset in place.
            key={category}
            category={category}
            onGameOver={(streak) => {
              // A zero is a first-card miss — still a play, and the board
              // tiebreaks on persistence.
              submit.mutate({ category, streak }, { onError: toastError });
            }}
          />
        ) : (
          <>
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                {ka.truefalse.pickCategory}
              </Typography>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    label={categoryLabel(c)}
                    clickable
                    color={c === category ? 'primary' : 'default'}
                    variant={c === category ? 'filled' : 'outlined'}
                    onClick={() => setCategory(c)}
                    sx={{ height: 44, borderRadius: '22px', fontSize: 13.5 }}
                  />
                ))}
              </Stack>
            </Stack>

            {mine && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {ka.truefalse.best}
                </Typography>
                <Typography
                  sx={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {mine.best_streak}
                </Typography>
              </Box>
            )}

            <Stack spacing={0.75}>
              <Button
                fullWidth
                variant="contained"
                sx={{ height: 52 }}
                onClick={() => setPlaying(true)}
              >
                {ka.truefalse.start}
              </Button>
              <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
                {ka.truefalse.english}
              </Typography>
            </Stack>

            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary">
                {ka.truefalse.boards}
              </Typography>

              {isPending ? (
                <Stack spacing={0.5}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" height={48} />
                  ))}
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  {CATEGORIES.map((c) => (
                    <ButtonBase
                      key={c}
                      onClick={() => navigate(`/trivia/truefalse/board/${c}`)}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        p: 1,
                        borderRadius: '16px',
                        border: '1px solid',
                        borderColor: 'border',
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ minHeight: 44, px: 1 }}
                      >
                        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>
                          {categoryLabel(c)}
                        </Typography>
                        <Stack direction="row" alignItems="center" sx={{ color: 'text.secondary' }}>
                          <Typography variant="caption">{ka.truefalse.fullBoard}</Typography>
                          <ChevronIcon fontSize="small" />
                        </Stack>
                      </Stack>
                      <TrueFalseBoard rows={boards[c]} myId={member?.id} limit={PREVIEW} />
                    </ButtonBase>
                  ))}
                </Stack>
              )}
            </Stack>

            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
              {ka.truefalse.credit}
            </Typography>
          </>
        )}
      </Stack>
    </PageTransition>
  );
}
