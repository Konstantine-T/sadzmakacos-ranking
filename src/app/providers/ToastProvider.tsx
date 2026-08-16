import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { errorToKa } from '@/i18n/ka';

type Severity = 'success' | 'error' | 'info';

interface Toast {
  message: string;
  severity: Severity;
  key: number;
}

interface ToastContextValue {
  toast: (message: string, severity?: Severity) => void;
  /** Turns a thrown Postgres/network error into a Georgian sentence. */
  toastError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  toastError: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);

  const toast = useCallback((message: string, severity: Severity = 'info') => {
    setCurrent({ message, severity, key: Date.now() });
  }, []);

  const toastError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    setCurrent({ message: errorToKa(message), severity: 'error', key: Date.now() });
  }, []);

  const value = useMemo(() => ({ toast, toastError }), [toast, toastError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.key}
        open={current !== null}
        autoHideDuration={4000}
        onClose={() => setCurrent(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 'calc(64px + env(safe-area-inset-bottom) + 12px)', sm: 24 } }}
      >
        <Alert
          onClose={() => setCurrent(null)}
          severity={current?.severity ?? 'info'}
          variant="filled"
          sx={{ borderRadius: 2, width: '100%' }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
