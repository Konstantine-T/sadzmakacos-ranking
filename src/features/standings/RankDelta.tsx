import { Box } from '@mui/material';
import { ka } from '@/i18n/ka';

interface RankDeltaProps {
  /** prev_rank − rank. Positive = climbed. `null` = no previous week. */
  movement: number | null;
  /** All-time has no "last week" to move against, so it shows a dash. */
  muted?: boolean;
}

/**
 * ▲2 / ▼1 / · / ახალი (§1.3), as a chip.
 *
 * It sits on a row that already carries a coloured wash, so bare text lost the
 * fight — the chip gives the movement its own small plate to stand on.
 */
export function RankDelta({ movement, muted }: RankDeltaProps) {
  const chip = (label: string, color: string, bg: string, aria?: string) => (
    <Box
      component="span"
      aria-label={aria}
      sx={{
        flex: 'none',
        height: 17,
        px: '5px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: '17px',
        fontVariantNumeric: 'tabular-nums',
        color,
        bgcolor: bg,
      }}
    >
      {label}
    </Box>
  );

  if (muted) return chip('—', 'text.secondary', 'surface2');
  if (movement === null) return chip(ka.standings.new, 'primary.main', 'rgba(247,55,24,0.12)');
  if (movement === 0) return chip('·', 'text.secondary', 'surface2', 'უცვლელი');

  const climbed = movement > 0;
  return chip(
    `${climbed ? '▲' : '▼'} ${Math.abs(movement)}`,
    climbed ? 'signal.up' : 'signal.down',
    climbed ? 'rgba(255,178,36,0.12)' : 'rgba(110,134,171,0.14)',
    `${climbed ? 'ავიდა' : 'ჩამოვიდა'} ${Math.abs(movement)} ადგილით`,
  );
}
