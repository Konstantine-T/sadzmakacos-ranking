import { COUNTRIES, type Country } from './countries';

export interface FlagRound {
  answer: Country;
  /** Four options including the answer, already shuffled. */
  options: Country[];
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one question.
 *
 * The three wrong answers come from the SAME REGION as the right one, and that
 * single rule is most of what separates a real quiz from a formality. Drawn
 * globally, a flag round is trivial — nobody hesitates between Japan and Kenya.
 * Drawn from one region, Slovakia arrives beside Slovenia and Croatia, which is
 * the question actually worth asking.
 *
 * Every region holds at least fourteen countries, so a draw of four never runs
 * short; the global top-up below is a guard for a future edit to the pool, not
 * a case that fires today.
 *
 * @param recent codes to avoid repeating as the answer, newest last. A streak
 *   that shows the same flag twice in five questions feels broken even though
 *   random sequences genuinely do that.
 */
export function nextRound(recent: readonly string[] = []): FlagRound {
  const avoid = new Set(recent);
  const fresh = COUNTRIES.filter((c) => !avoid.has(c.code));
  const pool = fresh.length > 0 ? fresh : COUNTRIES;
  const answer = pool[Math.floor(Math.random() * pool.length)];

  const sameRegion = COUNTRIES.filter(
    (c) => c.region === answer.region && c.code !== answer.code,
  );
  const distractors = shuffle(sameRegion).slice(0, 3);

  if (distractors.length < 3) {
    const rest = shuffle(
      COUNTRIES.filter(
        (c) => c.code !== answer.code && !distractors.some((d) => d.code === c.code),
      ),
    );
    distractors.push(...rest.slice(0, 3 - distractors.length));
  }

  return { answer, options: shuffle([answer, ...distractors]) };
}

/** How many answers back to keep out of the draw. */
export const RECENT_MEMORY = 12;
