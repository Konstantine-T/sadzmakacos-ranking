/**
 * Run with:
 *   npm run test:unit
 *
 * The two formatters the chat calls once per message per render. They used to
 * go through dayjs's `.tz()`, which builds a fresh Intl formatter on every call
 * — about 0.25ms each on a desktop and several times that on a phone, times two
 * hundred messages, on every keystroke. The chat lagged because of it. These
 * pin the output to what dayjs produced, and the speed to something a phone can
 * afford.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { dayKey, formatClock, tb } from './time';

// Tbilisi is UTC+4, so the day turns over at 20:00 UTC.
const STAMPS = [
  '2026-10-01T19:59:59.999Z', // 23:59, still the 1st in Tbilisi
  '2026-10-01T20:00:00.000Z', // 00:00, already the 2nd
  '2026-10-01T20:00:59.000Z',
  '2026-12-31T19:30:00.000Z', // the year turns over in Tbilisi first
  '2026-12-31T20:00:00.000Z',
  '2026-03-29T00:30:00.000Z', // Europe's DST weekend — Tbilisi has none
  '2026-10-25T00:30:00.000Z',
  '2026-08-24T08:05:00+00:00', // the offset form Postgres actually returns
];

test('formatClock matches dayjs in Tbilisi time', () => {
  for (const s of STAMPS) {
    assert.equal(formatClock(s), tb(s).format('HH:mm'), s);
  }
});

test('midnight in Tbilisi is 00:00, never 24:00', () => {
  assert.equal(formatClock('2026-10-01T20:00:00.000Z'), '00:00');
});

test('dayKey matches dayjs in Tbilisi time', () => {
  for (const s of STAMPS) {
    assert.equal(dayKey(s), tb(s).format('YYYY-MM-DD'), s);
  }
});

test('dayKey turns over at Tbilisi midnight, not UTC midnight', () => {
  assert.equal(dayKey('2026-10-01T19:59:59.999Z'), '2026-10-01');
  assert.equal(dayKey('2026-10-01T20:00:00.000Z'), '2026-10-02');
});

test('a room of messages formats in a few milliseconds', () => {
  // dayjs took ~210ms for this on a desktop. A cached formatter takes ~9ms.
  // The budget sits far from both, so this is not a flaky timing test — it
  // fails only if someone routes these back through a per-call formatter.
  const stamps = Array.from({ length: 1000 }, (_, i) =>
    new Date(Date.UTC(2026, 9, 1) - i * 60_000).toISOString(),
  );
  formatClock(stamps[0]);
  dayKey(stamps[0]);
  const start = performance.now();
  for (const s of stamps) {
    formatClock(s);
    dayKey(s);
  }
  const ms = performance.now() - start;
  assert.ok(ms < 60, `1000 messages took ${ms.toFixed(1)}ms`);
});
