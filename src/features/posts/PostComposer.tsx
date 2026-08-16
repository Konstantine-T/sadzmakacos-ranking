import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ka } from '@/i18n/ka';

const MAX = 150;

interface PostComposerProps {
  alreadyPosted: boolean;
  disabled?: boolean;
  submitting?: boolean;
  onSubmit: (body: string) => Promise<void>;
}

/**
 * One post per member per week, and it is ONE-SHOT: once submitted it cannot be
 * edited or deleted by the author (§1.4). The confirmation dialog says so in as
 * many words before anything is sent — this is the only place in the app where
 * an action is genuinely irreversible for a player.
 */
export function PostComposer({
  alreadyPosted,
  disabled,
  submitting,
  onSubmit,
}: PostComposerProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remaining = MAX - body.length;
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && remaining >= 0 && !disabled && !submitting;

  if (alreadyPosted) {
    return (
      <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
        {ka.posts.alreadyPosted}
      </Alert>
    );
  }

  // Collapsed: a dashed slot that states the irreversible part before you have
  // typed anything, rather than a textarea that looks like a draft box.
  if (!open) {
    return (
      <Box
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: '14px',
          p: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: (t) => (t.palette.mode === 'dark' ? '#1A1514' : t.palette.surface2),
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, textWrap: 'pretty' }}>
          {ka.posts.prompt}
        </Typography>
        <Button
          variant="contained"
          size="small"
          disabled={disabled}
          onClick={() => setOpen(true)}
          sx={{ flex: 'none', boxShadow: '0 6px 20px rgba(247,55,24,0.28)' }}
        >
          {ka.posts.write}
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Paper sx={{ borderRadius: '14px', p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            multiline
            minRows={2}
            maxRows={5}
            fullWidth
            value={body}
            autoFocus
            disabled={disabled || submitting}
            placeholder={ka.posts.compose}
            onChange={(event) => setBody(event.target.value.slice(0, MAX + 20))}
            inputProps={{ 'aria-label': ka.posts.compose }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography
              variant="caption"
              sx={{ color: remaining < 0 ? 'error.main' : 'text.secondary' }}
            >
              {ka.posts.limit(remaining)}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setOpen(false);
                  setBody('');
                }}
              >
                {ka.posts.cancel}
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!canSubmit}
                onClick={() => setConfirmOpen(true)}
              >
                {ka.posts.confirm}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{ka.posts.confirmTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{ka.posts.onceWarning}</DialogContentText>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {trimmed}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>{ka.posts.cancel}</Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={async () => {
              await onSubmit(trimmed);
              setConfirmOpen(false);
              setBody('');
              setOpen(false);
            }}
          >
            {ka.posts.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
