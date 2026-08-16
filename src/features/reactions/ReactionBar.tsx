import { useState } from 'react';
import { Box, ButtonBase, Popover, Stack } from '@mui/material';
import AddReactionIcon from '@mui/icons-material/AddReactionOutlined';
import { motion, useReducedMotion } from 'framer-motion';
import { REACTIONS } from '@/theme/tokens';

interface ReactionBarProps {
  counts: Record<string, number> | undefined;
  /** Which emoji *you* have on this target — the only identity ever exposed. */
  mine: Set<string>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onToggle: (emoji: string) => void;
}

/**
 * 🔥 😂 💀 👑 😭 — one of each per member per target, toggleable, counts only.
 *
 * Only emoji somebody has actually used are shown; the rest live behind the add
 * button. The visual pill is 30–32px because five of them plus the add button
 * have to fit inside 390px, but each one carries an invisible padded hit area
 * that brings the real tap target to 44px (rule 5).
 */
export function ReactionBar({ counts, mine, disabled, size = 'md', onToggle }: ReactionBarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  const used = REACTIONS.filter((emoji) => (counts?.[emoji] ?? 0) > 0);
  const height = size === 'sm' ? 30 : 32;
  const fontSize = size === 'sm' ? 11.5 : 12;

  /** Grows the touch target to 44px without moving a single pixel of paint. */
  const hitArea = {
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      top: `${(height - 44) / 2}px`,
      height: 44,
    },
  } as const;

  const chip = (emoji: string, count: number, active: boolean) => (
    <ButtonBase
      key={emoji}
      disabled={disabled}
      onClick={() => onToggle(emoji)}
      aria-pressed={active}
      aria-label={`${emoji} ${count}`}
      component={motion.button}
      {...(reduced ? {} : { whileTap: { scale: 0.9 } })}
      sx={{
        position: 'relative',
        height,
        px: '10px',
        gap: '5px',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: '1px solid',
        borderColor: active ? 'rgba(247,55,24,0.42)' : 'transparent',
        bgcolor: active ? 'rgba(247,55,24,0.14)' : 'surface2',
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        color: active ? 'primary.light' : 'text.secondary',
        transition: 'background-color .14s linear',
        '&.Mui-disabled': { opacity: 0.4 },
        ...hitArea,
      }}
    >
      <Box component="span" sx={{ fontSize: fontSize + 2 }}>
        {emoji}
      </Box>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </Box>
    </ButtonBase>
  );

  return (
    <>
      <Stack direction="row" spacing="6px" alignItems="center" flexWrap="wrap" useFlexGap>
        {used.map((emoji) => chip(emoji, counts?.[emoji] ?? 0, mine.has(emoji)))}

        {!disabled && (
          <ButtonBase
            onClick={(event) => setAnchor(event.currentTarget)}
            aria-label="რეაქციის დამატება"
            sx={{
              position: 'relative',
              height,
              width: height + 6,
              borderRadius: 999,
              border: '1px dashed',
              borderColor: 'divider',
              color: 'text.secondary',
              ...hitArea,
            }}
          >
            <AddReactionIcon sx={{ fontSize: fontSize + 4 }} />
          </ButtonBase>
        )}
      </Stack>

      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { borderRadius: 999, p: 0.5 } } }}
      >
        <Stack direction="row" spacing={0.25}>
          {REACTIONS.map((emoji) => (
            <ButtonBase
              key={emoji}
              onClick={() => {
                onToggle(emoji);
                setAnchor(null);
              }}
              aria-label={emoji}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 999,
                fontSize: 22,
                bgcolor: mine.has(emoji) ? 'rgba(247,55,24,0.12)' : 'transparent',
              }}
            >
              {emoji}
            </ButtonBase>
          ))}
        </Stack>
      </Popover>
    </>
  );
}
