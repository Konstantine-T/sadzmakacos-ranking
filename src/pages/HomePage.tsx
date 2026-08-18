import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { WeekCard } from '@/features/week/WeekCard';
import { WeekStrip } from '@/features/week/WeekStrip';
import { useAnnouncements, useOpenWeek, useTurnout, weekKeys } from '@/features/week/api';
import { StandingsList } from '@/features/standings/StandingsList';
import { StandingsTable } from '@/features/standings/StandingsTable';
import { ScopeToggle } from '@/features/standings/ScopeToggle';
import { useWideLayout } from '@/app/layout';
import { useCastVote, useMyVotes, useRankedStandings } from '@/features/standings/api';
import { useRankedAllTime, type AllTimeSort } from '@/features/allTime/api';
import { SortPicker } from '@/features/allTime/SortPicker';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { PollCard } from '@/features/polls/PollCard';
import { useActivePolls, useAnswerPoll } from '@/features/polls/api';
import { useAllBadges, useMemberMap } from '@/features/members/api';
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
 * Posts used to be stacked underneath, which meant the screen you open twenty
 * times a day scrolled past the scoreboard into another feature. They live on
 * the posts tab now; this page is the week, the ranking, and the way in to
 * either scope.
 */
export function HomePage() {
  const { member } = useAuth();
  const { toastError } = useToast();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<Scope>('week');
  const [sort, setSort] = useState<AllTimeSort>('total_net');
  const wide = useWideLayout();

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

  const { map: members } = useMemberMap();
  const { polls } = useActivePolls(member?.id);
  const answerPoll = useAnswerPoll();

  if (weekQuery.isPending) return <Splash />;

  if (!week) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ borderRadius: '12px' }}>
          {ka.errors.noOpenWeek}
        </Alert>
      </Box>
    );
  }

  const votingDisabled = week.is_paused;
  const isAllTime = scope === 'allTime';

  // The two boards take the same props on purpose — one set of behaviour, two
  // layouts. Only the shape of a row differs, never what a row can do.
  const Board = wide ? StandingsTable : StandingsList;

  const scopeToggle = (
    <ScopeToggle
      value={scope}
      segments={SCOPES}
      ariaLabel={ka.standings.title}
      onChange={setScope}
    />
  );

  return (
    <PageTransition>
      <Stack sx={{ pt: { xs: 1.75, lg: 0 } }} spacing={wide ? 2.25 : 0}>
        <Stack spacing={2} sx={{ px: { xs: 2, lg: 0 } }}>
          {announcements.data?.map((announcement) => (
            <Alert key={announcement.id} severity="info" sx={{ borderRadius: '12px' }}>
              {announcement.body}
            </Alert>
          ))}

          {/* Same slot as announcements: a transient admin broadcast, above the
              week because it wants answering today. Renders nothing when there
              is no active poll. */}
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              members={members}
              totalMembers={turnout.data?.total_members ?? members.size}
              onAnswer={(optionIds) =>
                answerPoll.mutate({ pollId: poll.id, optionIds }, { onError: toastError })
              }
            />
          ))}

          {wide ? (
            <WeekStrip
              week={week}
              rows={rows}
              onExpire={() => {
                queryClient.invalidateQueries({ queryKey: weekKeys.open });
              }}
            />
          ) : (
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
          )}

          {/* On a phone the scope control gets its own full-width row. Wide, the
              shell's top bar already names the page, so the control takes the
              title's place instead of costing another row. */}
          {!wide && scopeToggle}

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            {wide ? (
              <Box sx={{ width: 260, flex: 'none' }}>{scopeToggle}</Box>
            ) : (
              <Typography variant="h2">
                {isAllTime ? ka.allTime.title : ka.standings.title}
              </Typography>
            )}

            {isAllTime ? (
              <SortPicker value={sort} onChange={setSort} />
            ) : (
              <Typography variant="caption" color="text.secondary">
                {ka.standings.hint}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Box sx={{ mt: { xs: 1, lg: 0 } }}>
          {isAllTime ? (
            // `played` is false while the query is still in flight, so the
            // pending check has to come first or the empty state flashes.
            allTime.isPending || allTime.played ? (
              <Board
                rows={allTime.rows}
                loading={allTime.isPending}
                myId={member?.id}
                allTime
                detailFor={(row) => <AllTimeDetail row={row as AllTimeRow} />}
              />
            ) : (
              <Box sx={{ px: { xs: 2, lg: 0 } }}>
                <Alert severity="info" sx={{ borderRadius: '12px' }}>
                  {ka.allTime.empty}
                </Alert>
              </Box>
            )
          ) : (
            <Board
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
          <Box sx={{ px: { xs: 2, lg: 0 }, pt: 3 }}>
            <BadgeShelf badges={badges.data ?? []} title={ka.allTime.badgeWall} />
          </Box>
        )}
      </Stack>
    </PageTransition>
  );
}
