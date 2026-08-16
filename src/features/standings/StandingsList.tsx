import { useState } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { StandingsRow, type StandingsRowData } from './StandingsRow';
import { EmptyState } from '@/components/Splash';
import { maxTotalVotes } from '@/lib/ranking';
import { ka } from '@/i18n/ka';
import type { VoteValue } from './api';
import { NO_REACTIONS, type CountsByTarget, type MineByTarget } from '@/features/reactions/api';

interface StandingsListProps {
  rows: StandingsRowData[];
  loading?: boolean;
  /** Present only on the live board; archive and all-time leave these out. */
  myId?: string;
  myVotes?: Record<string, VoteValue>;
  votingDisabled?: boolean;
  allTime?: boolean;
  reactionCounts?: CountsByTarget;
  myReactions?: MineByTarget;
  /** Extra facts revealed when a row opens, keyed by member. */
  detailFor?: (row: StandingsRowData) => React.ReactNode;
  onVote?: (memberId: string, value: VoteValue) => void;
  onReact?: (memberId: string, emoji: string) => void;
}

/**
 * Twenty rows — no virtualisation needed, which is what makes the Framer
 * `layout` reordering affordable. When a vote lands and someone overtakes
 * someone else, the rows physically slide past each other. That is the single
 * most satisfying moment in the app (§9.5), so it gets a real spring rather
 * than a fade.
 *
 * The board is full-bleed: no card, no side gutters, just hairlines between
 * rows. Each row's heat strip runs edge to edge, so the whole week reads as one
 * continuous temperature chart rather than twenty separate tiles.
 *
 * One row is open at a time. Opening a second closes the first, which keeps the
 * board from turning into an accordion of everything.
 */
export function StandingsList({
  rows,
  loading,
  myId,
  myVotes,
  votingDisabled,
  allTime,
  reactionCounts,
  myReactions,
  detailFor,
  onVote,
  onReact,
}: StandingsListProps) {
  const reduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const max = maxTotalVotes(rows);

  if (loading) {
    return (
      <Stack sx={{ borderTop: '1px solid', borderColor: 'hairline' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={73} sx={{ mb: '1px' }} />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return <EmptyState text={ka.standings.empty} />;
  }

  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'hairline' }}>
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.div
            key={row.member_id}
            layout={reduced ? false : 'position'}
            transition={
              reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }
            }
            style={{ position: 'relative' }}
          >
            <StandingsRow
              row={row}
              max={max}
              expanded={openId === row.member_id}
              onToggle={() => setOpenId((id) => (id === row.member_id ? null : row.member_id))}
              isSelf={myId === row.member_id}
              myVote={myVotes?.[row.member_id] ?? null}
              votingDisabled={votingDisabled}
              allTime={allTime}
              reactionCounts={reactionCounts?.get(row.member_id)}
              myReactions={myReactions?.get(row.member_id) ?? NO_REACTIONS}
              detail={detailFor?.(row)}
              onVote={onVote ? (value) => onVote(row.member_id, value) : undefined}
              onReact={onReact ? (emoji) => onReact(row.member_id, emoji) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  );
}
