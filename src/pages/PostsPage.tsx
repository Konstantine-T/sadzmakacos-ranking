import { Alert, Box, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { useOpenWeek } from '@/features/week/api';
import { useMemberMap } from '@/features/members/api';
import { PostCard } from '@/features/posts/PostCard';
import { PostComposer } from '@/features/posts/PostComposer';
import {
  useCreatePost,
  useMyPostVotes,
  useScoredPosts,
  useVotePost,
} from '@/features/posts/api';
import {
  NO_REACTIONS,
  useMyPostReactions,
  usePostReactionCounts,
  useTogglePostReaction,
} from '@/features/reactions/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { ka } from '@/i18n/ka';

/** Everything the group says out loud this week: one post each, and the votes
 *  and reactions on them. */
export function PostsPage() {
  const { member } = useAuth();
  const { toastError } = useToast();

  const weekQuery = useOpenWeek();
  const week = weekQuery.data;
  const weekId = week?.id;

  useRealtime(weekId);

  const { map: members } = useMemberMap();
  const posts = useScoredPosts(weekId);
  const myPostVotes = useMyPostVotes();
  const createPost = useCreatePost(weekId);
  const votePost = useVotePost(weekId);
  const reactionCounts = usePostReactionCounts(weekId);
  const myReactions = useMyPostReactions();
  const toggleReaction = useTogglePostReaction(weekId);

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

  const alreadyPosted = posts.rows.some((post) => post.author_id === member?.id);

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: { xs: 2, lg: 0 } }}>
        {/* The wide shell's top bar already says "კვირის პოსტები". */}
        <Stack
          direction="row"
          alignItems="baseline"
          justifyContent="space-between"
          sx={{ display: { lg: 'none' } }}
        >
          <Typography variant="h2">{ka.posts.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {ka.posts.oncePerWeek}
          </Typography>
        </Stack>

        <PostComposer
          alreadyPosted={alreadyPosted}
          disabled={week.is_paused}
          submitting={createPost.isPending}
          onSubmit={async (body) => {
            await createPost.mutateAsync(body).catch(toastError);
          }}
        />

        {posts.rows.length === 0 ? (
          <EmptyState text={ka.posts.empty} />
        ) : (
          // One column on a phone, two once there is room — a post is 150
          // characters, so a full-width card at 900px is mostly empty paper.
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
                myVote={myPostVotes.data?.[post.id] ?? null}
                locked={week.is_paused}
                reactionCounts={reactionCounts.counts.get(post.id)}
                myReactions={myReactions.mine.get(post.id) ?? NO_REACTIONS}
                onVote={(value) => votePost.mutate({ postId: post.id, value }, { onError: toastError })}
                onReact={(emoji) =>
                  toggleReaction.mutate({ postId: post.id, emoji }, { onError: toastError })
                }
              />
            ))}
          </Box>
        )}
      </Stack>
    </PageTransition>
  );
}
