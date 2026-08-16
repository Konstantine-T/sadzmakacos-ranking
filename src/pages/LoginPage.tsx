import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { Splash } from '@/components/Splash';
import { ka } from '@/i18n/ka';
import { ember, signal } from '@/theme/tokens';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const { toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const reduced = useReducedMotion();

  if (status === 'loading') return <Splash />;
  if (status === 'active') return <Navigate to="/" replace />;
  if (status === 'pending') return <Navigate to="/pending" replace />;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* One quarantined Wrapped-ish flourish: an ember glow behind the mark. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          filter: 'blur(90px)',
          opacity: 0.4,
          background: `radial-gradient(circle, ${ember[500]} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Stack spacing={4} alignItems="center" sx={{ position: 'relative', maxWidth: 360 }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, mb: 1 }}>
              <Box sx={{ width: 10, height: 44, borderRadius: 99, bgcolor: signal.up }} />
              <Box sx={{ width: 10, height: 64, borderRadius: 99, bgcolor: ember[500] }} />
              <Box sx={{ width: 10, height: 28, borderRadius: 99, bgcolor: signal.down }} />
            </Box>
            <Typography variant="display" component="h1" sx={{ fontSize: '2.25rem' }}>
              {ka.appName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ka.auth.loginTagline}
            </Typography>
          </Stack>
        </motion.div>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={busy}
          startIcon={<GoogleIcon />}
          onClick={async () => {
            setBusy(true);
            try {
              await signIn();
            } catch (error) {
              toastError(error);
              setBusy(false);
            }
          }}
        >
          {ka.auth.signIn}
        </Button>
      </Stack>
    </Box>
  );
}
