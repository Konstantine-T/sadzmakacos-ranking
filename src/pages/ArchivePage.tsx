import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Collapse, Paper, Stack, Typography } from '@mui/material';
import ChevronIcon from '@mui/icons-material/ChevronRightRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PageTransition } from '@/components/PageTransition';
import { EmptyState, Splash } from '@/components/Splash';
import { usePodiums, useWeeks } from '@/features/week/api';
import { useMemberMap } from '@/features/members/api';
import { dayjs, formatDay, tb } from '@/lib/time';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';

/**
 * Archive index (§8.1).
 *
 * Each week now leads with its podium, because that is how anyone actually
 * refers to a past week — "the one Nika won", not "week 11". The date picker
 * still exists for finding a specific week by day, folded away at the top so it
 * does not push the weeks themselves below the fold.
 */
export function ArchivePage() {
  const navigate = useNavigate();
  const weeks = useWeeks();
  const podiums = usePodiums();
  const { map: members } = useMemberMap();
  const [month, setMonth] = useState(() => dayjs());
  const [pickerOpen, setPickerOpen] = useState(false);

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
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Typography variant="h2">{ka.archive.title}</Typography>

        {list.length === 0 ? (
          <EmptyState text={ka.archive.empty} />
        ) : (
          <>
            <Paper sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <ButtonBase
                onClick={() => setPickerOpen((open) => !open)}
                aria-expanded={pickerOpen}
                sx={{ width: '100%', minHeight: 48, px: 2, display: 'flex', gap: 1 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flexGrow: 1, textAlign: 'left' }}
                >
                  {ka.archive.pick}
                </Typography>
                <ChevronIcon
                  sx={{
                    color: 'text.secondary',
                    transform: pickerOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform .18s ease',
                  }}
                />
              </ButtonBase>

              <Collapse in={pickerOpen} unmountOnExit>
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
              </Collapse>
            </Paper>

            {list.map((week) => {
              const podium = podiums.data?.get(week.id) ?? [];
              const isOpen = week.status === 'open';

              return (
                <Paper key={week.id} sx={{ borderRadius: 4, overflow: 'hidden' }}>
                  <ButtonBase
                    onClick={() => navigate(`/weeks/${week.id}`)}
                    sx={{
                      width: '100%',
                      px: 1.75,
                      py: 1.6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      borderBottom: podium.length > 0 ? '1px solid' : 0,
                      borderColor: 'surface2',
                    }}
                  >
                    <Typography
                      variant="numeral"
                      sx={{ fontSize: 15, color: 'text.secondary', flex: 'none' }}
                    >
                      {ka.week.number(week.id)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ flexGrow: 1, textAlign: 'left' }}
                    >
                      {ka.week.range(formatDay(week.starts_at), formatDay(week.ends_at))}
                    </Typography>
                    <Box
                      component="span"
                      sx={{
                        flex: 'none',
                        height: 22,
                        px: 1,
                        borderRadius: '5px',
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: '22px',
                        bgcolor: isOpen ? 'rgba(247,55,24,0.12)' : 'surface2',
                        color: isOpen ? 'primary.light' : 'text.secondary',
                      }}
                    >
                      {isOpen ? ka.archive.open : ka.archive.closed}
                    </Box>
                  </ButtonBase>

                  {podium.length > 0 && (
                    <Stack spacing={1} sx={{ px: 1.75, pt: 1.4, pb: 1.6 }}>
                      {podium.map((entry) => {
                        const name = members.get(entry.member_id)?.nickname ?? '—';
                        return (
                          <Stack
                            key={entry.member_id}
                            direction="row"
                            alignItems="center"
                            spacing={1.25}
                            component={ButtonBase}
                            onClick={() => navigate(`/members/${entry.member_id}`)}
                            sx={{ width: '100%', minHeight: 26 }}
                          >
                            <Typography
                              variant="numeral"
                              sx={{
                                width: 16,
                                fontSize: 13,
                                textAlign: 'left',
                                color: entry.rank === 1 ? signal.gold : 'textMute',
                              }}
                            >
                              {entry.rank}
                            </Typography>
                            <Typography
                              noWrap
                              sx={{
                                flexGrow: 1,
                                textAlign: 'left',
                                fontSize: 13.5,
                                fontWeight: 600,
                              }}
                            >
                              {name}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 13,
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: entry.net >= 0 ? 'signal.up' : 'signal.down',
                              }}
                            >
                              {entry.net > 0 ? `+${entry.net}` : entry.net}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              );
            })}
          </>
        )}
      </Stack>
    </PageTransition>
  );
}
