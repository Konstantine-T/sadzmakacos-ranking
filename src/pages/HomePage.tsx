import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { WeekCard } from '@/features/week/WeekCard';
import { useAnnouncements, useOpenWeek, useTurnout, weekKeys } from '@/features/week/api';
import { StandingsList } from '@/features/standings/StandingsList';
import { ScopeToggle } from '@/features/standings/ScopeToggle';
import { useCastVote, useMyVotes, useRankedStandings } from '@/features/standings/api';
import { useRankedAllTime, type AllTimeSort } from '@/features/allTime/api';
import { SortPicker } from '@/features/allTime/SortPicker';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { useAllBadges } from '@/features/members/api';
import {
  useMemberReactionCounts,
  useMyMemberReactions,
  useToggleMemberReaction,
} from '@/features/reactions/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { ka } from '@/i18n/ka';
import type { AllTimeRow } from '@/features/allTime/api';

type Scope = 'week' | 'allTime';

const SCOPES = [
  { value: 'week' as const, label: ka.week.label },
  { value: 'allTime' as const, label: ka.nav.allTime },
];

/** The extra numbers an all-time row reveals when you open it. */
function AllTimeDetail({ row }: { row: AllTimeRow }) {
  const stat = (value: string | number, label: string) => (
    <Stack direction="row" spacing={0.75} alignItems="baseline">
      <Box
        component="span"
        sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
      {stat(row.avg_net.toFixed(1), ka.allTime.avgNet)}
      {stat(row.weeks_at_one, ka.profile.weeksAtOne)}
      {stat(row.weeks_played, ka.profile.weeksPlayed)}
    </Stack>
  );
}

/**
 * The board (§1.1–1.3) and nothing else.
 *
 * Posts and their comment thread used to be stacked underneath, which meant the
 * screen you open twenty times a day scrolled past the scoreboard into two
 * other features. They live on the posts tab now; this page is the week, the
 * ranking, and the way in to either scope.
 */
export function HomePage() {
  const { member } = useAuth();
  const { toastError } = useToast();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<Scope>('week');
  const [sort, setSort] = useState<AllTimeSort>('total_net');

  const weekQuery = useOpenWeek();
  const week = weekQuery.data;
  const weekId = week?.id;

  useRealtime(weekId);

  const { rows, isPending } = useRankedStandings(weekId);
  const myVotes = useMyVotes(weekId);
  const turnout = useTurnout(weekId);
  const announcements = useAnnouncements();

  const castVote = useCastVote(weekId);
  const memberReactions = useMemberReactionCounts(weekId);
  const myMemberReactions = useMyMemberReactions(weekId);
  const toggleMemberReaction = useToggleMemberReaction(weekId);

  const allTime = useRankedAllTime(sort);
  const badges = useAllBadges();

  if (weekQuery.isPending) return <Splash />;

  if (!week) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: 3 }}>
          {ka.errors.noOpenWeek}
        </Alert>
      </Box>
    );
  }

  const votingDisabled = week.is_paused;
  const isAllTime = scope === 'allTime';

  return (
    <PageTransition>
      <Stack sx={{ pt: 1.75 }}>
        <Stack spacing={2} sx={{ px: 2 }}>
          {announcements.data?.map((announcement) => (
            <Alert key={announcement.id} severity="info" sx={{ borderRadius: 3 }}>
              {announcement.body}
            </Alert>
          ))}

          <WeekCard
            week={week}
            voters={turnout.data?.voters ?? 0}
            total={turnout.data?.total_members ?? 0}
            onExpire={() => {
              // The cron job closes the week server-side; refetch so the new
              // one appears without a manual reload.
              queryClient.invalidateQueries({ queryKey: weekKeys.open });
            }}
          />

          <ScopeToggle
            value={scope}
            segments={SCOPES}
            ariaLabel={ka.standings.title}
            onChange={setScope}
          />

          <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
            <Typography variant="h2">
              {isAllTime ? ka.allTime.title : ka.standings.title}
            </Typography>
            {isAllTime ? (
              <SortPicker value={sort} onChange={setSort} />
            ) : (
              <Typography variant="caption" color="text.secondary">
                {ka.standings.hint}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Box sx={{ mt: 1 }}>
          {isAllTime ? (
            // `played` is false while the query is still in flight, so the
            // pending check has to come first or the empty state flashes.
            allTime.isPending || allTime.played ? (
              <StandingsList
                rows={allTime.rows}
                loading={allTime.isPending}
                myId={member?.id}
                allTime
                detailFor={(row) => <AllTimeDetail row={row as AllTimeRow} />}
              />
            ) : (
              <Box sx={{ px: 2 }}>
                <Alert severity="info" sx={{ borderRadius: 3 }}>
                  {ka.allTime.empty}
                </Alert>
              </Box>
            )
          ) : (
            <StandingsList
              rows={rows}
              loading={isPending}
              myId={member?.id}
              myVotes={myVotes.data}
              votingDisabled={votingDisabled}
              reactionCounts={memberReactions.counts}
              myReactions={myMemberReactions.mine}
              onVote={(memberId, value) =>
                castVote.mutate({ targetId: memberId, value }, { onError: toastError })
              }
              onReact={(memberId, emoji) =>
                toggleMemberReaction.mutate({ memberId, emoji }, { onError: toastError })
              }
            />
          )}
        </Box>

        {isAllTime && allTime.played && (
          <Box sx={{ px: 2, pt: 3 }}>
            <BadgeShelf badges={badges.data ?? []} title={ka.allTime.badgeWall} />
          </Box>
        )}
      </Stack>
    </PageTransition>
  );
}
