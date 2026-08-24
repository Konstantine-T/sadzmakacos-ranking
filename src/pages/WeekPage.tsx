import { useParams } from 'react-router-dom';
import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { NotFoundPage } from './NotFoundPage';
import { useWeek } from '@/features/week/api';
import { useWeekStandings } from '@/features/standings/api';
import { StandingsList } from '@/features/standings/StandingsList';
import { StandingsTable } from '@/features/standings/StandingsTable';
import { PostCard } from '@/features/posts/PostCard';
import { useWideLayout } from '@/app/layout';
import { sortFrozen } from '@/lib/ranking';
import { useScoredPosts } from '@/features/posts/api';
import { useMemberMap } from '@/features/members/api';
import {
  useMemberReactionCounts,
  useMyMemberReactions,
  usePostReactionCounts,
} from '@/features/reactions/api';
import { formatDay } from '@/lib/time';
import { ka } from '@/i18n/ka';

/**
 * A frozen week (rule 3). The standings are read from the snapshot in
 * weekly_results — nothing is recomputed from votes — and nothing here is
 * editable: no vote buttons, and the reaction bars are read-only.
 *
 * The reactions ARE shown, unlike the vote buttons. They need no snapshot to
 * satisfy rule 3 because they are already frozen at the source:
 * `toggle_member_reaction` resolves the open week server-side, so a closed
 * week's counts can never move again. This overrides plan §1.6's
 * "current week only", which was written before a week had ever closed.
 */
export function WeekPage() {
  const { id } = useParams<{ id: string }>();
  const weekId = Number(id);
  const valid = Number.isFinite(weekId);

  const wide = useWideLayout();
  const weekQuery = useWeek(valid ? weekId : undefined);
  const standings = useWeekStandings(valid ? weekId : undefined);
  const posts = useScoredPosts(valid ? weekId : undefined);
  const { map: members } = useMemberMap();
  const postReactions = usePostReactionCounts(valid ? weekId : undefined);
  const memberReactions = useMemberReactionCounts(valid ? weekId : undefined);
  const myMemberReactions = useMyMemberReactions(valid ? weekId : undefined);

  if (!valid) return <NotFoundPage />;
  if (weekQuery.isPending) return <Splash />;
  if (!weekQuery.data) return <NotFoundPage />;

  const week = weekQuery.data;
  const isOpen = week.status === 'open';

  // The frozen `rank` is authoritative (rule 3) — sortFrozen only decides the
  // order rows appear in, which Postgres leaves unspecified within a tie.
  const rows = sortFrozen(
    (standings.data ?? []).map((row) => ({
      member_id: row.member_id,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      up: row.up,
      down: row.down,
      net: row.net,
      total_votes: row.total_votes,
      rank: row.rank,
      movement: row.movement,
    })),
  );

  // A closed week should look like the same board, frozen — so it picks the
  // same layout the live board would at this width.
  const Board = wide ? StandingsTable : StandingsList;

  return (
    <PageTransition>
      <Stack spacing={3} sx={{ pt: { xs: 2, lg: 0 } }}>
        <Paper sx={{ mx: { xs: 2, lg: 0 }, borderRadius: '16px', p: 2.5 }}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h1">{ka.week.number(week.id)}</Typography>
              <Chip
                size="small"
                label={isOpen ? ka.archive.open : ka.archive.closed}
                color={isOpen ? 'primary' : 'default'}
                variant={isOpen ? 'filled' : 'outlined'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {ka.week.range(formatDay(week.starts_at), formatDay(week.ends_at))}
            </Typography>
          </Stack>
        </Paper>

        <Box>
          <Typography variant="h2" sx={{ px: { xs: 2, lg: 0 }, mb: 1 }}>
            {ka.standings.title}
          </Typography>

          {isOpen ? (
            <Alert severity="info" sx={{ mx: { xs: 2, lg: 0 }, borderRadius: '12px' }}>
              {ka.week.current}
            </Alert>
          ) : (
            // No onReact: the bars render, highlight your own emoji, refuse the tap.
            <Board
              rows={rows}
              loading={standings.isPending}
              reactionCounts={memberReactions.counts}
              myReactions={myMemberReactions.mine}
            />
          )}
        </Box>

        <Divider sx={{ mx: { xs: 2, lg: 0 } }} />

        <Stack spacing={1.5} sx={{ px: { xs: 2, lg: 0 } }}>
          <Typography variant="h2">{ka.posts.title}</Typography>
          {posts.rows.length === 0 ? (
            <EmptyState text={ka.posts.emptyArchive} />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 1.75,
                alignItems: 'start',
              }}
            >
              {posts.rows.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  author={members.get(post.author_id)}
                  myVote={null}
                  locked
                  reactionCounts={postReactions.counts.get(post.id)}
                />
              ))}
            </Box>
          )}
        </Stack>
      </Stack>
    </PageTransition>
  );
}
