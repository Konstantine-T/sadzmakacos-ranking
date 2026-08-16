import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { AvatarUploader } from '@/features/profile/AvatarUploader';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { RankHistoryChart } from '@/features/profile/RankHistoryChart';
import { useMemberBadges, useMemberResults, useUpdateMyProfile } from '@/features/members/api';
import { ka } from '@/i18n/ka';

const NICK_MAX = 24;
const BIO_MAX = 160;

export function MePage() {
  const { member, signOut } = useAuth();
  const { toast, toastError } = useToast();
  const updateProfile = useUpdateMyProfile();

  const results = useMemberResults(member?.id);
  const badges = useMemberBadges(member?.id);

  const [nickname, setNickname] = useState(member?.nickname ?? '');
  const [bio, setBio] = useState(member?.bio ?? '');

  if (!member) return <Splash />;

  const dirty = nickname !== member.nickname || bio !== (member.bio ?? '');
  const canSave = dirty && nickname.trim().length >= 2 && !updateProfile.isPending;

  const save = (patch: { nickname?: string; bio?: string | null; avatar_url?: string | null }) => {
    updateProfile.mutate(
      { id: member.id, ...patch },
      {
        onSuccess: () => toast(ka.profile.saved, 'success'),
        onError: toastError,
      },
    );
  };

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Typography variant="h1">{ka.profile.edit}</Typography>

        <Paper sx={{ borderRadius: 3, p: 3 }}>
          <Stack spacing={2.5} alignItems="center">
            <AvatarUploader
              memberId={member.id}
              nickname={member.nickname}
              currentPath={member.avatarUrl}
              onUploaded={(path) => save({ avatar_url: path })}
              onError={toastError}
            />

            <TextField
              fullWidth
              label={ka.profile.nickname}
              value={nickname}
              onChange={(event) => setNickname(event.target.value.slice(0, NICK_MAX))}
              helperText={`${nickname.length}/${NICK_MAX}`}
            />

            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              label={ka.profile.bio}
              value={bio}
              onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX))}
              helperText={`${bio.length}/${BIO_MAX}`}
            />

            <Button
              fullWidth
              variant="contained"
              disabled={!canSave}
              onClick={() => save({ nickname: nickname.trim(), bio: bio.trim() || null })}
            >
              {ka.common.save}
            </Button>
          </Stack>
        </Paper>

        <Button component={RouterLink} to={`/members/${member.id}`} variant="outlined" fullWidth>
          {ka.profile.history}
        </Button>

        <BadgeShelf badges={badges.data ?? []} />
        <RankHistoryChart results={results.data ?? []} />

        <Divider />

        <Button color="inherit" onClick={() => void signOut()}>
          {ka.auth.signOut}
        </Button>
      </Stack>
    </PageTransition>
  );
}
