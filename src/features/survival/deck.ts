/**
 * The survival game's decisions, kept free of React and the network so the
 * unit runner can reach them (deck.test.ts).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

/** A question as The Trivia API v2 returns it — only the fields we read. */
export interface ApiQuestion {
  id: string;
  category: string;
  difficulty: Difficulty;
  type: string;
  question: { text: string };
  correctAnswer: string;
  incorrectAnswers: string[];
}

export interface Card {
  id: string;
  question: string;
  /** Every option including the answer, already shuffled. */
  options: string[];
  answer: string;
  difficulty: Difficulty;
}

/** Cards per difficulty before the next one takes over. */
export const TIER_LENGTH = 10;

/**
 * The ramp: cards 1–10 easy, 11–20 medium, everything after hard.
 *
 * @param answered cards already answered correctly this run — i.e. the streak
 *   so far. The card about to be shown is number `answered + 1`.
 */
export function tierFor(answered: number): Difficulty {
  if (answered < TIER_LENGTH) return 'easy';
  if (answered < TIER_LENGTH * 2) return 'medium';
  return 'hard';
}

/**
 * Whether a question can be asked: a plain text question with at least one
 * wrong option, and no option that duplicates another — two identical buttons,
 * one right and one wrong, would be a coin toss.
 */
export function usable(q: ApiQuestion): boolean {
  if (q.type !== 'text_choice' || typeof q.correctAnswer !== 'string') return false;
  if (q.incorrectAnswers.length === 0) return false;
  const options = [q.correctAnswer, ...q.incorrectAnswers].map((o) => o.trim().toLowerCase());
  return new Set(options).size === options.length;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Turn an API question into a card. The API lists the right answer apart from
 * the wrong ones, so the options must be shuffled — otherwise the answer would
 * always sit in the same place.
 *
 * @param random injectable for tests; `Math.random` in the game.
 */
export function toCard(q: ApiQuestion, random: () => number = Math.random): Card {
  const answer = q.correctAnswer.trim();
  return {
    id: q.id,
    question: q.question.text.trim(),
    options: shuffle([answer, ...q.incorrectAnswers.map((o) => o.trim())], random),
    answer,
    difficulty: q.difficulty,
  };
}

/**
 * The cards from a fetched batch that this run can still use.
 *
 * A question is asked AT MOST ONCE PER RUN — the API has no memory without a
 * paid session, and random batches of fifty from a small category overlap
 * quickly. Duplicates inside one batch are collapsed too.
 *
 * @param seen every question id already asked or queued this run.
 */
export function freshCards(
  batch: ApiQuestion[],
  seen: ReadonlySet<string>,
  random: () => number = Math.random,
): Card[] {
  const taken = new Set(seen);
  const out: Card[] = [];
  for (const q of batch) {
    if (taken.has(q.id) || !usable(q)) continue;
    taken.add(q.id);
    out.push(toCard(q, random));
  }
  return out;
}
