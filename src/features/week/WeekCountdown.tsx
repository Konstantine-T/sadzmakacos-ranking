import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { countdownTo } from '@/lib/time';
import { ka } from '@/i18n/ka';

interface WeekCountdownProps {
  endsAt: string;
  /** The wide layout gives the clock a little more room, and takes it. */
  size?: 'phone' | 'wide';
  /** Fires once when the clock reaches zero, so the page can refetch. */
  onExpire?: () => void;
}

const SIZES = {
  phone: { digit: 32, label: 11, min: 44, gap: '14px' },
  wide: { digit: 34, label: 10.5, min: 46, gap: '22px' },
} as const;

function Segment({
  value,
  label,
  dim,
  size,
}: {
  value: number;
  label: string;
  dim?: boolean;
  size: (typeof SIZES)[keyof typeof SIZES];
}) {
  return (
    <Stack alignItems="center" spacing="3px" sx={{ minWidth: size.min }}>
      <Typography
        variant="numeral"
        sx={{
          fontSize: size.digit,
          letterSpacing: '-0.04em',
          color: dim ? 'textMute' : 'text.primary',
        }}
        aria-hidden
      >
        {String(value).padStart(2, '0')}
      </Typography>
      <Typography sx={{ fontSize: size.label, fontWeight: 500, color: 'textMute' }}>
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * All four segments, always (§1.1). The old version dropped days at zero and
 * seconds above a day, so the block changed width twice a week and the layout
 * jumped with it. Seconds now sit in the muted tone instead — present, ticking,
 * clearly the least important number of the four.
 *
 * Under an hour the whole block picks up a slow pulse: the only motion on the
 * board that runs without user input, and it stops entirely under reduced
 * motion (§9.5).
 */
export function WeekCountdown({ endsAt, size = 'phone', onExpire }: WeekCountdownProps) {
  const reduced = useReducedMotion();
  const metrics = SIZES[size];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = countdownTo(endsAt, now);

  useEffect(() => {
    if (countdown.done) onExpire?.();
    // Only the transition to zero matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown.done]);

  if (countdown.done) {
    return (
      <Typography variant="h3" color="text.secondary">
        {ka.week.closed}
      </Typography>
    );
  }

  const digits = (
    <Stack
      direction="row"
      spacing={metrics.gap}
      alignItems="flex-end"
      aria-label={`${ka.week.endsIn}: ${countdown.days} ${ka.week.days}, ${countdown.hours} ${ka.week.hours}, ${countdown.minutes} ${ka.week.minutes}`}
    >
      <Segment value={countdown.days} label={ka.week.days} size={metrics} />
      <Segment value={countdown.hours} label={ka.week.hours} size={metrics} />
      <Segment value={countdown.minutes} label={ka.week.minutes} size={metrics} />
      <Segment value={countdown.seconds} label={ka.week.seconds} dim size={metrics} />
    </Stack>
  );

  if (reduced || !countdown.urgent) return <Box>{digits}</Box>;

  return (
    <motion.div
      animate={{ opacity: [1, 0.62, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {digits}
    </motion.div>
  );
}
