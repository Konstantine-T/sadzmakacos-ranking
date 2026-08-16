import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useToast } from '@/app/providers/ToastProvider';
import { Splash } from '@/components/Splash';
import { useCloseWeek, useSetWeek } from '@/features/admin/api';
import { useOpenWeek } from '@/features/week/api';
import { dayjs, formatDateTime, tb } from '@/lib/time';
import { ka } from '@/i18n/ka';

export function AdminWeek() {
  const { toast, toastError } = useToast();
  const openWeek = useOpenWeek();
  const setWeek = useSetWeek();
  const closeWeek = useCloseWeek();

  const [endsAt, setEndsAt] = useState<dayjs.Dayjs | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  if (openWeek.isPending) return <Splash />;
  const week = openWeek.data;

  if (!week) {
    return (
      <Alert severity="warning" sx={{ mx: 2, borderRadius: 3 }}>
        {ka.errors.noOpenWeek}
      </Alert>
    );
  }

  const value = endsAt ?? tb(week.ends_at);

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <Paper sx={{ borderRadius: 3, p: 2 }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h3">{ka.week.number(week.id)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {ka.admin.endsAt}: {formatDateTime(week.ends_at)}
            </Typography>
          </Stack>

          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ka">
            <DateTimePicker
              label={ka.admin.endsAt}
              value={value}
              onChange={setEndsAt}
              minDateTime={tb(week.starts_at)}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          </LocalizationProvider>

          <Button
            variant="contained"
            disabled={!endsAt || setWeek.isPending}
            onClick={() =>
              setWeek.mutate(
                { weekId: week.id, endsAt: endsAt!.toISOString() },
                {
                  onSuccess: () => {
                    setEndsAt(null);
                    toast(ka.profile.saved, 'success');
                  },
                  onError: toastError,
                },
              )
            }
          >
            {ka.common.save}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ borderRadius: 3, p: 2 }}>
        <Stack spacing={1.5}>
          {week.is_paused && (
            <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
              {ka.week.paused}
            </Alert>
          )}

          <Button
            variant="outlined"
            color={week.is_paused ? 'primary' : 'inherit'}
            onClick={() =>
              setWeek.mutate(
                { weekId: week.id, isPaused: !week.is_paused },
                { onError: toastError },
              )
            }
          >
            {week.is_paused ? ka.admin.resumeVoting : ka.admin.pauseVoting}
          </Button>

          <Button color="error" variant="outlined" onClick={() => setConfirmClose(true)}>
            {ka.admin.forceClose}
          </Button>
        </Stack>
      </Paper>

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{ka.admin.forceClose}</DialogTitle>
        <DialogContent>
          <DialogContentText>{ka.admin.forceCloseWarning}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmClose(false)}>{ka.common.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={closeWeek.isPending}
            onClick={() =>
              closeWeek.mutate(undefined, {
                onSuccess: () => {
                  setConfirmClose(false);
                  toast(ka.week.closed, 'success');
                },
                onError: toastError,
              })
            }
          >
            {ka.common.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
