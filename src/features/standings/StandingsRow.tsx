import { Avatar, Box, Collapse, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { HeatBar } from './HeatBar';
import { VoteToggle } from './VoteToggle';
import { RankDelta } from './RankDelta';
import { ReactionBar } from '@/features/reactions/ReactionBar';
import { NO_REACTIONS } from '@/features/reactions/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import { rowHeat, toneOf } from '@/theme/heat';
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
  expanded?: boolean;
  onToggle?: () => void;
  /** Omit onVote/onReact to render a read-only row — that is what archive
   *  pages and the all-time board use, since ranking reactions are scoped to
   *  the current week (§1.6). */
  myVote?: VoteValue;
  isSelf?: boolean;
  votingDisabled?: boolean;
  /** All-time rows have no week to move against and no reactions. */
  allTime?: boolean;
  reactionCounts?: Record<string, number>;
  myReactions?: Set<string>;
  /** Extra facts revealed on expand — all-time uses this for avg/weeks. */
  detail?: React.ReactNode;
  onVote?: (value: VoteValue) => void;
  onReact?: (emoji: string) => void;
}

const TONE_LABEL = {
  warm: ka.standings.toneWarm,
  cold: ka.standings.toneCold,
  divisive: ka.standings.toneDivisive,
} as const;

/** Structural, so it fits whichever element's event type it lands on. */
const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * One row of the board, at 390px (§9.6):
 *
 *   ▏ 1  (A)  ლაშა  შენ            [▲│▼]
 *   ▏     ▲2   ჯამი +12
 *   ▔▔▔▔▔▔▔▔▔▔▔▔◼▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   ← the 5px heat strip
 *
 * The whole row is a tap target that opens the detail: exact counts, the week's
 * one-word verdict, and reactions. Reactions used to sit in every row all the
 * time, which meant twenty rows of chips competing with the thing you came to
 * read. They now cost one tap and the board stays a board.
 *
 * Two things deliberately swallow that tap: the nickname (goes to the profile)
 * and the vote pill (votes).
 */
export function StandingsRow({
  row,
  max,
  expanded = false,
  onToggle,
  myVote = null,
  isSelf = false,
  votingDisabled = false,
  allTime = false,
  reactionCounts,
  myReactions = NO_REACTIONS,
  detail,
  onVote,
  onReact,
}: StandingsRowProps) {
  const theme = useTheme();
  const heat = rowHeat(row, max, theme.palette.mode === 'dark');
  const ava = avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url));

  const hasDetail = Boolean(onReact || detail || row.total_votes > 0);

  return (
    <Box
      sx={{
        position: 'relative',
        borderBottom: '1px solid',
        borderColor: 'hairline',
        background: heat.wash,
        transition: 'background .2s linear',
      }}
    >
      {/* the edge: gold for #1, ember for the rest of the podium, nothing below */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: heat.edge,
          pointerEvents: 'none',
        }}
      />

      {/* The row is a clickable region rather than a <button>, because it
          contains a link and a vote control — interactive content cannot nest
          inside a button element. */}
      <Box
        {...(hasDetail
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': expanded,
              // The label has to carry the row's actual facts: `role=button`
              // plus a label replaces the element's contents for a screen
              // reader, so a bare "expand" would hide the whole scoreboard.
              // `aria-expanded` already conveys the toggle.
              'aria-label': `${row.rank}. ${row.nickname}, ${ka.standings.net} ${
                row.net > 0 ? `+${row.net}` : row.net
              }`,
              onClick: onToggle,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggle?.();
                }
              },
            }
          : {})}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          pl: '15px',
          pr: '14px',
          pt: '13px',
          pb: '11px',
          cursor: hasDetail ? 'pointer' : 'default',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '-2px',
          },
        }}
      >
        <Typography
          variant="numeral"
          sx={{ minWidth: 30, fontSize: 26, textAlign: 'right', color: heat.rankColor }}
        >
          {row.rank}
        </Typography>

        <Avatar {...ava} sx={{ ...ava.sx, width: 40, height: 40, flex: 'none' }} />

        <Stack sx={{ flexGrow: 1, minWidth: 0, gap: '3px' }}>
          <Stack direction="row" alignItems="center" spacing="7px">
            <Typography
              component={RouterLink}
              to={`/members/${row.member_id}`}
              onClick={stopPropagation}
              noWrap
              sx={{
                fontSize: 15.5,
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              {row.nickname}
            </Typography>

            {isSelf && (
              <Box
                component="span"
                sx={{
                  flex: 'none',
                  height: 17,
                  px: '6px',
                  borderRadius: '4px',
                  bgcolor: 'surface2',
                  color: 'text.secondary',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '17px',
                }}
              >
                {ka.standings.you}
              </Box>
            )}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <RankDelta movement={row.movement} muted={allTime} />
            <Typography variant="caption" color="text.secondary" noWrap>
              {ka.standings.net}{' '}
              <Box
                component="b"
                sx={{
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: row.net >= 0 ? 'signal.up' : 'signal.down',
                }}
              >
                {row.net > 0 ? `+${row.net}` : row.net}
              </Box>
            </Typography>
          </Stack>
        </Stack>

        {onVote && !isSelf && (
          <VoteToggle value={myVote} disabled={votingDisabled} onChange={onVote} />
        )}

        {onVote && isSelf && (
          <Typography
            sx={{
              width: 94,
              flex: 'none',
              textAlign: 'center',
              fontSize: 11,
              lineHeight: 1.3,
              color: 'textMute',
              textWrap: 'pretty',
            }}
          >
            {ka.vote.noSelf}
          </Typography>
        )}
      </Box>

      <HeatBar
        up={row.up}
        down={row.down}
        max={max}
        upColor={heat.upColor}
        trackColor={theme.palette.mode === 'dark' ? '#221B19' : theme.palette.surface2}
        label={`${row.nickname}: ${row.up} ${ka.standings.up}, ${row.down} ${ka.standings.down}`}
      />

      <Collapse in={expanded} unmountOnExit>
        <Stack
          spacing={1.25}
          sx={{
            pl: '48px',
            pr: '14px',
            pt: '11px',
            pb: '13px',
            bgcolor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(11,9,8,0.4)' : 'rgba(26,20,19,0.035)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.75}>
            {row.total_votes === 0 ? (
              <Typography variant="caption" color="text.secondary">
                {ka.standings.noVotes}
              </Typography>
            ) : (
              <>
                <Typography
                  sx={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'signal.up',
                  }}
                >
                  ▲ {row.up}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'signal.down',
                  }}
                >
                  ▼ {row.down}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {TONE_LABEL[toneOf(row.up, row.down)]}
                </Typography>
              </>
            )}
          </Stack>

          {detail}

          {onReact && (
            <ReactionBar
              counts={reactionCounts}
              mine={myReactions}
              disabled={votingDisabled}
              onToggle={onReact}
            />
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}
