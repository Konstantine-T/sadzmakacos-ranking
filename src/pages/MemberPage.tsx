import { useParams } from 'react-router-dom';
import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { NotFoundPage } from './NotFoundPage';
import { RankHistoryChart } from '@/features/profile/RankHistoryChart';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { WeekBreakdownTable } from '@/features/profile/WeekBreakdownTable';
import { useMember, useMemberBadges, useMemberResults } from '@/features/members/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';

/** A stat block big enough to read as "Wrapped" — quarantined to profiles (§9.1). */
function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <Stack alignItems="center" spacing={0.25} sx={{ flex: 1 }}>
      <Typography variant="numeral" sx={{ fontSize: 30, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" textAlign="center">
        {label}
      </Typography>
    </Stack>
  );
}

export function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const memberQuery = useMember(id);
  const results = useMemberResults(id);
  const badges = useMemberBadges(id);

  if (memberQuery.isPending) return <Splash />;
  if (!memberQuery.data) return <NotFoundPage />;

  const member = memberQuery.data;
  const rows = results.data ?? [];
  const weeksAtOne = rows.filter((r) => r.rank === 1).length;
  const bestRank = rows.length > 0 ? Math.min(...rows.map((r) => r.rank)) : null;

  const props = avatarProps(member.id, member.nickname, avatarUrl(member.avatar_url));

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Paper sx={{ borderRadius: 3, p: 3 }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar {...props} sx={{ ...props.sx, width: 88, height: 88, fontSize: '2rem' }} />

            <Stack spacing={0.5} alignItems="center">
              <Typography variant="h1">{member.nickname}</Typography>
              {member.bio && (
                <Typography variant="body2" color="text.secondary">
                  {member.bio}
                </Typography>
              )}
            </Stack>

            <Box sx={{ display: 'flex', width: '100%', pt: 1 }}>
              <Stat
                value={weeksAtOne}
                label={ka.profile.weeksAtOne}
                color={weeksAtOne > 0 ? signal.gold : undefined}
              />
              <Stat value={bestRank ?? '–'} label={ka.profile.bestRank} />
              <Stat value={rows.length} label={ka.profile.weeksPlayed} />
            </Box>
          </Stack>
        </Paper>

        <BadgeShelf badges={badges.data ?? []} />
        <RankHistoryChart results={rows} />
        <WeekBreakdownTable results={rows} />
      </Stack>
    </PageTransition>
  );
}
