import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
import ChevronIcon from '@mui/icons-material/ChevronRightRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { useColorMode } from '@/app/providers/ColorModeProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { AvatarUploader } from '@/features/profile/AvatarUploader';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { RankHistoryChart } from '@/features/profile/RankHistoryChart';
import { WeekBreakdownTable } from '@/features/profile/WeekBreakdownTable';
import { useMemberBadges, useMemberResults, useUpdateMyProfile } from '@/features/members/api';
import { ka } from '@/i18n/ka';

const NICK_MAX = 24;
const BIO_MAX = 160;

/** One 56px line in the settings card. */
function SettingRow({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Typography sx={{ flexGrow: 1, textAlign: 'left', fontSize: 15, fontWeight: 500 }}>
        {label}
      </Typography>
      {children}
    </>
  );

  const sx = {
    width: '100%',
    minHeight: 56,
    px: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    borderBottom: '1px solid',
    borderColor: 'hairline',
    '&:last-of-type': { borderBottom: 0 },
  } as const;

  return onClick ? (
    <ButtonBase onClick={onClick} sx={sx}>
      {content}
    </ButtonBase>
  ) : (
    <Box sx={sx}>{content}</Box>
  );
}

/**
 * Your own profile — the same page everyone else sees of you, plus the controls
 * that used to be crammed into the header.
 *
 * The bottom nav's fourth tab lands here, so this is the natural home for the
 * theme switch and the admin door: both are reachable in two taps from anywhere
 * without spending header width that a 390px screen does not have.
 */
export function MePage() {
  const { member, signOut } = useAuth();
  const { mode, toggle } = useColorMode();
  const { toast, toastError } = useToast();
  const navigate = useNavigate();
  const updateProfile = useUpdateMyProfile();

  const results = useMemberResults(member?.id);
  const badges = useMemberBadges(member?.id);

  const [editing, setEditing] = useState(false);
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
      <Stack spacing={1.75} sx={{ p: 2 }}>
        <ProfileHero
          memberId={member.id}
          nickname={member.nickname}
          bio={member.bio}
          avatarPath={member.avatarUrl}
          results={results.data ?? []}
        />

        <BadgeShelf badges={badges.data ?? []} bare />
        <RankHistoryChart results={results.data ?? []} />
        <WeekBreakdownTable results={results.data ?? []} />

        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary', pt: 1 }}>
          {ka.profile.settings}
        </Typography>

        <Paper sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <SettingRow label={ka.profile.edit} onClick={() => setEditing((open) => !open)}>
            <ChevronIcon
              sx={{
                color: 'text.secondary',
                transform: editing ? 'rotate(90deg)' : 'none',
                transition: 'transform .18s ease',
              }}
            />
          </SettingRow>

          <Collapse in={editing} unmountOnExit>
            <Stack spacing={2} alignItems="center" sx={{ p: 2, bgcolor: 'surface2' }}>
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
          </Collapse>

          <SettingRow label={ka.common.theme}>
            <Typography variant="caption" color="text.secondary">
              {mode === 'dark' ? ka.common.themeDark : ka.common.themeLight}
            </Typography>
            <Switch
              checked={mode === 'light'}
              onChange={toggle}
              inputProps={{ 'aria-label': ka.common.theme }}
            />
          </SettingRow>

          {member.isAdmin && (
            <SettingRow label={ka.nav.admin} onClick={() => navigate('/admin')}>
              <ShieldIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <ChevronIcon sx={{ color: 'text.secondary' }} />
            </SettingRow>
          )}
        </Paper>

        <Button color="inherit" onClick={() => void signOut()}>
          {ka.auth.signOut}
        </Button>
      </Stack>
    </PageTransition>
  );
}
