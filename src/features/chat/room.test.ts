/**
 * Run with:
 *   npm run test:unit
 *
 * The chat used to refetch all two hundred rows on every message. It now
 * patches realtime payloads straight into the cache, which means two writers —
 * the patch and the fetch — and the only failure mode is a message that quietly
 * disappears. These pin the merge down.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/lib/database.types';
import { PAGE_SIZE, mergeFetched, upsertRow } from './room';

const T0 = Date.UTC(2026, 9, 1, 12);
const msg = (id: number, minute = id, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id,
    author_id: 'a',
    body: `m${id}`,
    created_at: new Date(T0 + minute * 60_000).toISOString(),
    deleted_at: null,
    ...extra,
  }) as ChatMessage;
const ids = (room: ChatMessage[]) => room.map((m) => m.id);

test('a new message lands at the end', () => {
  assert.deepEqual(ids(upsertRow([msg(1), msg(2)], msg(3))), [1, 2, 3]);
});

test('the same message twice is one message', () => {
  // The sender gets their own row from realtime AND from the refetch after
  // send_message returns. It must not appear twice.
  const room = upsertRow(upsertRow([msg(1)], msg(2)), msg(2));
  assert.deepEqual(ids(room), [1, 2]);
});

test('a soft delete replaces the row in place', () => {
  const deleted = msg(2, 2, { deleted_at: new Date(T0).toISOString() });
  const room = upsertRow([msg(1), msg(2), msg(3)], deleted);
  assert.deepEqual(ids(room), [1, 2, 3]);
  assert.equal(room[1].deleted_at, deleted.deleted_at);
});

test('a row that arrives out of order is sorted into place', () => {
  assert.deepEqual(ids(upsertRow([msg(1), msg(3)], msg(2))), [1, 2, 3]);
});

test('the room never grows past a page', () => {
  const full = Array.from({ length: PAGE_SIZE }, (_, i) => msg(i + 1));
  const room = upsertRow(full, msg(PAGE_SIZE + 1));
  assert.equal(room.length, PAGE_SIZE);
  assert.equal(room[0].id, 2, 'the oldest falls off, not the newest');
  assert.equal(room[room.length - 1].id, PAGE_SIZE + 1);
});

test('a fetch keeps a message realtime patched in while it was in flight', () => {
  // THE RACE. The fetch's snapshot was taken before message 4 committed;
  // realtime delivered 4 before the fetch resolved. Replacing the cache with
  // the snapshot would make 4 vanish until the next fetch.
  const fetched = [msg(1), msg(2), msg(3)];
  const cached = [msg(1), msg(2), msg(3), msg(4)];
  assert.deepEqual(ids(mergeFetched(fetched, cached)), [1, 2, 3, 4]);
});

test('a fetch is otherwise authoritative', () => {
  const fetched = [msg(1), msg(2, 2, { body: 'fresh' })];
  const merged = mergeFetched(fetched, [msg(1), msg(2)]);
  assert.equal(merged, fetched, 'nothing to add means the snapshot itself');
  assert.equal(merged[1].body, 'fresh');
});

test('a fetch does not resurrect rows that fell off the page', () => {
  const fetched = [msg(10), msg(11)];
  const cached = [msg(3), msg(10), msg(11)];
  assert.deepEqual(ids(mergeFetched(fetched, cached)), [10, 11]);
});

test('an empty room keeps whatever realtime delivered', () => {
  assert.deepEqual(ids(mergeFetched([], [msg(1)])), [1]);
});
