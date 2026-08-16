import { useState } from 'react';
import { Button, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/Splash';
import { useAllAnnouncements, useCreateAnnouncement, useSetAnnouncement } from '@/features/admin/api';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

const MAX = 280;

/** A banner on the landing page. Active ones show to everyone. */
export function AdminAnnouncements() {
  const { toast, toastError } = useToast();
  const announcements = useAllAnnouncements();
  const create = useCreateAnnouncement();
  const setActive = useSetAnnouncement();
  const [body, setBody] = useState('');

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <Paper sx={{ borderRadius: 3, p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label={ka.admin.announcementBody}
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, MAX))}
            helperText={ka.posts.limit(MAX - body.length)}
          />
          <Button
            variant="contained"
            disabled={body.trim().length === 0 || create.isPending}
            onClick={() =>
              create.mutate(body.trim(), {
                onSuccess: () => {
                  setBody('');
                  toast(ka.profile.saved, 'success');
                },
                onError: toastError,
              })
            }
          >
            {ka.admin.publish}
          </Button>
        </Stack>
      </Paper>

      {(announcements.data ?? []).length === 0 ? (
        <Paper sx={{ borderRadius: 3 }}>
          <EmptyState text={ka.archive.empty} />
        </Paper>
      ) : (
        (announcements.data ?? []).map((announcement) => (
          <Paper key={announcement.id} sx={{ borderRadius: 3, p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {announcement.body}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(announcement.created_at)}
                </Typography>
              </Stack>
              <Switch
                checked={announcement.is_active}
                inputProps={{ 'aria-label': announcement.is_active ? ka.admin.hide : ka.admin.show }}
                onChange={(_, checked) =>
                  setActive.mutate(
                    { id: announcement.id, isActive: checked },
                    { onError: toastError },
                  )
                }
              />
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
