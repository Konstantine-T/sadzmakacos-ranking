import { Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

export function TriviaTestPage() {
  return (
    <Stack sx={{ p: 2 }}>
      <Typography variant="h2">{ka.trivia.skills.name}</Typography>
    </Stack>
  );
}
