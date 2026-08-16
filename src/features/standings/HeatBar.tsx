import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';

interface HeatBarProps {
  up: number;
  down: number;
  /** The week's maximum total_votes — every bar on the board shares this scale. */
  max: number;
  height?: number;
  /** Rounded pill (profile breakdown) vs. flat full-bleed strip (board rows). */
  rounded?: boolean;
  /** Rank #1 burns gold instead of amber; everything else leaves this unset. */
  upColor?: string;
  trackColor?: string;
  label?: string;
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
 * On the board it is now a flat 5px strip welded to the bottom edge of its row,
 * running the full width with no gutters, so twenty of them stack into a single
 * continuous read of the week. The rounded form survives on profiles, where a
 * bar sits inside a card rather than under a row.
 */
export function HeatBar({
  up,
  down,
  max,
  height = 5,
  rounded = false,
  upColor,
  trackColor,
  label,
}: HeatBarProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = max > 0 ? max : 1;
  const radius = rounded ? 99 : 0;

  const transition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 34 };

  const half = (value: number, color: string, align: 'flex-end' | 'flex-start') => (
    <Box sx={{ width: '50%', display: 'flex', justifyContent: align }}>
      <motion.div
        animate={{ width: `${(value / scale) * 100}%` }}
        initial={false}
        transition={transition}
        style={{ height: '100%', borderRadius: radius, background: color }}
      />
    </Box>
  );

  return (
    <Box
      role="img"
      aria-label={label ?? `${up} ზემოთ, ${down} ქვემოთ`}
      sx={{
        display: 'flex',
        height,
        width: '100%',
        borderRadius: radius,
        overflow: 'hidden',
        bgcolor: trackColor ?? theme.palette.surface2,
      }}
    >
      {/* cold side — grows leftwards from the centre */}
      {half(down, theme.palette.signal.down, 'flex-end')}

      {/* the axis: always visible, so a 0/0 row still reads as a row */}
      <Box
        sx={{
          width: '1px',
          flex: 'none',
          bgcolor:
            theme.palette.mode === 'dark' ? 'rgba(245,239,237,0.22)' : 'rgba(26,20,19,0.2)',
        }}
      />

      {/* warm side — grows rightwards */}
      {half(up, upColor ?? theme.palette.signal.up, 'flex-start')}
    </Box>
  );
}
