import { Box } from '@mui/material';

interface UnreadChipProps {
  count: number;
  /** `bell` overlaps the icon's top-right corner; `inline` sits after a label. */
  variant?: 'inline' | 'bell';
}

/**
 * The ember unread count.
 *
 * It renders in two unrelated places — beside a nav label and over the bell —
 * and they have to be the same object, so it lives here rather than being
 * written twice.
 *
 * A NOTE ON THE COLOUR. tokens.ts reserves #F73718 for brand and interactive
 * accents specifically so it does not get diluted, and the bottom bar already
 * spends it on the active-tab dash. So an ember chip on an inactive tab means
 * "go here" two inches from an ember dash meaning "you are here". That
 * collision is a deliberate, accepted call — the count reads instantly and
 * that was judged worth more than the purity of the accent. If the bar ever
 * feels noisy, signal.up amber is the escape hatch and only this file changes.
 *
 * Renders nothing at zero, so callers never have to guard.
 */
export function UnreadChip({ count, variant = 'inline' }: UnreadChipProps) {
  if (count <= 0) return null;

  const bell = variant === 'bell';

  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        // Beyond two digits the pill starts pushing the nav label around, and
        // the exact number stops mattering — you have plenty either way.
        minWidth: bell ? 15 : 16,
        height: bell ? 15 : 16,
        px: '5px',
        borderRadius: 999,
        bgcolor: 'primary.main',
        color: '#fff',
        fontSize: bell ? 9.5 : 10.5,
        fontWeight: 700,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontVariantNumeric: 'tabular-nums',
        ...(bell && {
          position: 'absolute',
          top: -2,
          right: -4,
          // Punches the chip out of the icon so the digits stay legible over
          // whatever the header is blurring behind it.
          border: '1.5px solid',
          borderColor: 'background.default',
        }),
      }}
    >
      {count > 99 ? '99+' : count}
    </Box>
  );
}
