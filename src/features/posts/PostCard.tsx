import { Avatar, Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import UpIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import DownIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { ReactionBar } from '@/features/reactions/ReactionBar';
import { NO_REACTIONS } from '@/features/reactions/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { formatShort } from '@/lib/time';
import type { Member } from '@/lib/database.types';
import type { VoteValue } from '@/features/standings/api';
import type { ScoredPost } from './api';

interface PostCardProps {
  post: ScoredPost;
  author: Member | undefined;
  myVote: VoteValue;
  /** Closed weeks render read-only. */
  locked?: boolean;
  reactionCounts?: Record<string, number>;
  myReactions?: Set<string>;
  onVote?: (value: VoteValue) => void;
  onReact?: (emoji: string) => void;
  onAdminDelete?: () => void;
}

const MotionIconButton = motion.create(IconButton);

/** Author is visible on posts — unlike votes, posts are signed (§1.4). */
export function PostCard({
  post,
  author,
  myVote,
  locked,
  reactionCounts,
  myReactions = NO_REACTIONS,
  onVote,
  onReact,
  onAdminDelete,
}: PostCardProps) {
  const reduced = useReducedMotion();
  const nickname = author?.nickname ?? '—';
  const press = reduced ? {} : { whileTap: { scale: 0.88 } };

  const voteButton = (direction: 1 | -1, count: number) => {
    const active = myVote === direction;
    return (
      <Stack direction="row" spacing={0.25} alignItems="center">
        <MotionIconButton
          {...press}
          size="small"
          disabled={locked || !onVote}
          aria-pressed={active}
          aria-label={direction === 1 ? 'ზემოთ' : 'ქვემოთ'}
          onClick={() => onVote?.(active ? null : direction)}
          sx={{
            width: 36,
            height: 36,
            color: active ? (direction === 1 ? 'signal.up' : 'signal.down') : 'text.secondary',
          }}
        >
          {direction === 1 ? <UpIcon /> : <DownIcon />}
        </MotionIconButton>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 12 }}
        >
          {count}
        </Typography>
      </Stack>
    );
  };

  return (
    <Paper
      sx={{
        borderRadius: 3,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar
          {...avatarProps(post.author_id, nickname, avatarUrl(author?.avatar_url ?? null))}
          sx={{
            ...avatarProps(post.author_id, nickname, avatarUrl(author?.avatar_url ?? null)).sx,
            width: 28,
            height: 28,
            fontSize: '0.75rem',
          }}
        />
        <Typography
          component={RouterLink}
          to={`/members/${post.author_id}`}
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', flexGrow: 1 }}
        >
          {nickname}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatShort(post.created_at)}
        </Typography>
        {onAdminDelete && (
          <IconButton size="small" onClick={onAdminDelete} aria-label="წაშლა">
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Typography variant="body1" sx={{ flexGrow: 1, whiteSpace: 'pre-wrap' }}>
        {post.body}
      </Typography>

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {voteButton(1, post.up)}
          {voteButton(-1, post.down)}
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          <ReactionBar
            size="sm"
            counts={reactionCounts}
            mine={myReactions}
            disabled={locked || !onReact}
            onToggle={(emoji) => onReact?.(emoji)}
          />
        </Box>
      </Stack>
    </Paper>
  );
}
