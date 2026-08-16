import { IconButton, Stack, Tooltip } from '@mui/material';
import UpIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import DownIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { ka } from '@/i18n/ka';
import type { VoteValue } from './api';

interface VoteToggleProps {
  value: VoteValue;
  disabled?: boolean;
  /** True for your own row — no self-voting, enforced in the DB too. */
  isSelf?: boolean;
  onChange: (value: VoteValue) => void;
}

const MotionIconButton = motion.create(IconButton);

/**
 * Up / neutral / down. Tapping the active direction again clears the vote,
 * which is how "ხმის გაუქმება" is reachable without a third button eating
 * space on a 390px screen. Tap targets stay ≥44px (rule 5).
 */
export function VoteToggle({ value, disabled, isSelf, onChange }: VoteToggleProps) {
  const reduced = useReducedMotion();
  const blocked = disabled || isSelf;

  const press = reduced ? {} : { whileTap: { scale: 0.86 } };
  const spring = { type: 'spring' as const, stiffness: 500, damping: 26 };

  const button = (direction: 1 | -1) => {
    const active = value === direction;
    const label = direction === 1 ? ka.vote.up : ka.vote.down;

    return (
      <MotionIconButton
        {...press}
        transition={spring}
        aria-label={active ? ka.vote.clear : label}
        aria-pressed={active}
        disabled={blocked}
        onClick={() => onChange(active ? null : direction)}
        sx={{
          width: 44,
          height: 40,
          borderRadius: 2,
          border: '1px solid',
          borderColor: active
            ? direction === 1
              ? 'signal.up'
              : 'signal.down'
            : 'divider',
          color: active ? (direction === 1 ? 'signal.up' : 'signal.down') : 'text.secondary',
          bgcolor: active
            ? direction === 1
              ? 'rgba(255,178,36,0.14)'
              : 'rgba(110,134,171,0.14)'
            : 'transparent',
          '&.Mui-disabled': { opacity: 0.32 },
        }}
      >
        {direction === 1 ? <UpIcon /> : <DownIcon />}
      </MotionIconButton>
    );
  };

  const stack = (
    <Stack direction="row" spacing={0.75}>
      {button(1)}
      {button(-1)}
    </Stack>
  );

  if (isSelf) {
    return (
      <Tooltip title={ka.vote.noSelf}>
        <span>{stack}</span>
      </Tooltip>
    );
  }

  return stack;
}
