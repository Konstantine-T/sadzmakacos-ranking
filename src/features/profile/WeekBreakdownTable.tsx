import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '@/components/Splash';
import { RankDelta } from '@/features/standings/RankDelta';
import { ka } from '@/i18n/ka';
import type { WeeklyResult } from '@/lib/database.types';

export function WeekBreakdownTable({ results }: { results: WeeklyResult[] }) {
  if (results.length === 0) {
    return (
      <Paper sx={{ borderRadius: 3 }}>
        <EmptyState text={ka.profile.noHistory} />
      </Paper>
    );
  }

  const cell = { borderColor: 'divider', px: 1, py: 1.25 };

  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Typography variant="h3" sx={{ p: 2, pb: 1 }}>
        {ka.profile.breakdown}
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={cell}>{ka.week.label}</TableCell>
            <TableCell sx={cell} align="right">
              {ka.standings.rank}
            </TableCell>
            <TableCell sx={cell} align="right">
              ▲
            </TableCell>
            <TableCell sx={cell} align="right">
              ▼
            </TableCell>
            <TableCell sx={cell} align="right">
              {ka.standings.net}
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {[...results].reverse().map((row) => (
            <TableRow key={row.week_id} hover>
              <TableCell sx={cell}>
                <Typography
                  component={RouterLink}
                  to={`/weeks/${row.week_id}`}
                  variant="body2"
                  sx={{ color: 'text.primary', textDecoration: 'none', fontWeight: 600 }}
                >
                  {row.week_id}
                </Typography>
              </TableCell>
              <TableCell sx={cell} align="right">
                <Typography
                  component="span"
                  sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', mr: 0.75 }}
                >
                  {row.rank}
                </Typography>
                <RankDelta movement={row.movement} />
              </TableCell>
              <TableCell sx={{ ...cell, color: 'signal.up', fontWeight: 700 }} align="right">
                {row.up}
              </TableCell>
              <TableCell sx={{ ...cell, color: 'signal.down', fontWeight: 700 }} align="right">
                {row.down}
              </TableCell>
              <TableCell sx={{ ...cell, fontWeight: 800 }} align="right">
                {row.net > 0 ? `+${row.net}` : row.net}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
