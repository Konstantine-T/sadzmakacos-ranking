import { useState } from 'react';
import { Avatar, Box, Collapse, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { HeatBar } from './HeatBar';
import { VoteToggle } from './VoteToggle';
import { RankDelta } from './RankDelta';
import { ReactionBar } from '@/features/reactions/ReactionBar';
import { EmptyState } from '@/components/Splash';
import { NO_REACTIONS, type CountsByTarget, type MineByTarget } from '@/features/reactions/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { maxTotalVotes } from '@/lib/ranking';
import { ka } from '@/i18n/ka';
import { rowHeat, toneOf } from '@/theme/heat';
import type { VoteValue } from './api';
import type { StandingsRowData } from './StandingsRow';

/**
 * The wide board.
 *
 * On a phone the row stacks into three bands because 390px has no room for
 * columns. Given 900px of main column it is a genuine table, and every fact the
 * phone hides behind a tap gets its own column instead: the movement chip, the
 * temperature bar, the raw ▲/▼ split, the net.
 *
 * The temperature language is identical — same `rowHeat`, same wash, same gold
 * edge on rank #1 — so the two layouts read as one board at two sizes rather
 * than two different products. Tapping a row still opens the reactions, because
 * those are the one thing that never fit in a column.
 */

const COLUMNS = '52px 40px minmax(150px,1fr) 72px 120px 88px 60px 96px';

const TONE_LABEL = {
  warm: ka.standings.toneWarm,
  cold: ka.standings.toneCold,
  divisive: ka.standings.toneDivisive,
} as const;

const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation();

interface StandingsTableProps {
  rows: StandingsRowData[];
  loading?: boolean;
  myId?: string;
  myVotes?: Record<string, VoteValue>;
  votingDisabled?: boolean;
  allTime?: boolean;
  reactionCounts?: CountsByTarget;
  myReactions?: MineByTarget;
  detailFor?: (row: StandingsRowData) => React.ReactNode;
  onVote?: (memberId: string, value: VoteValue) => void;
  onReact?: (memberId: string, emoji: string) => void;
}

function HeaderCell({
  label,
  align = 'left',
}: {
  label: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Typography
      sx={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: 'text.secondary',
        textAlign: align,
      }}
    >
      {label}
    </Typography>
  );
}

