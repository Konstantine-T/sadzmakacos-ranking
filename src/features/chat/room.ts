import type { ChatMessage } from '@/lib/database.types';

/**
 * How the cached room absorbs rows from two directions at once — a fetch, and
 * realtime payloads patched in between fetches. Kept free of Supabase and React
 * so room.test.ts can pin it down: a mistake here does not throw, it just
 * silently drops somebody's message.
 */

/** How many messages the room keeps on screen. Twenty friends, not a support desk. */
export const PAGE_SIZE = 200;

/** Oldest first, the direction a conversation reads. */
const byTime = (a: ChatMessage, b: ChatMessage) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;

/** Insert a new row in order, or replace one already there (a soft delete). */
export function upsertRow(room: ChatMessage[], row: ChatMessage): ChatMessage[] {
  const i = room.findIndex((m) => m.id === row.id);
  if (i >= 0) return room.map((m, j) => (j === i ? row : m));
  return [...room, row].sort(byTime).slice(-PAGE_SIZE);
}

/**
 * A fetch's snapshot, plus any row realtime patched in while it was in flight.
 * Replacing the cache with the snapshot alone would drop such a row until the
 * next fetch. Rows older than the snapshot's window are not carried over —
 * they fell off the page, and the fetch is right to leave them out.
 */
export function mergeFetched(fetched: ChatMessage[], cached: ChatMessage[]): ChatMessage[] {
  const ids = new Set(fetched.map((m) => m.id));
  const floor = fetched[0]?.id ?? 0;
  const patched = cached.filter((m) => !ids.has(m.id) && m.id > floor);
  if (patched.length === 0) return fetched;
  return [...fetched, ...patched].sort(byTime).slice(-PAGE_SIZE);
}
