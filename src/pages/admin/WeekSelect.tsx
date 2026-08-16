import { MenuItem, TextField } from '@mui/material';
import { useWeeks } from '@/features/week/api';
import { formatShort } from '@/lib/time';
import { ka } from '@/i18n/ka';

/** Shared week chooser for the admin screens that operate on one week. */
export function WeekSelect({
  value,
  onChange,
  closedOnly,
}: {
  value: number | undefined;
  onChange: (weekId: number) => void;
  closedOnly?: boolean;
}) {
  const weeks = useWeeks();
  const list = (weeks.data ?? []).filter((w) => !closedOnly || w.status === 'closed');

  return (
    <TextField
      select
      size="small"
      fullWidth
      label={ka.archive.pick}
      value={list.some((w) => w.id === value) ? String(value) : ''}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {list.map((week) => (
        <MenuItem key={week.id} value={String(week.id)}>
          {ka.week.number(week.id)} · {formatShort(week.starts_at)} —{' '}
          {formatShort(week.ends_at)}
          {week.status === 'open' ? ` · ${ka.archive.open}` : ''}
        </MenuItem>
      ))}
    </TextField>
  );
}
