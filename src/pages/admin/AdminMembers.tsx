import { useState } from 'react';
import {
  Avatar,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOffRounded';
import { useToast } from '@/app/providers/ToastProvider';
import { Splash } from '@/components/Splash';
import { useCreateMember, useUnlinkMember, useUpdateMember } from '@/features/admin/api';
import { useMembers } from '@/features/members/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';

/**
 * Members are created here BEFORE anyone signs in (§7 step 1) — they exist with
 * auth_user_id = null until the admin links a Google account to them.
 * Deactivating removes someone from voting but preserves all their history.
 */
export function AdminMembers() {
  const { toast, toastError } = useToast();
  const members = useMembers();
  const create = useCreateMember();
  const update = useUpdateMember();
  const unlink = useUnlinkMember();

  const [newNickname, setNewNickname] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (members.isPending) return <Splash />;
  const rows = members.data ?? [];

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <Paper sx={{ borderRadius: 3, p: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            label={ka.admin.createMember}
            value={newNickname}
            onChange={(event) => setNewNickname(event.target.value.slice(0, 24))}
          />
          <Button
            variant="contained"
            disabled={newNickname.trim().length < 2 || create.isPending}
            onClick={() =>
              create.mutate(
                { nickname: newNickname.trim() },
                {
                  onSuccess: () => {
                    setNewNickname('');
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

      {rows.map((member) => {
        const props = avatarProps(member.id, member.nickname, avatarUrl(member.avatar_url));
        const draft = drafts[member.id] ?? member.nickname;

        return (
          <Paper key={member.id} sx={{ borderRadius: 3, p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar {...props} sx={{ ...props.sx, width: 36, height: 36 }} />
                <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {member.nickname}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={member.is_active ? ka.admin.active : ka.admin.inactive}
                      color={member.is_active ? 'default' : 'warning'}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={member.auth_user_id ? ka.admin.linked : ka.admin.notLinked}
                      color={member.auth_user_id ? 'success' : 'default'}
                    />
                    {member.is_admin && <Chip size="small" color="primary" label={ka.nav.admin} />}
                  </Stack>
                </Stack>

                {member.auth_user_id && !member.is_admin && (
                  <IconButton
                    aria-label={ka.admin.unlink}
                    onClick={() => unlink.mutate(member.id, { onError: toastError })}
                  >
                    <LinkOffIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label={ka.admin.nickname}
                  value={draft}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [member.id]: event.target.value.slice(0, 24) }))
                  }
                />
                <Button
                  disabled={draft.trim() === member.nickname || draft.trim().length < 2}
                  onClick={() =>
                    update.mutate(
                      { memberId: member.id, nickname: draft.trim() },
                      { onError: toastError, onSuccess: () => toast(ka.profile.saved, 'success') },
                    )
                  }
                >
                  {ka.common.save}
                </Button>
                <Button
                  color={member.is_active ? 'inherit' : 'primary'}
                  onClick={() =>
                    update.mutate(
                      { memberId: member.id, isActive: !member.is_active },
                      { onError: toastError },
                    )
                  }
                >
                  {member.is_active ? ka.admin.deactivate : ka.admin.activate}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
