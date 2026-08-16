import { Component, type ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ka } from '@/i18n/ka';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ranki] render error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h2">{ka.errors.generic}</Typography>
          <Typography variant="caption" color="text.secondary">
            {this.state.error.message}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            {ka.common.retry}
          </Button>
        </Stack>
      </Box>
    );
  }
}
