import { Box, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

/** ▲2 / ▼1 / – / ახალი (§1.3). */
export function RankDelta({ movement }: { movement: number | null }) {
  if (movement === null) {
    return (
      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
        {ka.standings.new}
      </Typography>
    );
  }

  if (movement === 0) {
    return (
      <Typography variant="caption" color="text.secondary" aria-label="უცვლელი">
        –
      </Typography>
    );
  }

  const climbed = movement > 0;

  return (
    <Box
      component="span"
      aria-label={`${climbed ? 'ავიდა' : 'ჩამოვიდა'} ${Math.abs(movement)} ადგილით`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: climbed ? 'signal.up' : 'signal.down',
      }}
    >
      {climbed ? '▲' : '▼'}
      {Math.abs(movement)}
    </Box>
  );
}
