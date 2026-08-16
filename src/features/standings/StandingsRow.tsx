import { Avatar, Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { HeatBar } from './HeatBar';
import { VoteToggle } from './VoteToggle';
import { RankDelta } from './RankDelta';
import { ReactionBar } from '@/features/reactions/ReactionBar';
import { NO_REACTIONS } from '@/features/reactions/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { VoteValue } from './api';

export interface StandingsRowData {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  up: number;
  down: number;
  net: number;
  total_votes: number;
  rank: number;
  movement: number | null;
}

interface StandingsRowProps {
  row: StandingsRowData;
  max: number;
  /** Omit onVote/onReact to render a read-only row — that is what archive
   *  pages use, since ranking reactions are scoped to the current week (§1.6). */
  myVote?: VoteValue;
  isSelf?: boolean;
  votingDisabled?: boolean;
  reactionCounts?: Record<string, number>;
  myReactions?: Set<string>;
  onVote?: (value: VoteValue) => void;
  onReact?: (emoji: string) => void;
}

/**
 * On a 390px screen the row collapses to three bands (§9.6):
 *   rank · avatar · nickname · delta          … vote buttons
 *   HeatBar
 *   up/down counts · reactions
 */
export function StandingsRow({
  row,
  max,
  myVote = null,
  isSelf = false,
  votingDisabled = false,
  reactionCounts,
  myReactions = NO_REACTIONS,
  onVote,
  onReact,
}: StandingsRowProps) {
  const isFirst = row.rank === 1;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        display: 'grid',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        ...(isFirst && {
          // Gold is reserved for rank #1 and nothing else.
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: signal.gold,
          },
        }),
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Typography
          variant="numeral"
          sx={{
            minWidth: 28,
            fontSize: 20,
            textAlign: 'right',
            color: isFirst ? signal.gold : 'text.secondary',
          }}
        >
          {row.rank}
        </Typography>

        <Avatar
          {...avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url))}
          sx={{
            ...avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url)).sx,
            width: 36,
            height: 36,
          }}
        />

        <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            component={RouterLink}
            to={`/members/${row.member_id}`}
            variant="h4"
            noWrap
            sx={{ color: 'text.primary', textDecoration: 'none' }}
          >
            {row.nickname}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <RankDelta movement={row.movement} />
            <Typography variant="caption" color="text.secondary">
              {ka.standings.net}{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {row.net > 0 ? `+${row.net}` : row.net}
              </Box>
            </Typography>
          </Stack>
        </Stack>

        {onVote && (
          <VoteToggle value={myVote} isSelf={isSelf} disabled={votingDisabled} onChange={onVote} />
        )}
      </Stack>

      <HeatBar up={row.up} down={row.down} max={max} />

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1.25} alignItems="center">
          {row.total_votes === 0 ? (
            <Typography variant="caption" color="text.secondary">
              {ka.standings.noVotes}
            </Typography>
          ) : (
            <>
              <Typography
                variant="caption"
                sx={{ color: 'signal.up', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                ▲ {row.up}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'signal.down', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                ▼ {row.down}
              </Typography>
            </>
          )}
        </Stack>

        {onReact && (
          <ReactionBar
            size="sm"
            counts={reactionCounts}
            mine={myReactions}
            disabled={votingDisabled}
            onToggle={onReact}
          />
        )}
      </Stack>
    </Box>
  );
}
