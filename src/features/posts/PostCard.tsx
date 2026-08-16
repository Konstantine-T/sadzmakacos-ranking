import { Avatar, Box, ButtonBase, IconButton, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { ReactionBar } from '@/features/reactions/ReactionBar';
import { NO_REACTIONS } from '@/features/reactions/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { formatShort } from '@/lib/time';
import { ka } from '@/i18n/ka';
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

const MotionButtonBase = motion.create(ButtonBase);

/**
 * Author is visible on posts — unlike votes, posts are signed (§1.4).
 *
 * The vote controls carry their own count inside the pill rather than sitting
 * next to a loose number. A post has exactly two scores and they belong to the
 * buttons that change them.
 */
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
  const press = reduced ? {} : { whileTap: { scale: 0.94 } };
  const ava = avatarProps(post.author_id, nickname, avatarUrl(author?.avatar_url ?? null));

  const voteButton = (direction: 1 | -1, count: number) => {
    const active = myVote === direction;
    const tint = direction === 1 ? 'signal.up' : 'signal.down';

    return (
      <MotionButtonBase
        {...press}
        disabled={locked || !onVote}
        aria-pressed={active}
        aria-label={direction === 1 ? ka.vote.up : ka.vote.down}
        onClick={() => onVote?.(active ? null : direction)}
        sx={{
          height: 44,
          px: '13px',
          gap: '6px',
          borderRadius: 999,
          border: '1px solid',
          borderColor: active
            ? direction === 1
              ? 'rgba(255,178,36,0.44)'
              : 'rgba(110,134,171,0.44)'
            : 'divider',
          bgcolor: active
            ? direction === 1
              ? 'signal.upSoft'
              : 'signal.downSoft'
            : 'transparent',
          color: active ? tint : 'text.secondary',
          fontSize: 12.5,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          transition: 'background-color .14s linear',
          '&.Mui-disabled': { opacity: 0.4 },
        }}
      >
        {direction === 1 ? '▲' : '▼'} {count}
      </MotionButtonBase>
    );
  };

  return (
    <Paper
      sx={{
        borderRadius: 4,
        p: 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.4,
        height: '100%',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar {...ava} sx={{ ...ava.sx, width: 30, height: 30, fontSize: '0.75rem' }} />
        <Typography
          component={RouterLink}
          to={`/members/${post.author_id}`}
          noWrap
          sx={{
            flexGrow: 1,
            fontSize: 13.5,
            fontWeight: 600,
            color: 'text.primary',
            textDecoration: 'none',
          }}
        >
          {nickname}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatShort(post.created_at)}
        </Typography>
        {onAdminDelete && (
          <IconButton size="small" onClick={onAdminDelete} aria-label={ka.common.delete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Typography
        sx={{ flexGrow: 1, fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}
      >
        {post.body}
      </Typography>

      <Box sx={{ height: '1px', bgcolor: 'surface2' }} />

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1}>
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
