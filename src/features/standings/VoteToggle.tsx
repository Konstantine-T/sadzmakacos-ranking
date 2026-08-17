import { Box, ButtonBase } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { ka } from '@/i18n/ka';
import type { VoteValue } from './api';

interface VoteToggleProps {
  value: VoteValue;
  disabled?: boolean;
  /**
   * `touch` is 44px tall for rule 5. `compact` is the 38px the wide layout
   * draws — that layout is mouse-driven, and rule 5 is a thumb rule; 38px is
   * still well past the 24px WCAG 2.2 minimum.
   */
  size?: 'touch' | 'compact';
  onChange: (value: VoteValue) => void;
}

const MotionButtonBase = motion.create(ButtonBase);

/**
 * Up / neutral / down, welded into one pill.
 *
 * Tapping the active direction again clears the vote, which is how
 * "ხმის გაუქმება" is reachable without a third button eating space on a 390px
 * screen. The two halves share a border and a hairline divider so the control
 * reads as a single switch with two ends rather than as two buttons that happen
 * to sit together.
 *
 * The design draws these 42px tall; they ship at 44 because rule 5 is not
 * negotiable and this is the most-tapped control in the app.
 */
export function VoteToggle({ value, disabled, size = 'touch', onChange }: VoteToggleProps) {
  const reduced = useReducedMotion();
  const press = reduced ? {} : { whileTap: { scale: 0.94 } };
  const height = size === 'touch' ? 44 : 38;
  const glyph = size === 'touch' ? 17 : 15;

  const half = (direction: 1 | -1) => {
    const active = value === direction;
    const tint = direction === 1 ? 'signal.up' : 'signal.down';

    return (
      <MotionButtonBase
        {...press}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
        aria-label={active ? ka.vote.clear : direction === 1 ? ka.vote.up : ka.vote.down}
        aria-pressed={active}
        disabled={disabled}
        onClick={(event: { stopPropagation: () => void }) => {
          // The whole row is a tap target for expand/collapse; voting is not that.
          event.stopPropagation();
          onChange(active ? null : direction);
        }}
        sx={{
          width: 46,
          height,
          flex: 'none',
          fontSize: glyph,
          lineHeight: 1,
          fontWeight: 700,
          borderRight: direction === 1 ? '1px solid' : 0,
          borderColor: 'divider',
          color: active ? tint : 'text.secondary',
          bgcolor: active
            ? direction === 1
              ? 'signal.upSoft'
              : 'signal.downSoft'
            : 'transparent',
          transition: 'background-color .14s linear, color .14s linear',
          '&.Mui-disabled': { opacity: 0.32 },
        }}
      >
        {direction === 1 ? '▲' : '▼'}
      </MotionButtonBase>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 'none',
        borderRadius: size === 'touch' ? '11px' : '10px',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {half(1)}
      {half(-1)}
    </Box>
  );
}
