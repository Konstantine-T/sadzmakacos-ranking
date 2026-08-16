import { Box, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { ka } from '@/i18n/ka';

/** "14/20 ხმა მიცემულია" (§5) — how many people have voted at all this week. */
export function TurnoutBar({ voters, total }: { voters: number; total: number }) {
  const reduced = useReducedMotion();
  const pct = total > 0 ? Math.min(100, (voters / total) * 100) : 0;

  return (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      <Typography variant="caption" color="text.secondary">
        {ka.week.turnout(voters, total)}
      </Typography>
      <Box
        sx={{
          height: 4,
          borderRadius: 99,
          bgcolor: (t) => t.palette.surface2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30 }}
          style={{ height: '100%' }}
        >
          <Box sx={{ height: '100%', width: '100%', bgcolor: 'primary.main', borderRadius: 99 }} />
        </motion.div>
      </Box>
    </Stack>
  );
}
