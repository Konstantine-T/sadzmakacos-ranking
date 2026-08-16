import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { useWeeks } from '@/features/week/api';
import { dayjs, formatDay, tb } from '@/lib/time';
import { ka } from '@/i18n/ka';

/**
 * Archive index + week picker (§8.1). The calendar disables every day outside
 * a real week, so pre-launch dates simply cannot be selected.
 */
export function ArchivePage() {
  const navigate = useNavigate();
  const weeks = useWeeks();
  const [month, setMonth] = useState(() => dayjs());

  const weekForDay = useMemo(() => {
    const list = weeks.data ?? [];
    return (day: dayjs.Dayjs) => {
      const t = day.valueOf();
      return list.find((week) => {
        const start = new Date(week.starts_at).getTime();
        const end = new Date(week.ends_at).getTime();
        return t >= start && t < end;
      });
    };
  }, [weeks.data]);

  const bounds = useMemo(() => {
    const list = weeks.data ?? [];
    if (list.length === 0) return null;
    const starts = list.map((w) => new Date(w.starts_at).getTime());
    const ends = list.map((w) => new Date(w.ends_at).getTime());
    return { min: tb(Math.min(...starts)), max: tb(Math.max(...ends) - 1) };
  }, [weeks.data]);

  if (weeks.isPending) return <Splash />;

  const list = weeks.data ?? [];

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2 }}>
        <Typography variant="h1">{ka.archive.title}</Typography>

        {list.length === 0 ? (
          <EmptyState text={ka.archive.empty} />
        ) : (
          <>
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 2, display: 'block' }}>
                {ka.archive.pick}
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ka">
                <DateCalendar
                  value={month}
                  onChange={(day) => {
                    if (!day) return;
                    setMonth(day);
                    const week = weekForDay(day);
                    if (week) navigate(`/weeks/${week.id}`);
                  }}
                  minDate={bounds?.min}
                  maxDate={bounds?.max}
                  shouldDisableDate={(day) => !weekForDay(day)}
                  views={['day']}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Paper>

            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <List disablePadding>
                {list.map((week) => (
                  <ListItemButton
                    key={week.id}
                    onClick={() => navigate(`/weeks/${week.id}`)}
                    sx={{ minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <ListItemText
                      primary={ka.week.number(week.id)}
                      secondary={ka.week.range(formatDay(week.starts_at), formatDay(week.ends_at))}
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                    <Chip
                      size="small"
                      label={week.status === 'open' ? ka.archive.open : ka.archive.closed}
                      color={week.status === 'open' ? 'primary' : 'default'}
                      variant={week.status === 'open' ? 'filled' : 'outlined'}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </>
        )}
      </Stack>
    </PageTransition>
  );
}
