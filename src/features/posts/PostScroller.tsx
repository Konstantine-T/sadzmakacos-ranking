import { Box } from '@mui/material';
import { PostCard } from './PostCard';
import { EmptyState } from '@/components/Splash';
import { NO_REACTIONS, type CountsByTarget, type MineByTarget } from '@/features/reactions/api';
import { ka } from '@/i18n/ka';
import type { Member } from '@/lib/database.types';
import type { VoteValue } from '@/features/standings/api';
import type { ScoredPost } from './api';

interface PostScrollerProps {
  posts: ScoredPost[];
  members: Map<string, Member>;
  myVotes: Record<string, VoteValue>;
  locked?: boolean;
  reactionCounts?: CountsByTarget;
  myReactions?: MineByTarget;
  onVote?: (postId: string, value: VoteValue) => void;
  onReact?: (postId: string, emoji: string) => void;
  emptyText?: string;
}

/**
 * Horizontal snap-scroll with a partial peek of the next card, so the sideways
 * scroll is discoverable without a hint label (§9.6). Sorted by net score
 * descending — the ordering is done in useScoredPosts.
 */
export function PostScroller({
  posts,
  members,
  myVotes,
  locked,
  reactionCounts,
  myReactions,
  onVote,
  onReact,
  emptyText = ka.posts.empty,
}: PostScrollerProps) {
  if (posts.length === 0) return <EmptyState text={emptyText} />;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        px: 2,
        pb: 1,
        // The peek: cards stop short of the viewport width.
        '& > *': { scrollSnapAlign: 'start', flex: '0 0 82%', maxWidth: 320 },
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        overscrollBehaviorX: 'contain',
      }}
    >
      {posts.map((post) => (
        <Box key={post.id}>
          <PostCard
            post={post}
            author={members.get(post.author_id)}
            myVote={myVotes[post.id] ?? null}
            locked={locked}
            reactionCounts={reactionCounts?.get(post.id)}
            myReactions={myReactions?.get(post.id) ?? NO_REACTIONS}
            onVote={onVote ? (value) => onVote(post.id, value) : undefined}
            onReact={onReact ? (emoji) => onReact(post.id, emoji) : undefined}
          />
        </Box>
      ))}
    </Box>
  );
}
