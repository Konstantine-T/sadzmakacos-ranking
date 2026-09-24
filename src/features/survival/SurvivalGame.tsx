import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';
import { categoryLabel, type Category } from './categories';
import { TIER_LENGTH, tierFor, type Card, type Difficulty } from './deck';
import { fetchCards } from './source';

interface SurvivalGameProps {
  category: Category;
  onGameOver: (streak: number) => void;
}

type Phase = 'loading' | 'asking' | 'right' | 'over' | 'won' | 'error';

/** How long a right answer stays on screen before the next question. */
const ADVANCE_MS = 900;
/** Below this many queued cards, a tier fetches its next batch. */
const LOW_WATER = 5;
/** Start fetching the next tier this many cards before the ramp reaches it. */
const LOOKAHEAD = 3;
/** Consecutive empty batches before a tier counts as spent. */
const EMPTY_LIMIT = 2;

const NEXT_TIER: Record<Difficulty, Difficulty | null> = {
  easy: 'medium',
  medium: 'hard',
  hard: null,
};

function emptyQueues(): Record<Difficulty, Card[]> {
  return { easy: [], medium: [], hard: [] };
}

/**
 * გადარჩენა — multiple-choice trivia until you get one wrong.
 *
 * The flag game's grammar with questions instead of flags: four options, an
 * instant verdict, and the first miss ends the run naming the right answer.
 * Unlike the flag game a right answer advances by itself after a beat — the
 * run is the point, and a შემდეგი tap between every question slows it for
 * nothing. Difficulty ramps with the streak (see `tierFor`), so a long run is
 * earned on hard questions, not easy ones.
 *
 * Questions are queued per difficulty and fetched ahead, so one is almost
 * always ready the instant the last is answered. A question id is dealt at most
 * once per run; `seen` holds everything asked or queued.
 */
