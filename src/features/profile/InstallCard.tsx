import { useEffect, useState } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { isInstalled, isIos } from '@/lib/pwa';
import { ka } from '@/i18n/ka';

/** Chrome's install prompt, which is not in the DOM lib's types. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * The one screen that explains how to get the app onto a phone.
 *
 * Two completely different jobs behind one card. Chrome fires
 * `beforeinstallprompt`, so Android gets a real button that opens the system
 * dialog. Safari fires nothing and offers no API at all, so iOS gets
 * instructions — and they have to name Safari explicitly, because Add to Home
 * Screen from Chrome on iOS produces a bookmark that cannot receive push.
 *
 * Renders nothing once the app is installed. A card telling you to install
 * something you are already inside is how an app looks unfinished.
 */
export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Chrome shows its own banner otherwise, at a moment of its choosing.
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const ios = isIos();
  // Nothing useful to say: not iOS, and Chrome has not offered a prompt.
  if (!ios && !prompt) return null;

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'border' }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.install.title}</Typography>
      <Typography variant="caption" color="text.secondary">
        {ka.install.why}
      </Typography>

      {ios ? (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{ka.install.iosTitle}</Typography>
          {[ka.install.iosStep1, ka.install.iosStep2, ka.install.iosStep3].map((step, i) => (
            <Typography key={step} sx={{ fontSize: 13, color: 'text.secondary' }}>
              {i + 1}. {step}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Button
          fullWidth
          variant="contained"
          sx={{ height: 48, mt: 1.75 }}
          onClick={async () => {
            await prompt!.prompt();
            const { outcome } = await prompt!.userChoice;
            // The event is single-use; a dismissed prompt cannot be reopened.
            setPrompt(null);
            if (outcome === 'accepted') setInstalled(true);
          }}
        >
          {ka.install.button}
        </Button>
      )}
    </Paper>
  );
}
