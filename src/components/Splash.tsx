import { Box, CircularProgress, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

export function Splash({ label = ka.common.loading }: { label?: string }) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={28} thickness={5} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

/** Centred message for empty states — an invitation, not a shrug (§10). */
export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ py: 5, px: 3, textAlign: 'center', display: 'grid', gap: 2, justifyItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
      {action}
    </Box>
  );
}
