import { Paper, Skeleton, Stack } from '@mui/material';
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
  /** Present only on the live board; archive pages leave these out. */
  myId?: string;
  myVotes?: Record<string, VoteValue>;
  votingDisabled?: boolean;
  reactionCounts?: CountsByTarget;
  myReactions?: MineByTarget;
  onVote?: (memberId: string, value: VoteValue) => void;
  onReact?: (memberId: string, emoji: string) => void;
}

/**
 * Twenty rows — no virtualisation needed, which is what makes the Framer
 * `layout` reordering affordable. When a vote lands and someone overtakes
 * someone else, the rows physically slide past each other. That is the single
 * most satisfying moment in the app (§9.5), so it gets a real spring rather
 * than a fade.
 */
export function StandingsList({
  rows,
  loading,
  myId,
  myVotes,
  votingDisabled,
  reactionCounts,
  myReactions,
  onVote,
  onReact,
}: StandingsListProps) {
  const reduced = useReducedMotion();
  const max = maxTotalVotes(rows);

  if (loading) {
    return (
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Stack>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={104} sx={{ mb: '1px' }} />
          ))}
        </Stack>
      </Paper>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper sx={{ borderRadius: 3 }}>
        <EmptyState text={ka.standings.empty} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
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
              isSelf={myId === row.member_id}
              myVote={myVotes?.[row.member_id] ?? null}
              votingDisabled={votingDisabled}
              reactionCounts={reactionCounts?.get(row.member_id)}
              myReactions={myReactions?.get(row.member_id) ?? NO_REACTIONS}
              onVote={onVote ? (value) => onVote(row.member_id, value) : undefined}
              onReact={onReact ? (emoji) => onReact(row.member_id, emoji) : undefined}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </Paper>
  );
}