export function SurvivalGame({ category, onGameOver }: SurvivalGameProps) {
  const queues = useRef(emptyQueues());
  const seen = useRef(new Set<string>());
  const inflight = useRef<Partial<Record<Difficulty, Promise<void>>>>({});
  const empties = useRef<Record<Difficulty, number>>({ easy: 0, medium: 0, hard: 0 });
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();
  /** Bumped on restart and unmount so a stale fetch or timer cannot deal a card. */
  const generation = useRef(0);

  /**
   * The parent passes a fresh arrow every render. Read through a ref, so that
   * `deal` stays stable and the start effect below runs once per mount rather
   * than re-dealing question one in the middle of a run.
   */
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const [card, setCard] = useState<Card | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [streak, setStreak] = useState(0);

  const spent = (tier: Difficulty) => empties.current[tier] >= EMPTY_LIMIT;

  /**
   * Top a tier's queue up if it is running low. Resolves once any fetch it
   * started has landed; rejects if that fetch failed.
   */
  const fill = useCallback(
    (tier: Difficulty): Promise<void> => {
      if (queues.current[tier].length >= LOW_WATER || spent(tier)) return Promise.resolve();
      const running = inflight.current[tier];
      if (running) return running;

      const gen = generation.current;
      const request = fetchCards(category, tier, seen.current)
        .then((cards) => {
          if (gen !== generation.current) return;
          empties.current[tier] = cards.length === 0 ? empties.current[tier] + 1 : 0;
          for (const c of cards) seen.current.add(c.id);
          queues.current[tier].push(...cards);
        })
        .finally(() => {
          if (inflight.current[tier] === request) delete inflight.current[tier];
        });
      inflight.current[tier] = request;
      return request;
    },
    [category],
  );

  /** Deal the question for someone who has answered `answered` correctly so far. */
  const deal = useCallback(
    async (answered: number) => {
      const gen = generation.current;
      const tier = tierFor(answered);

      // Fetch until a card exists or the tier has run dry — a batch of fifty
      // from a small category can be entirely questions this run has seen.
      while (queues.current[tier].length === 0 && !spent(tier)) {
        setPhase('loading');
        try {
          await fill(tier);
        } catch {
          if (gen === generation.current) setPhase('error');
          return;
        }
        if (gen !== generation.current) return;
      }

      const next = queues.current[tier].shift();
      if (!next) {
        // Nothing left that this run has not already asked: the pool is
        // answered, which is a win rather than an error.
        setPhase('won');
        onGameOverRef.current(answered);
        return;
      }

      setCard(next);
      setPicked(null);
      setPhase('asking');

      // Prefetch in the background; a failure here resurfaces on the deal that
      // actually needs the cards.
      fill(tier).catch(() => undefined);
      const upcoming = NEXT_TIER[tier];
      if (upcoming && answered + LOOKAHEAD >= TIER_LENGTH * (tier === 'easy' ? 1 : 2)) {
        fill(upcoming).catch(() => undefined);
      }
    },
    [fill],
  );

  // `deal` only changes with the category, and the page remounts this
  // component for a new category — so this runs once per game. Under
  // StrictMode's mount-unmount-mount the generation bump discards the first
  // deal, and the second one is the run.
  useEffect(() => {
    void deal(0);
    return () => {
      generation.current += 1;
      clearTimeout(advanceTimer.current);
    };
  }, [deal]);

  const choose = (option: string) => {
    if (phase !== 'asking' || !card) return;
    setPicked(option);

    if (option !== card.answer) {
      setPhase('over');
      onGameOverRef.current(streak);
      return;
    }

    const reached = streak + 1;
    setStreak(reached);
    setPhase('right');
    advanceTimer.current = setTimeout(() => void deal(reached), ADVANCE_MS);
  };

  const restart = () => {
    clearTimeout(advanceTimer.current);
    generation.current += 1;
    // Cards still queued were never shown, so the next run may deal them; only
    // they stay "seen", which keeps them out of the next batch twice over.
    seen.current = new Set(
      [...queues.current.easy, ...queues.current.medium, ...queues.current.hard].map((c) => c.id),
    );
    inflight.current = {};
    empties.current = { easy: 0, medium: 0, hard: 0 };
    setStreak(0);
    setCard(null);
    setPicked(null);
    void deal(0);
  };

  const settled = phase === 'right' || phase === 'over';

  return (
    <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ width: '100%', maxWidth: 460 }}
      >
        <Typography variant="caption" color="text.secondary">
          {categoryLabel(category)}
          {card && ` · ${ka.survival.difficulty[card.difficulty]}`}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {ka.survival.streak}
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {streak}
          </Typography>
        </Stack>
      </Stack>

      {phase === 'error' ? (
        <Stack spacing={1.25} sx={{ width: '100%', maxWidth: 460 }}>
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {ka.survival.loadFailed}
          </Alert>
          <Button
            fullWidth
            variant="contained"
            sx={{ height: 52 }}
            onClick={() => void deal(streak)}
          >
            {ka.common.retry}
          </Button>
        </Stack>
      ) : !card || phase === 'loading' ? (
        <Stack spacing={1} sx={{ width: '100%', maxWidth: 460 }}>
          <Skeleton variant="rounded" height={120} sx={{ borderRadius: '16px' }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={52} sx={{ borderRadius: '12px' }} />
          ))}
        </Stack>
      ) : (
        <>
          <Box
            sx={{
              width: '100%',
              maxWidth: 460,
              minHeight: 120,
              p: 2.25,
              borderRadius: '16px',
              border: '1px solid',
              borderColor: 'border',
              bgcolor: 'surface2',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography lang="en" sx={{ fontSize: 17.5, fontWeight: 600, lineHeight: 1.4 }}>
              {card.question}
            </Typography>
          </Box>

          <Stack spacing={1} sx={{ width: '100%', maxWidth: 460 }}>
            {card.options.map((option) => {
              const isAnswer = option === card.answer;
              const isPicked = option === picked;
              const right = settled && isAnswer;
              const wrong = settled && isPicked && !isAnswer;

              return (
                <ButtonBase
                  key={option}
                  lang="en"
                  disabled={phase !== 'asking'}
                  onClick={() => choose(option)}
                  sx={{
                    minHeight: 52,
                    px: 1.75,
                    py: 1,
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
                  {option}
                </ButtonBase>
              );
            })}
          </Stack>
        </>
      )}

      {(phase === 'over' || phase === 'won') && (
        <Stack spacing={1} alignItems="center" sx={{ width: '100%', maxWidth: 460 }}>
          <Typography
            variant="caption"
            sx={{
              color: phase === 'won' ? 'primary.main' : 'text.secondary',
              fontWeight: phase === 'won' ? 700 : 400,
            }}
          >
            {phase === 'won' ? ka.survival.perfect : ka.survival.over(streak)}
          </Typography>
          <Button fullWidth variant="contained" sx={{ height: 52 }} onClick={restart}>
            {ka.survival.again}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
