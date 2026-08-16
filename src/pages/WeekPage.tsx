import { useParams } from 'react-router-dom';
import { Alert, Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { NotFoundPage } from './NotFoundPage';
import { useWeek } from '@/features/week/api';
import { useWeekStandings } from '@/features/standings/api';
import { StandingsList } from '@/features/standings/StandingsList';
import { PostCard } from '@/features/posts/PostCard';
import { useScoredPosts } from '@/features/posts/api';
import { CommentThread } from '@/features/comments/CommentThread';
import { useComments } from '@/features/comments/api';
import { useMemberMap } from '@/features/members/api';
import { usePostReactionCounts } from '@/features/reactions/api';
import { formatDay } from '@/lib/time';
import { ka } from '@/i18n/ka';

/**
 * A frozen week (rule 3). Everything here is read from the snapshot in
 * weekly_results — nothing is recomputed from votes, and nothing is editable:
 * the comment thread is locked and the ranking rows carry no vote buttons or
 * reactions (ranking reactions are current-week only, §1.6).
 */
export function WeekPage() {
  const { id } = useParams<{ id: string }>();
  const weekId = Number(id);
  const valid = Number.isFinite(weekId);

  const { member } = useAuth();
  const weekQuery = useWeek(valid ? weekId : undefined);
  const standings = useWeekStandings(valid ? weekId : undefined);
  const posts = useScoredPosts(valid ? weekId : undefined);
  const comments = useComments(valid ? weekId : undefined);
  const { map: members } = useMemberMap();
  const postReactions = usePostReactionCounts(valid ? weekId : undefined);

  if (!valid) return <NotFoundPage />;
  if (weekQuery.isPending) return <Splash />;
  if (!weekQuery.data) return <NotFoundPage />;

  const week = weekQuery.data;
  const isOpen = week.status === 'open';

  const rows = (standings.data ?? []).map((row) => ({
    member_id: row.member_id,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    up: row.up,
    down: row.down,
    net: row.net,
    total_votes: row.total_votes,
    rank: row.rank,
    movement: row.movement,
  }));

  return (
    <PageTransition>
      <Stack spacing={3} sx={{ pt: 2 }}>
        <Paper sx={{ mx: 2, borderRadius: 3, p: 2.5 }}>
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

        <Box sx={{ px: 2 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>
            {ka.standings.title}
          </Typography>

          {isOpen ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              {ka.week.current}
            </Alert>
          ) : (
            <StandingsList rows={rows} loading={standings.isPending} />
          )}
        </Box>

        <Divider sx={{ mx: 2 }} />

        <Stack spacing={1.5} sx={{ px: 2 }}>
          <Typography variant="h2">{ka.posts.title}</Typography>
          {posts.rows.length === 0 ? (
            <EmptyState text={ka.posts.emptyArchive} />
          ) : (
            posts.rows.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={members.get(post.author_id)}
                myVote={null}
                locked
                reactionCounts={postReactions.counts.get(post.id)}
              />
            ))
          )}
        </Stack>

        <Stack spacing={1} sx={{ px: 2 }}>
          <Typography variant="h2">{ka.comments.title}</Typography>
          {member && (
            <CommentThread
              comments={comments.data ?? []}
              members={members}
              myId={member.id}
              isAdmin={member.isAdmin}
              locked
              onCreate={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          )}
        </Stack>
      </Stack>
    </PageTransition>
  );
}
