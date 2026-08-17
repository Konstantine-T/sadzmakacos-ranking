import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Three tiers, and the numbers are not arbitrary — each one is the width at
 * which the next piece of furniture actually fits.
 *
 *   below `lg`  phone layout: bottom bar, stacked rows, one narrow column.
 *               Rule 5 still holds; this is the tier that gets designed first.
 *   `lg` and up rail + table. The table's columns floor at 762px; add the 236px
 *               rail and 56px of gutters and 1200 is the first width that holds
 *               it without crushing a column.
 *   `WIDEST`    adds the right rail. 236 + 56 + 762 + 24 + 320 = 1398, so 1440
 *               is the first standard width where nothing has to give.
 */
export const WIDEST = 1440;

/** Rail navigation and the table board. */
export function useWideLayout(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('lg'));
}

/** Wide, plus enough room for the peripheral column. */
export function useWidestLayout(): boolean {
  return useMediaQuery(`(min-width:${WIDEST}px)`);
}
