import { Box, ButtonBase } from '@mui/material';
import UpIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import DownIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LeftIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import RightIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import type { Dir } from './direction';

const KEY = 60; // comfortably past the 44px floor, and a thumb is not precise

interface SnakeDpadProps {
  onDirection: (d: Dir) => void;
}

const KEYS = [
  { dir: 'up' as const, Icon: UpIcon, col: 2, row: 1 },
  { dir: 'left' as const, Icon: LeftIcon, col: 1, row: 2 },
  { dir: 'right' as const, Icon: RightIcon, col: 3, row: 2 },
  { dir: 'down' as const, Icon: DownIcon, col: 2, row: 3 },
];

/**
 * Four arrows, in a cross.
 *
 * This replaced an analogue thumb stick. The stick looked better and played
 * worse: an analogue control has to decide what a diagonal means, so a push
 * between two axes either flickers between directions or resolves to one you
 * did not intend, and neither is forgivable when a wrong turn ends the run. A
 * discrete key cannot be misread — you either pressed up or you did not.
 *
 * `onPointerDown` rather than `onClick`, because a click waits for the release
 * and snake is played in the gap between two ticks.
 *
 * Swipe on the board still works; this is an addition, not a replacement.
 */
export function SnakeDpad({ onDirection }: SnakeDpadProps) {
  return (
    <Box
      role="group"
      aria-label="d-pad"
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${KEY}px)`,
        gridTemplateRows: `repeat(3, ${KEY}px)`,
        gap: 0.75,
        flex: 'none',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {KEYS.map(({ dir, Icon, col, row }) => (
        <ButtonBase
          key={dir}
          aria-label={dir}
          onPointerDown={(e) => {
            e.preventDefault();
            onDirection(dir);
          }}
          sx={{
            gridColumn: col,
            gridRow: row,
            borderRadius: '14px',
            bgcolor: 'surface2',
            border: '1px solid',
            borderColor: 'border',
            color: 'text.primary',
            transition: 'background-color .1s linear, transform .1s ease-out',
            '&:active': { bgcolor: 'primary.main', color: 'primary.contrastText', transform: 'scale(0.94)' },
          }}
        >
          <Icon />
        </ButtonBase>
      ))}
    </Box>
  );
}
