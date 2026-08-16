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
 * Only emoji that somebody has actually used are shown inline; the rest live
 * behind the add button. On a 390px screen with twenty rows, five always-on
 * chips per row would eat the layout.
 */
export function ReactionBar({ counts, mine, disabled, size = 'md', onToggle }: ReactionBarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  const used = REACTIONS.filter((emoji) => (counts?.[emoji] ?? 0) > 0);
  const chipHeight = size === 'sm' ? 26 : 30;
  const fontSize = size === 'sm' ? 12 : 13;

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
        height: chipHeight,
        px: 0.9,
        gap: 0.4,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 99,
        border: '1px solid',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'rgba(247,55,24,0.12)' : 'transparent',
        fontSize,
        lineHeight: 1,
        color: 'text.secondary',
        '&.Mui-disabled': { opacity: 0.4 },
      }}
    >
      <Box component="span" sx={{ fontSize: fontSize + 2 }}>
        {emoji}
      </Box>
      <Box
        component="span"
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'text.primary' }}
      >
        {count}
      </Box>
    </ButtonBase>
  );

  return (
    <>
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
        {used.map((emoji) => chip(emoji, counts?.[emoji] ?? 0, mine.has(emoji)))}

        {!disabled && (
          <ButtonBase
            onClick={(event) => setAnchor(event.currentTarget)}
            aria-label="რეაქციის დამატება"
            sx={{
              height: chipHeight,
              width: chipHeight + 4,
              borderRadius: 99,
              border: '1px dashed',
              borderColor: 'divider',
              color: 'text.secondary',
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
        slotProps={{ paper: { sx: { borderRadius: 99, p: 0.5 } } }}
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
                borderRadius: 99,
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
