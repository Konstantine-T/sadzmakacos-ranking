import { useCallback, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';
import type { Country } from './countries';
import { nextRound, RECENT_MEMORY, type FlagRound } from './round';

/**
 * The flag for a country, served from public/flags/ (see scripts/sync-flags.mjs).
 * One request per question, a few hundred bytes each, and no CDN in the loop.
 */
function flagSrc(code: string) {
  return `/flags/${code}.svg`;
}

interface FlagGameProps {
  onGameOver: (streak: number) => void;
}

/**
 * Guess the country from its flag, until you get one wrong.
 *
 * The verdict is instant and the run ends on the first miss, so the tension is
 * the streak rather than a score out of ten. On a wrong answer the correct
 * country is named — a quiz that only says "no" teaches nothing, and this one
 * is worth learning from.
 *
 * `recent` keeps the last dozen answers out of the draw. Random sequences
 * genuinely do repeat within a few picks, and a repeat mid-streak reads as a
 * bug even when it is not.
 */
export function FlagGame({ onGameOver }: FlagGameProps) {
  const recent = useRef<string[]>([]);
  const [round, setRound] = useState<FlagRound>(() => nextRound());
  const [picked, setPicked] = useState<Country | null>(null);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);

  const advance = useCallback(() => {
    recent.current = [...recent.current, round.answer.code].slice(-RECENT_MEMORY);
    setRound(nextRound(recent.current));
    setPicked(null);
  }, [round.answer.code]);

  const choose = (c: Country) => {
    if (picked) return; // the verdict is showing — the next tap is შემდეგი
    setPicked(c);
    if (c.code === round.answer.code) {
      setStreak((s) => s + 1);
    } else {
      setOver(true);
      onGameOver(streak);
    }
  };

  const restart = () => {
    recent.current = [];
    setRound(nextRound());
    setPicked(null);
    setStreak(0);
    setOver(false);
  };

  return (
    <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ width: '100%', maxWidth: 460 }}
      >
        <Typography variant="caption" color="text.secondary">
          {ka.flags.streak}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {streak}
        </Typography>
      </Stack>

      <Box
        sx={{
          width: '100%',
          maxWidth: 460,
          aspectRatio: '3 / 2',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'border',
          bgcolor: 'surface2',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Box
          component="img"
          src={flagSrc(round.answer.code)}
          alt=""
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </Box>

      <Stack spacing={1} sx={{ width: '100%', maxWidth: 460 }}>
        {round.options.map((c) => {
          const isAnswer = c.code === round.answer.code;
          const isPicked = picked?.code === c.code;
          const settled = picked !== null;
          const right = settled && isAnswer;
          const wrong = settled && isPicked && !isAnswer;

          return (
            <ButtonBase
              key={c.code}
              disabled={settled}
              onClick={() => choose(c)}
              sx={{
                minHeight: 52,
                px: 1.75,
                borderRadius: '12px',
                justifyContent: 'flex-start',
                textAlign: 'left',
                fontSize: 14.5,
                border: '1px solid',
                opacity: settled && !right && !wrong ? 0.34 : 1,
                bgcolor: (t) =>
                  right
                    ? t.palette.quiz.correctSoft
                    : wrong
                      ? t.palette.quiz.wrongSoft
                      : 'background.paper',
                borderColor: (t) =>
                  right ? t.palette.quiz.correct : wrong ? t.palette.quiz.wrong : 'hairline',
                transition:
                  'background-color .16s linear, border-color .16s linear, opacity .16s linear',
              }}
            >
              {c.ka}
            </ButtonBase>
          );
        })}
      </Stack>

      <Box sx={{ width: '100%', maxWidth: 460, minHeight: 52 }}>
        {over ? (
          <Stack spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {ka.flags.correctWas(round.answer.ka)}
            </Typography>
            <Button fullWidth variant="contained" sx={{ height: 52 }} onClick={restart}>
              {ka.flags.again}
            </Button>
          </Stack>
        ) : (
          picked && (
            <Button fullWidth variant="contained" sx={{ height: 52 }} onClick={advance}>
              {ka.trivia.next}
            </Button>
          )
        )}
      </Box>
    </Stack>
  );
}
