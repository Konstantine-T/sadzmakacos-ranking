import type { Category } from './categories';
import { freshCards, type ApiQuestion, type Card, type Difficulty } from './deck';

/**
 * The Trivia API, called straight from the browser.
 *
 * No key and no server in between: the API allows any origin, and this game's
 * score is client-reported like the flag game's, so routing questions through
 * Supabase would hide an answer key that protects nothing. The free tier caps a
 * request at fifty questions and has no memory between requests — deduping
 * across batches is `freshCards`' job.
 *
 * Licensed CC BY-NC 4.0; the credit line is ka.truefalse.credit.
 */
const ENDPOINT = 'https://the-trivia-api.com/v2/questions';
const BATCH = 50;
const TIMEOUT_MS = 10_000;

/**
 * One batch of unseen cards for a category and difficulty.
 *
 * May legitimately return an empty array — a small category late in a long
 * run has nothing left the player has not seen. The caller decides what that
 * means; it is not an error.
 */
export async function fetchCards(
  category: Category,
  difficulty: Difficulty,
  seen: ReadonlySet<string>,
): Promise<Card[]> {
  const params = new URLSearchParams({
    limit: String(BATCH),
    difficulties: difficulty,
    types: 'text_choice',
  });
  if (category !== 'all') params.set('categories', category);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`trivia api ${res.status}`);
    const batch = (await res.json()) as ApiQuestion[];
    return freshCards(Array.isArray(batch) ? batch : [], seen);
  } finally {
    clearTimeout(timer);
  }
}
