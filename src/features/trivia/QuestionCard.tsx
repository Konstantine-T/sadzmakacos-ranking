import { useState } from 'react';
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';
import type { TriviaQuestion } from '@/lib/database.types';

const KEYS = ['ა', 'ბ', 'გ', 'დ', 'ე'];

interface QuestionCardProps {
  question: TriviaQuestion;
  index: number;
  total: number;
  /** The choice already committed for this question, or null while unanswered. */
  answeredChoice: number | null;
  /** Revealed only once answered. */
  correctIndex: number | null;
  onConfirm: (choiceIndex: number) => void;
  onNext: () => void;
  pending: boolean;
  isLast: boolean;
}

/**
 * One question owning the whole screen.
 *
 * The two-step commit — select, then დადასტურება — exists because an answer is
 * final the instant it lands, enforced by a primary key rather than by this
 * component. A single mistap must not be able to spend it.
 *
 * Nothing here knows the right answer until the server says so: `correctIndex`
 * arrives from answer_trivia()'s response, never from the question payload.
 */
export function QuestionCard({
  question,
  index,
  total,
  answeredChoice,
  correctIndex,
  onConfirm,
  onNext,
  pending,
  isLast,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  // `correctIndex` is the only true signal that this question has been
  // graded — it can only turn non-null once answer_trivia() has responded.
  // Gating `settled` on it alone (rather than also waiting on the parent's
  // `answeredChoice`, which comes from a *separate* refetch of my_answers
  // that the mutation's onSuccess merely kicks off) closes a real race: for
  // the tick between the grade arriving and that refetch resolving,
  // `answeredChoice` still reads its old, pre-answer value (null), which
  // would otherwise unsettle the row again and let options answer to taps —
  // exactly what rule 2 forbids. `selected` cannot have changed in that
  // window (options are `disabled` while `pending`), so it is a safe stand-in
  // for the committed choice until the server copy catches up.
  const settled = correctIndex !== null;
  const committedChoice = answeredChoice ?? selected;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Typography
        variant="caption"
        sx={{ px: 2, pt: 1, pb: 2, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
      >
        {ka.trivia.counter(index + 1, total)}
      </Typography>

      <Typography
        sx={{
          px: 2,
          pb: 2.5,
          fontFamily: (t) => t.typography.h1.fontFamily,
          fontSize: 19,
          lineHeight: 1.45,
          fontWeight: 600,
        }}
      >
        {question.prompt}
      </Typography>

      <Stack spacing={1} sx={{ px: 2, flex: 1 }}>
        {question.options.map((option, i) => {
          const isChosen = settled ? committedChoice === i : selected === i;
          const isRight = settled && correctIndex === i;
          const isWrong = settled && committedChoice === i && correctIndex !== i;
          const faded = settled && !isRight && !isWrong;

          return (
            <ButtonBase
              key={i}
              disabled={settled || pending}
              onClick={() => setSelected(i)}
              aria-pressed={isChosen}
              sx={{
                minHeight: 52,
                px: 1.5,
                py: 1.25,
                gap: 1.25,
                borderRadius: '12px',
                justifyContent: 'flex-start',
                textAlign: 'left',
                border: '1px solid',
                opacity: faded ? 0.34 : 1,
                bgcolor: (t) =>
                  isRight
                    ? t.palette.quiz.correctSoft
                    : isWrong
                      ? t.palette.quiz.wrongSoft
                      : isChosen
                        ? 'rgba(247,55,24,0.10)'
                        : 'background.paper',
                borderColor: (t) =>
                  isRight
                    ? t.palette.quiz.correct
                    : isWrong
                      ? t.palette.quiz.wrong
                      : isChosen
                        ? 'primary.main'
                        : 'hairline',
                transition: 'background-color .16s linear, border-color .16s linear, opacity .16s linear',
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 24,
                  height: 24,
                  flex: 'none',
                  borderRadius: 999,
                  border: '1px solid',
                  borderColor: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                }}
              >
                {KEYS[i] ?? i + 1}
              </Box>
              <Box component="span" sx={{ fontSize: 14.5, lineHeight: 1.4 }}>
                {option}
              </Box>
              {isRight && (
                <Box component="span" sx={{ ml: 'auto', color: (t) => t.palette.quiz.correct }}>
                  ✓
                </Box>
              )}
              {isWrong && (
                <Box component="span" sx={{ ml: 'auto', color: (t) => t.palette.quiz.wrong }}>
                  ✕
                </Box>
              )}
            </ButtonBase>
          );
        })}
      </Stack>

      <Box sx={{ p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {settled ? (
          <Button fullWidth variant="contained" sx={{ height: 52 }} onClick={onNext}>
            {isLast ? ka.trivia.finish : ka.trivia.next}
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            sx={{ height: 52 }}
            disabled={selected === null || pending}
            onClick={() => selected !== null && onConfirm(selected)}
          >
            {ka.trivia.confirm}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
