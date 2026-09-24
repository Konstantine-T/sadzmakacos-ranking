import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, ButtonBase, Skeleton, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { ka } from '@/i18n/ka';
import { categoryLabel, type Category } from './categories';
import { TIER_LENGTH, tierFor, type Card, type Difficulty } from './deck';
import { fetchCards } from './source';

interface TrueFalseGameProps {
  category: Category;
  onGameOver: (streak: number) => void;
}

type Phase = 'loading' | 'asking' | 'right' | 'over' | 'won' | 'error';

/** How long a right answer stays on screen before the next card. */
const ADVANCE_MS = 1100;
/** Below this many queued cards, a tier fetches its next batch. */
const LOW_WATER = 5;
/** Start fetching the next tier this many cards before the ramp reaches it. */
const LOOKAHEAD = 3;
/** Consecutive empty batches before a tier counts as spent. */
const EMPTY_LIMIT = 2;
/** Drag distance, in px, that counts as a swipe. */
const SWIPE_PX = 96;
const SWIPE_VELOCITY = 500;

const NEXT_TIER: Record<Difficulty, Difficulty | null> = {
  easy: 'medium',
  medium: 'hard',
  hard: null,
};

function emptyQueues(): Record<Difficulty, Card[]> {
  return { easy: [], medium: [], hard: [] };
}

/**
 * მართალია თუ ტყუილი — survival.
 *
 * One question, one proposed answer: swipe right if it is the right one, left
 * if it is not. The buttons underneath do the same for anyone who would rather
 * tap. The first miss ends the run. Difficulty ramps with the streak (see
 * `tierFor`), so a long run is earned on hard questions, not easy ones.
 *
 * A right answer is shown for a beat — with the real answer named when the card
 * was a lie, since "yes, that was wrong" teaches nothing on its own — and then
 * the next card arrives by itself. A miss names the right answer and stops.
 *
 * Questions are queued per difficulty and fetched ahead, so a card is almost
 * always ready the instant the last one is answered. A question id is dealt at
 * most once per run; `seen` holds everything asked or queued.
 */
export function TrueFalseGame({ category, onGameOver }: TrueFalseGameProps) {
  const reduceMotion = useReducedMotion();

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
   * than re-dealing card one in the middle of a run.
   */
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const [card, setCard] = useState<Card | null>(null);
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

  /** Deal the card for someone who has answered `answered` correctly so far. */
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

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], reduceMotion ? [0, 0] : [-12, 12]);
  const yesHint = useTransform(x, [0, SWIPE_PX], [0, 1]);
  const noHint = useTransform(x, [-SWIPE_PX, 0], [1, 0]);

  const answer = (guess: boolean) => {
    if (phase !== 'asking' || !card) return;
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });

    if (guess !== card.truth) {
      setPhase('over');
      onGameOverRef.current(streak);
      return;
    }

    const reached = streak + 1;
    setStreak(reached);
    setPhase('right');
    advanceTimer.current = setTimeout(() => void deal(reached), ADVANCE_MS);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) answer(true);
    else if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) answer(false);
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
    void deal(0);
  };

  const settled = phase === 'right' || phase === 'over';
  const tone = phase === 'right' ? 'correct' : phase === 'over' ? 'wrong' : null;

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
          {card && ` · ${ka.truefalse.difficulty[card.difficulty]}`}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {ka.truefalse.streak}
          </Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {streak}
          </Typography>
        </Stack>
      </Stack>

      {phase === 'error' ? (
        <Stack spacing={1.25} sx={{ width: '100%', maxWidth: 460 }}>
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            {ka.truefalse.loadFailed}
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
        <Skeleton variant="rounded" sx={{ width: '100%', maxWidth: 460, height: 300, borderRadius: '16px' }} />
      ) : (
        <Box sx={{ width: '100%', maxWidth: 460, touchAction: 'pan-y' }}>
          <motion.div
            key={card.id}
            drag={phase === 'asking' ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            style={{ x, rotate, cursor: phase === 'asking' ? 'grab' : 'default' }}
          >
            <Box
              sx={{
                position: 'relative',
                minHeight: 300,
                p: 2.5,
                borderRadius: '16px',
                border: '1px solid',
                borderColor: (t) =>
                  tone === 'correct'
                    ? t.palette.quiz.correct
                    : tone === 'wrong'
                      ? t.palette.quiz.wrong
                      : 'border',
                bgcolor: (t) =>
                  tone === 'correct'
                    ? t.palette.quiz.correctSoft
                    : tone === 'wrong'
                      ? t.palette.quiz.wrongSoft
                      : 'background.paper',
                display: 'flex',
                flexDirection: 'column',
                userSelect: 'none',
                transition: 'background-color .16s linear, border-color .16s linear',
              }}
            >
              {/* Swipe hints: they fade in as the card is dragged toward a side. */}
              <Box
                component={motion.div}
                style={{ opacity: yesHint }}
                sx={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  color: (t) => t.palette.quiz.correct,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {ka.truefalse.yes}
              </Box>
              <Box
                component={motion.div}
                style={{ opacity: noHint }}
                sx={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  color: (t) => t.palette.quiz.wrong,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {ka.truefalse.no}
              </Box>

              <Typography lang="en" sx={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, mt: 2.5 }}>
                {card.question}
              </Typography>

              <Box sx={{ flex: 1, minHeight: 24 }} />

              <Typography variant="caption" color="text.secondary">
                {ka.truefalse.isIt}
              </Typography>
              <Typography lang="en" sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
                {card.shown}
              </Typography>

              {settled && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: (t) => (tone === 'correct' ? t.palette.quiz.correct : t.palette.quiz.wrong),
                    }}
                  >
                    {tone === 'correct' ? ka.truefalse.right : ka.truefalse.wrong}
                  </Typography>
                  {/* Name the real answer whenever the card was a lie, or you missed. */}
                  {(tone === 'wrong' || !card.truth) && (
                    <Typography variant="caption" color="text.secondary" lang="en">
                      {ka.truefalse.correctWas(card.correctAnswer)}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </motion.div>
        </Box>
      )}

      {phase === 'over' || phase === 'won' ? (
        <Stack spacing={1} alignItems="center" sx={{ width: '100%', maxWidth: 460 }}>
          {phase === 'won' && (
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
              {ka.truefalse.perfect}
            </Typography>
          )}
          <Button fullWidth variant="contained" sx={{ height: 52 }} onClick={restart}>
            {ka.truefalse.again}
          </Button>
        </Stack>
      ) : (
        phase !== 'error' && (
          <Stack direction="row" spacing={1.25} sx={{ width: '100%', maxWidth: 460 }}>
            <AnswerButton
              label={ka.truefalse.no}
              icon={<CloseIcon />}
              disabled={phase !== 'asking'}
              onClick={() => answer(false)}
            />
            <AnswerButton
              label={ka.truefalse.yes}
              icon={<CheckIcon />}
              disabled={phase !== 'asking'}
              onClick={() => answer(true)}
            />
          </Stack>
        )
      )}
    </Stack>
  );
}

function AnswerButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        flex: 1,
        minHeight: 56,
        gap: 0.75,
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'hairline',
        bgcolor: 'background.paper',
        fontSize: 15,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity .16s linear',
      }}
    >
      {icon}
      {label}
    </ButtonBase>
  );
}
