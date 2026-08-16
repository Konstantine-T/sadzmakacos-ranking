import { Box } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';

interface HeatBarProps {
  up: number;
  down: number;
  /** The week's maximum total_votes — every bar on the board shares this scale. */
  max: number;
  height?: number;
}

/**
 * THE SIGNATURE ELEMENT (§9.4).
 *
 * A diverging bar from a centre axis: upvotes extend right in ember amber,
 * downvotes extend left in cool slate, both scaled against the week's maximum
 * total_votes.
 *
 * A person at +8/−1 shows a long warm bar. A person at +7/−7 shows a wide bar
 * in BOTH directions — instantly readable as divisive, which a net score alone
 * would completely hide. Someone with no votes shows only the bare axis.
 *
 * This is the one memorable thing in the app. Everything around it stays quiet.
 */
export function HeatBar({ up, down, max, height = 10 }: HeatBarProps) {
  const reduced = useReducedMotion();
  const scale = max > 0 ? max : 1;

  const upPct = (up / scale) * 50;
  const downPct = (down / scale) * 50;

  const transition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 34 };

  return (
    <Box
      role="img"
      aria-label={`${up} ზემოთ, ${down} ქვემოთ`}
      sx={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: 99,
        bgcolor: (t) => t.palette.surface2,
        overflow: 'hidden',
      }}
    >
      {/* cold side — grows leftwards from the centre */}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
          <motion.div
            animate={{ width: `${downPct * 2}%` }}
            initial={false}
            transition={transition}
            style={{ height: '100%', borderRadius: 99 }}
          >
            <Box
              sx={{
                height: '100%',
                width: '100%',
                borderRadius: 99,
                bgcolor: (t) => t.palette.signal.down,
              }}
            />
          </motion.div>
        </Box>

        {/* warm side — grows rightwards */}
        <Box sx={{ width: '50%', display: 'flex', justifyContent: 'flex-start' }}>
          <motion.div
            animate={{ width: `${upPct * 2}%` }}
            initial={false}
            transition={transition}
            style={{ height: '100%', borderRadius: 99 }}
          >
            <Box
              sx={{
                height: '100%',
                width: '100%',
                borderRadius: 99,
                bgcolor: (t) => t.palette.signal.up,
              }}
            />
          </motion.div>
        </Box>
      </Box>

      {/* the axis: always visible, so a 0/0 row still reads as a row */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 2,
          ml: '-1px',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'),
        }}
      />
    </Box>
  );
}
