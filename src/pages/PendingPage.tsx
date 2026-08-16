import { Navigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { Splash } from '@/components/Splash';
import { ka } from '@/i18n/ka';

/**
 * A full-screen dead end (§7 step 4): no app data is reachable from here. The
 * AuthProvider polls `me()` every 15s, so the moment the admin links the
 * account this page turns into the app by itself.
 */
export function PendingPage() {
  const { status, session, signOut } = useAuth();

  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Navigate to="/login" replace />;
  if (status === 'active') return <Navigate to="/" replace />;

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 3 }}>
      <Stack spacing={3} alignItems="center" textAlign="center" sx={{ maxWidth: 340 }}>
        <CircularProgress size={30} thickness={4} />

        <Stack spacing={1}>
          <Typography variant="h2">{ka.auth.pendingTitle}</Typography>
          <Typography variant="body1" color="text.secondary">
            {ka.auth.pendingBody}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.auth.pendingHint}
          </Typography>
        </Stack>

        {session?.user.email && (
          <Typography variant="caption" color="text.secondary">
            {ka.auth.signedInAs(session.user.email)}
          </Typography>
        )}

        <Button size="small" onClick={() => void signOut()}>
          {ka.auth.signOut}
        </Button>
      </Stack>
    </Box>
  );
}