export function StandingsTable({
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
}: StandingsTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [openId, setOpenId] = useState<string | null>(null);
  const max = maxTotalVotes(rows);

  if (loading) {
    return (
      <Paper sx={{ borderRadius: '16px', overflow: 'hidden' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={58} sx={{ mb: '1px' }} />
        ))}
      </Paper>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper sx={{ borderRadius: '16px' }}>
        <EmptyState text={ka.standings.empty} />
      </Paper>
    );
  }

  return (
    // The body sits *below* its header: recessed surface, lighter header bar.
    <Paper
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#1A1514' : t.palette.background.paper),
      }}
    >
      {/* The grid has a hard minimum; let it scroll rather than crush a column. */}
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: 762 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              alignItems: 'center',
              gap: '12px',
              px: 2.5,
              py: 1.4,
              borderBottom: '1px solid',
              borderColor: 'hairline',
              bgcolor: 'background.paper',
            }}
          >
            <HeaderCell label="#" align="right" />
            <span />
            <HeaderCell label={ka.standings.colMember} />
            <HeaderCell label={ka.standings.colChange} />
            <HeaderCell label={ka.standings.colTemperature} align="center" />
            <HeaderCell label="▲ / ▼" align="center" />
            <HeaderCell label={ka.standings.net} align="right" />
            <HeaderCell label={ka.standings.colVote} align="center" />
          </Box>

          {rows.map((row) => {
            const heat = rowHeat(row, max, isDark);
            const isSelf = myId === row.member_id;
            const expanded = openId === row.member_id;
            const detail = detailFor?.(row);
            const hasDetail = Boolean(onReact || detail || row.total_votes > 0);
            const ava = avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url));

            return (
              <Box
                key={row.member_id}
                sx={{
                  position: 'relative',
                  borderBottom: '1px solid',
                  borderColor: 'hairline',
                  background: heat.wash,
                  transition: 'background .2s linear',
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
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

                <Box
                  {...(hasDetail
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-expanded': expanded,
                        'aria-label': `${row.rank}. ${row.nickname}, ${ka.standings.net} ${
                          row.net > 0 ? `+${row.net}` : row.net
                        }`,
                        onClick: () =>
                          setOpenId((id) => (id === row.member_id ? null : row.member_id)),
                        onKeyDown: (event: React.KeyboardEvent) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setOpenId((id) => (id === row.member_id ? null : row.member_id));
                          }
                        },
                      }
                    : {})}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: COLUMNS,
                    alignItems: 'center',
                    gap: '12px',
                    px: 2.5,
                    py: 1.25,
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
                    sx={{ fontSize: 26, textAlign: 'right', color: heat.rankColor }}
                  >
                    {row.rank}
                  </Typography>

                  <Avatar {...ava} sx={{ ...ava.sx, width: 38, height: 38 }} />

                  <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                    <Typography
                      component={RouterLink}
                      to={`/members/${row.member_id}`}
                      onClick={stopPropagation}
                      noWrap
                      sx={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'text.primary',
                        textDecoration: 'none',
                        '&:hover': { color: 'primary.light' },
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

                  <Box sx={{ justifySelf: 'start' }}>
                    <RankDelta movement={row.movement} muted={allTime} />
                  </Box>

                  <HeatBar
                    up={row.up}
                    down={row.down}
                    max={max}
                    height={6}
                    upColor={heat.upColor}
                    trackColor={isDark ? '#221B19' : theme.palette.surface2}
                    label={`${row.nickname}: ${row.up} ${ka.standings.up}, ${row.down} ${ka.standings.down}`}
                  />

                  <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.1}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'signal.up',
                      }}
                    >
                      {row.up}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'textMute' }}>/</Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'signal.down',
                      }}
                    >
                      {row.down}
                    </Typography>
                  </Stack>

                  <Typography
                    variant="numeral"
                    sx={{
                      fontSize: 15,
                      textAlign: 'right',
                      color: row.net >= 0 ? 'signal.up' : 'signal.down',
                    }}
                  >
                    {row.net > 0 ? `+${row.net}` : row.net}
                  </Typography>

                  <Box sx={{ justifySelf: 'center' }}>
                    {onVote && !isSelf && (
                      <VoteToggle
                        value={myVotes?.[row.member_id] ?? null}
                        disabled={votingDisabled}
                        size="compact"
                        onChange={(value) => onVote(row.member_id, value)}
                      />
                    )}
                    {onVote && isSelf && (
                      <Typography
                        sx={{
                          fontSize: 10.5,
                          lineHeight: 1.3,
                          textAlign: 'center',
                          color: 'textMute',
                        }}
                      >
                        {ka.standings.noSelfShort}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Collapse in={expanded} unmountOnExit>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.75}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{
                      pl: '134px',
                      pr: 2.5,
                      pb: 1.6,
                      bgcolor: isDark ? 'rgba(11,9,8,0.4)' : 'rgba(26,20,19,0.035)',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {row.total_votes === 0
                        ? ka.standings.noVotes
                        : TONE_LABEL[toneOf(row.up, row.down)]}
                    </Typography>

                    {detail}

                    {onReact && (
                      <ReactionBar
                        size="sm"
                        counts={reactionCounts?.get(row.member_id)}
                        mine={myReactions?.get(row.member_id) ?? NO_REACTIONS}
                        disabled={votingDisabled}
                        onToggle={(emoji) => onReact(row.member_id, emoji)}
                      />
                    )}
                  </Stack>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}
