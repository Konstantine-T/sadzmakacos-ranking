import { Stack, Typography } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { ka } from '@/i18n/ka';

export function TriviaPage() {
  return (
    <PageTransition>
      <Stack sx={{ p: 2 }}>
        <Typography variant="h2">{ka.trivia.title}</Typography>
      </Stack>
    </PageTransition>
  );
}
