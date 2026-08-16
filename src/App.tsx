import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { ColorModeProvider } from '@/app/providers/ColorModeProvider';
import { ToastProvider } from '@/app/providers/ToastProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppRoutes } from '@/app/routes';
import { SetupPage } from '@/pages/SetupPage';
import { isConfigured } from '@/lib/supabase';

export default function App() {
  return (
    <QueryProvider>
      <ColorModeProvider>
        <ErrorBoundary>
          {!isConfigured ? (
            <SetupPage />
          ) : (
            <ToastProvider>
              <AuthProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </AuthProvider>
            </ToastProvider>
          )}
        </ErrorBoundary>
      </ColorModeProvider>
    </QueryProvider>
  );
}
