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

/*
  The chat formats a clock and a day key for every message on every render, and
  dayjs's `.tz()` builds a fresh Intl formatter per call — ~0.25ms each on a
  desktop, several times that on a phone. Two hundred messages made each
  keystroke cost a visible fraction of a second. These two share one formatter,
  built once; time.test.ts pins their output to what dayjs produced.
  `hourCycle: 'h23'` is what keeps midnight "00:00" rather than "24:00".
*/
const tbParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TBILISI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(value: string) {
  const out: Record<string, string> = {};
  for (const p of tbParts.formatToParts(new Date(value))) out[p.type] = p.value;
  return out;
}

/** Wall-clock time in Tbilisi. Used per message in the chat. */
export function formatClock(value: string) {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

/** The day a message belongs to, for the separators between them. */
export function dayKey(value: string) {
  const p = parts(value);
  return `${p.year}-${p.month}-${p.day}`;
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
