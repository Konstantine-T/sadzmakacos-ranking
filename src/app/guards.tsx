import { Navigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { useAuth } from './providers/AuthProvider';
import { Splash } from '@/components/Splash';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ka } from '@/i18n/ka';

/**
 * Route guards (§7):
 *   not signed in            → /login
 *   signed in, no member     → /pending
 *   deactivated member       → a dead end, not the app
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, signOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location }} />;
  if (status === 'pending') return <Navigate to="/pending" replace />;

  if (status === 'inactive') {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: 2,
          textAlign: 'center',
          px: 3,
        }}
      >
        <Typography variant="h2">{ka.auth.inactive}</Typography>
        <Button onClick={() => void signOut()}>{ka.auth.signOut}</Button>
      </Box>
    );
  }

  return <>{children}</>;
}

/**
 * Admin routes render a 404 for everyone else rather than a 403 — there is no
 * reason to advertise that /admin exists (§7).
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, member } = useAuth();

  if (status === 'loading') return <Splash />;
  if (status !== 'active' || !member?.isAdmin) return <NotFoundPage />;

  return <>{children}</>;
}
