import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { BadgeShelf } from '@/features/profile/BadgeShelf';
import { useAllTimeStandings } from '@/features/allTime/api';
import { useAllBadges } from '@/features/members/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';

type SortKey = 'total_net' | 'avg_net' | 'weeks_at_one';

/**
 * Both columns are shown at once (§1.7): total net rewards showing up every
 * week, average net per week is fairer to whoever joined last month. Neither is
 * "the" ranking — you pick.
 */
export function AllTimePage() {
  const standings = useAllTimeStandings();
  const badges = useAllBadges();
  const [sortKey, setSortKey] = useState<SortKey>('total_net');

  const rows = useMemo(() => {
    const list = [...(standings.data ?? [])];
    return list.sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]) || b.total_net - a.total_net);
  }, [standings.data, sortKey]);

  if (standings.isPending) return <Splash />;

  const played = rows.some((row) => row.weeks_played > 0);
  const cell = { borderColor: 'divider', px: 1, py: 1.25 };

  const header = (key: SortKey, label: string) => (
    <TableCell sx={cell} align="right" sortDirection={sortKey === key ? 'desc' : false}>
      <TableSortLabel
        active={sortKey === key}
        direction="desc"
        onClick={() => setSortKey(key)}
        sx={{ fontSize: 12, fontWeight: 600 }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Typography variant="h1">{ka.allTime.title}</Typography>

        {!played ? (
          <Paper sx={{ borderRadius: 3 }}>
            <EmptyState text={ka.allTime.empty} />
          </Paper>
        ) : (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={cell} />
                  {header('total_net', ka.allTime.totalNet)}
                  {header('avg_net', ka.allTime.avgNet)}
                  {header('weeks_at_one', ka.allTime.weeksAtOne)}
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.map((row, index) => {
                  const props = avatarProps(row.member_id, row.nickname, avatarUrl(row.avatar_url));
                  return (
                    <TableRow key={row.member_id} hover>
                      <TableCell sx={cell}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            variant="numeral"
                            sx={{
                              fontSize: 15,
                              minWidth: 18,
                              color: index === 0 ? signal.gold : 'text.secondary',
                            }}
                          >
                            {index + 1}
                          </Typography>
                          <Avatar
                            {...props}
                            sx={{ ...props.sx, width: 28, height: 28, fontSize: '0.7rem' }}
                          />
                          <Typography
                            component={RouterLink}
                            to={`/members/${row.member_id}`}
                            variant="body2"
                            noWrap
                            sx={{
                              fontWeight: 600,
                              color: 'text.primary',
                              textDecoration: 'none',
                              opacity: row.is_active ? 1 : 0.5,
                            }}
                          >
                            {row.nickname}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell
                        sx={{ ...cell, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {row.total_net > 0 ? `+${row.total_net}` : row.total_net}
                      </TableCell>
                      <TableCell
                        sx={{ ...cell, fontVariantNumeric: 'tabular-nums' }}
                        align="right"
                      >
                        {Number(row.avg_net).toFixed(1)}
                      </TableCell>
                      <TableCell
                        sx={{
                          ...cell,
                          fontVariantNumeric: 'tabular-nums',
                          color: row.weeks_at_one > 0 ? signal.gold : 'text.secondary',
                          fontWeight: row.weeks_at_one > 0 ? 800 : 400,
                        }}
                        align="right"
                      >
                        {row.weeks_at_one}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}

        <BadgeShelf badges={badges.data ?? []} title={ka.allTime.badgeWall} />
      </Stack>
    </PageTransition>
  );
}
