import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ka } from '@/i18n/ka';

export function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', px: 3 }}>
      <Stack spacing={2} alignItems="center" textAlign="center">
        <Typography variant="display" sx={{ opacity: 0.25 }}>
          404
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {ka.errors.notFound}
        </Typography>
        <Button component={RouterLink} to="/" variant="outlined">
          {ka.nav.ranking}
        </Button>
      </Stack>
    </Box>
  );
}
