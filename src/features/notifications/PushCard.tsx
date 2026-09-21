import { useEffect, useState } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { isInstalled, isIos } from '@/lib/pwa';
import { disablePush, enablePush, isPushEnabled, pushPermission, pushSupported } from './push';
import { ka } from '@/i18n/ka';

/**
 * Turning push on for THIS device.
 *
 * Per device, not per account, because that is how the browser models it: a
 * subscription belongs to one installation, so the phone and the laptop are
 * asked separately and can disagree.
 *
 * The iOS branch is not decoration. Safari exposes no PushManager at all in a
 * normal tab, so on an uninstalled iPhone the button would ask for a permission
 * that can never be granted. Better to say why.
 */
export function PushCard() {
  const { toastError } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isPushEnabled().then(setEnabled);
  }, []);

  const supported = pushSupported();
  const iosUninstalled = isIos() && !isInstalled();
  const blocked = pushPermission() === 'denied';

  const message = !supported
    ? iosUninstalled
      ? ka.push.needsInstall
      : ka.push.unsupported
    : blocked
      ? ka.push.blocked
      : ka.push.why;

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Stack direction="row" alignItems="baseline" justifyContent="space-between">
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.push.title}</Typography>
        {enabled && (
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
            {ka.push.enabled}
          </Typography>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {message}
      </Typography>

      {supported && !blocked && (
        <Button
          fullWidth
          variant={enabled ? 'outlined' : 'contained'}
          disabled={busy || enabled === null}
          sx={{ height: 48, mt: 1.75 }}
          onClick={async () => {
            setBusy(true);
            try {
              if (enabled) {
                await disablePush();
                setEnabled(false);
              } else {
                // Must run inside the click: Safari ignores a permission
                // request that did not come from a gesture, without an error.
                setEnabled(await enablePush());
              }
            } catch (e) {
              toastError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {enabled ? ka.push.enabled : ka.push.enable}
        </Button>
      )}
    </Paper>
  );
}
