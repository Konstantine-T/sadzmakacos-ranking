import { useParams } from 'react-router-dom';
import { Stack } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { NotFoundPage } from './NotFoundPage';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { RankHistoryChart } from '@/features/profile/RankHistoryChart';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { WeekBreakdownTable } from '@/features/profile/WeekBreakdownTable';
import { useMember, useMemberBadges, useMemberResults } from '@/features/members/api';

export function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const memberQuery = useMember(id);
  const results = useMemberResults(id);
  const badges = useMemberBadges(id);

  if (memberQuery.isPending) return <Splash />;
  if (!memberQuery.data) return <NotFoundPage />;

  const member = memberQuery.data;
  const rows = results.data ?? [];

  return (
    <PageTransition>
      <Stack spacing={1.75} sx={{ p: 2 }}>
        <ProfileHero
          memberId={member.id}
          nickname={member.nickname}
          bio={member.bio}
          avatarPath={member.avatar_url}
          results={rows}
        />
        <BadgeShelf badges={badges.data ?? []} bare />
        <RankHistoryChart results={rows} />
        <WeekBreakdownTable results={rows} />
      </Stack>
    </PageTransition>
  );
}
