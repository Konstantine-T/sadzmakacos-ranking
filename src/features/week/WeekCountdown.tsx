import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { countdownTo } from '@/lib/time';
import { ka } from '@/i18n/ka';

interface WeekCountdownProps {
  endsAt: string;
  /** Fires once when the clock reaches zero, so the page can refetch. */
  onExpire?: () => void;
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <Stack alignItems="center" spacing={0.25} sx={{ minWidth: 46 }}>
      <Typography
        variant="numeral"
        sx={{ fontSize: 30, lineHeight: 1, color: 'text.primary' }}
        aria-hidden
      >
        {String(value).padStart(2, '0')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * Segmented digits, always visible on the landing page (§1.1). Under an hour
 * it picks up a slow pulse — the only motion on the scoreboard that runs
 * without user input, and it stops entirely under reduced motion (§9.5).
 */
export function WeekCountdown({ endsAt, onExpire }: WeekCountdownProps) {
  const reduced = useReducedMotion();
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
      spacing={1}
      alignItems="flex-end"
      aria-label={`${ka.week.endsIn}: ${countdown.days} ${ka.week.days}, ${countdown.hours} ${ka.week.hours}, ${countdown.minutes} ${ka.week.minutes}`}
    >
      {countdown.days > 0 && <Segment value={countdown.days} label={ka.week.days} />}
      <Segment value={countdown.hours} label={ka.week.hours} />
      <Segment value={countdown.minutes} label={ka.week.minutes} />
      {countdown.days === 0 && <Segment value={countdown.seconds} label={ka.week.seconds} />}
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
