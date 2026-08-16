import { Box, Paper, Stack, Typography } from '@mui/material';

/**
 * Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. This is
 * the only screen in the app that is deliberately in English — it is a
 * developer message, not user-facing copy, so rule 4 does not apply.
 */
export function SetupPage() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Paper sx={{ borderRadius: 3, p: 3, maxWidth: 460 }}>
        <Stack spacing={2}>
          <Typography variant="h2">Supabase is not configured</Typography>
          <Typography variant="body2" color="text.secondary">
            Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL and
            anon key, then restart the dev server. See <code>SETUP.md</code> for the full checklist.
          </Typography>
          <Paper
            variant="outlined"
            component="pre"
            sx={{ p: 2, borderRadius: 2, fontSize: 12, overflowX: 'auto', m: 0 }}
          >
            {'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY='}
          </Paper>
        </Stack>
      </Paper>
    </Box>
  );
}
