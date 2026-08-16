import { Alert, Box, Divider, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { useOpenWeek } from '@/features/week/api';
import { useMemberMap } from '@/features/members/api';
import { PostCard } from '@/features/posts/PostCard';
import { PostComposer } from '@/features/posts/PostComposer';
import { CommentThread } from '@/features/comments/CommentThread';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from '@/features/comments/api';
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

/**
 * Everything the group says out loud this week: the one post each, and the one
 * comment thread.
 *
 * The thread used to hang off the bottom of the board. It belongs here — the
 * board is scores, this tab is words, and the thread had no other home once the
 * board became scores only.
 */
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

  const alreadyPosted = posts.rows.some((post) => post.author_id === member?.id);

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between">
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
          <Stack spacing={1.5}>
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
          </Stack>
        )}

        <Divider sx={{ pt: 1 }} />

        <Typography variant="h2">{ka.comments.title}</Typography>
        {member && (
          <CommentThread
            comments={comments.data ?? []}
            members={members}
            myId={member.id}
            isAdmin={member.isAdmin}
            locked={week.is_paused}
            onCreate={(body) => createComment.mutate(body, { onError: toastError })}
            onEdit={(id, body) => updateComment.mutate({ id, body }, { onError: toastError })}
            onDelete={(id) => deleteComment.mutate(id, { onError: toastError })}
          />
        )}
      </Stack>
    </PageTransition>
  );
}
