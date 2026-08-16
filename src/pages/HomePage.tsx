import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { WeekCountdown } from '@/features/week/WeekCountdown';
import { TurnoutBar } from '@/features/week/TurnoutBar';
import { useAnnouncements, useOpenWeek, useTurnout, weekKeys } from '@/features/week/api';
import { StandingsList } from '@/features/standings/StandingsList';
import { useCastVote, useMyVotes, useRankedStandings } from '@/features/standings/api';
import { PostScroller } from '@/features/posts/PostScroller';
import { useMyPostVotes, useScoredPosts, useVotePost } from '@/features/posts/api';
import { CommentThread } from '@/features/comments/CommentThread';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from '@/features/comments/api';
import {
  useMemberReactionCounts,
  useMyMemberReactions,
  useMyPostReactions,
  usePostReactionCounts,
  useToggleMemberReaction,
  useTogglePostReaction,
} from '@/features/reactions/api';
import { useMemberMap } from '@/features/members/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { formatDay } from '@/lib/time';
import { ka } from '@/i18n/ka';

export function HomePage() {
  const { member } = useAuth();
  const { toastError } = useToast();
  const queryClient = useQueryClient();

  const weekQuery = useOpenWeek();
  const week = weekQuery.data;
  const weekId = week?.id;

  useRealtime(weekId);

  const { rows, isPending } = useRankedStandings(weekId);
  const myVotes = useMyVotes(weekId);
  const turnout = useTurnout(weekId);
  const { map: members } = useMemberMap();
  const announcements = useAnnouncements();

  const castVote = useCastVote(weekId);
  const memberReactions = useMemberReactionCounts(weekId);
  const myMemberReactions = useMyMemberReactions(weekId);
  const toggleMemberReaction = useToggleMemberReaction(weekId);

  const posts = useScoredPosts(weekId);
  const myPostVotes = useMyPostVotes();
  const votePost = useVotePost(weekId);
  const postReactions = usePostReactionCounts(weekId);
  const myPostReactions = useMyPostReactions();
  const togglePostReaction = useTogglePostReaction(weekId);

  const comments = useComments(weekId);
  const createComment = useCreateComment(weekId);
  const updateComment = useUpdateComment(weekId);
  const deleteComment = useDeleteComment(weekId);

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

  return (
    <PageTransition>
      <Stack spacing={3} sx={{ pt: 2 }}>
        {announcements.data?.map((announcement) => (
          <Alert key={announcement.id} severity="info" sx={{ mx: 2, borderRadius: 3 }}>
            {announcement.body}
          </Alert>
        ))}

        {/* ---- the week header: countdown + turnout ---- */}
        <Paper sx={{ mx: 2, borderRadius: 3, p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Stack spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  {ka.week.current}
                </Typography>
                <Typography variant="h3">
                  {ka.week.range(formatDay(week.starts_at), formatDay(week.ends_at))}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
                {ka.week.endsIn}
              </Typography>
            </Stack>

            <WeekCountdown
              endsAt={week.ends_at}
              onExpire={() => {
                // The cron job closes the week server-side; refetch so the new
                // one appears without a manual reload.
                queryClient.invalidateQueries({ queryKey: weekKeys.open });
              }}
            />

            {votingDisabled && (
              <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                {ka.week.paused}
              </Alert>
            )}

            <TurnoutBar
              voters={turnout.data?.voters ?? 0}
              total={turnout.data?.total_members ?? 0}
            />
          </Stack>
        </Paper>

        {/* ---- the scoreboard ---- */}
        <Box sx={{ px: 2 }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h2">{ka.standings.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {ka.vote.secret}
            </Typography>
          </Stack>

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
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* ---- this week's posts ---- */}
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="baseline"
            justifyContent="space-between"
            sx={{ px: 2 }}
          >
            <Typography variant="h2">{ka.posts.title}</Typography>
            <Button component={RouterLink} to="/posts" size="small">
              {ka.nav.posts}
            </Button>
          </Stack>

          <PostScroller
            posts={posts.rows}
            members={members}
            myVotes={myPostVotes.data ?? {}}
            locked={votingDisabled}
            reactionCounts={postReactions.counts}
            myReactions={myPostReactions.mine}
            onVote={(postId, value) =>
              votePost.mutate({ postId, value }, { onError: toastError })
            }
            onReact={(postId, emoji) =>
              togglePostReaction.mutate({ postId, emoji }, { onError: toastError })
            }
          />
        </Stack>

        {/* ---- the week's one comment thread ---- */}
        <Stack spacing={1} sx={{ px: 2 }}>
          <Typography variant="h2">{ka.comments.title}</Typography>
          {member && (
            <CommentThread
              comments={comments.data ?? []}
              members={members}
              myId={member.id}
              isAdmin={member.isAdmin}
              locked={votingDisabled}
              onCreate={(body) => createComment.mutate(body, { onError: toastError })}
              onEdit={(id, body) => updateComment.mutate({ id, body }, { onError: toastError })}
              onDelete={(id) => deleteComment.mutate(id, { onError: toastError })}
            />
          )}
        </Stack>
      </Stack>
    </PageTransition>
  );
}
