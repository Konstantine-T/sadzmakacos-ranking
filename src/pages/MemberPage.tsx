import { useParams } from 'react-router-dom';
import { Box, Stack } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { NotFoundPage } from './NotFoundPage';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { RankHistoryChart } from '@/features/profile/RankHistoryChart';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { WeekBreakdownTable } from '@/features/profile/WeekBreakdownTable';
import { useMember, useMemberBadges, useMemberResults } from '@/features/members/api';
import { useWideLayout } from '@/app/layout';

export function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const memberQuery = useMember(id);
  const results = useMemberResults(id);
  const badges = useMemberBadges(id);
  const wide = useWideLayout();

  if (memberQuery.isPending) return <Splash />;
  if (!memberQuery.data) return <NotFoundPage />;

  const member = memberQuery.data;
  const rows = results.data ?? [];
  const shelf = <BadgeShelf badges={badges.data ?? []} bare hideTitle={wide} />;

  return (
    <PageTransition>
      <Stack spacing={wide ? 2 : 1.75} sx={{ p: { xs: 2, lg: 0 } }}>
        <ProfileHero
          memberId={member.id}
          nickname={member.nickname}
          bio={member.bio}
          avatarPath={member.avatar_url}
          results={rows}
          wide={wide}
          badges={shelf}
        />

        {/* Wide, the badges ride along inside the hero. */}
        {!wide && shelf}

        {/* The two history views are the same length, so side by side they
            answer "how have I been doing" without a scroll. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <RankHistoryChart results={rows} />
          <WeekBreakdownTable results={rows} />
        </Box>
      </Stack>
    </PageTransition>
  );
}
