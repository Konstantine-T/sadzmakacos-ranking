import dayjs from 'dayjs';
import 'dayjs/locale/ka';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(isoWeek);
dayjs.locale('ka');

/** Rule 7: everything is stored as timestamptz and rendered in Tbilisi time. */
export const TBILISI = 'Asia/Tbilisi';

export function tb(value: string | number | Date | dayjs.Dayjs) {
  return dayjs(value).tz(TBILISI);
}

/** "24 აგვისტო" */
export function formatDay(value: string) {
  return tb(value).format('D MMMM');
}

/** "24 აგვისტო, 00:00" */
export function formatDateTime(value: string) {
  return tb(value).format('D MMMM, HH:mm');
}

/** "24 აგვ" — compact, for table cells and chips. */
export function formatShort(value: string) {
  return tb(value).format('D MMM');
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  /** Under one hour — the countdown starts pulsing (§9.5). */
  urgent: boolean;
  done: boolean;
}

export function countdownTo(endsAt: string, now: number = Date.now()): Countdown {
  const totalMs = Math.max(0, new Date(endsAt).getTime() - now);
  const d = dayjs.duration(totalMs);
  return {
    days: Math.floor(d.asDays()),
    hours: d.hours(),
    minutes: d.minutes(),
    seconds: d.seconds(),
    totalMs,
    urgent: totalMs > 0 && totalMs < 60 * 60 * 1000,
    done: totalMs <= 0,
  };
}

export { dayjs };
