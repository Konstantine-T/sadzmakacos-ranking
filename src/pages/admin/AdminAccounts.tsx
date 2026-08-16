import { useState } from 'react';
import {
  Avatar,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState, Splash } from '@/components/Splash';
import { useLinkAccount, usePendingAccounts, useRejectAccount } from '@/features/admin/api';
import { useMembers } from '@/features/members/api';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

/**
 * Step 5 of the onboarding flow (§7): a pending Google sign-in gets linked to
 * one of the pre-created members. Linking sets members.auth_user_id and drops
 * the pending row, and the waiting user's screen turns into the app within 15s.
 */
export function AdminAccounts() {
  const { toast, toastError } = useToast();
  const pending = usePendingAccounts();
  const members = useMembers();
  const link = useLinkAccount();
  const reject = useRejectAccount();

  const [selection, setSelection] = useState<Record<string, string>>({});

  if (pending.isPending || members.isPending) return <Splash />;

  const unlinked = (members.data ?? []).filter((m) => m.auth_user_id === null && m.is_active);
  const rows = pending.data ?? [];

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <Typography variant="h3">{ka.admin.pendingAccounts}</Typography>

      {rows.length === 0 ? (
        <Paper sx={{ borderRadius: 3 }}>
          <EmptyState text={ka.admin.noPending} />
        </Paper>
      ) : (
        rows.map((account) => (
          <Paper key={account.auth_user_id} sx={{ borderRadius: 3, p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar src={account.google_avatar ?? undefined} sx={{ width: 40, height: 40 }}>
                  {(account.google_name ?? account.email)[0]?.toUpperCase()}
                </Avatar>
                <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {account.google_name ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {account.email}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(account.created_at)}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={ka.admin.linkTo}
                  value={selection[account.auth_user_id] ?? ''}
                  onChange={(event) =>
                    setSelection((prev) => ({
                      ...prev,
                      [account.auth_user_id]: event.target.value,
                    }))
                  }
                >
                  {unlinked.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.nickname}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  disabled={!selection[account.auth_user_id] || link.isPending}
                  onClick={() =>
                    link.mutate(
                      {
                        authUserId: account.auth_user_id,
                        memberId: selection[account.auth_user_id],
                      },
                      { onError: toastError, onSuccess: () => toast(ka.profile.saved, 'success') },
                    )
                  }
                >
                  {ka.admin.link}
                </Button>

                <Button
                  color="inherit"
                  onClick={() =>
                    reject.mutate(account.auth_user_id, { onError: toastError })
                  }
                >
                  {ka.admin.reject}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
