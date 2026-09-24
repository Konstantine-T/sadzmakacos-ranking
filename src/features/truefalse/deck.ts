/**
 * The true/false game's decisions, kept free of React and the network so the
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
  /** The answer this card proposes. */
  shown: string;
  /** Whether `shown` is the right answer — what a correct swipe must say. */
  truth: boolean;
  /** Always the real answer, so a miss can name it. */
  correctAnswer: string;
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
 * Whether a question survives being turned into a single yes/no claim.
 *
 * "Which of these is NOT a planet? — Mars?" asks the player to negate a
 * negation, and the right swipe is a logic puzzle rather than a fact. Those
 * are dropped. So is anything that is not a plain text question with at least
 * one wrong answer to propose.
 */
export function usable(q: ApiQuestion): boolean {
  return (
    q.type === 'text_choice' &&
    typeof q.correctAnswer === 'string' &&
    q.incorrectAnswers.length > 0 &&
    !/\bnot\b/i.test(q.question.text)
  );
}

/**
 * Turn a multiple-choice question into a true/false card.
 *
 * A fair coin decides whether the card proposes the right answer or one of the
 * wrong ones, so blind swiping scores nothing better than a coin toss.
 *
 * @param random injectable for tests; `Math.random` in the game.
 */
export function toCard(q: ApiQuestion, random: () => number = Math.random): Card {
  const truth = random() < 0.5;
  const wrong = q.incorrectAnswers[Math.floor(random() * q.incorrectAnswers.length)];
  return {
    id: q.id,
    question: q.question.text.trim(),
    shown: (truth ? q.correctAnswer : wrong).trim(),
    truth,
    correctAnswer: q.correctAnswer.trim(),
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
