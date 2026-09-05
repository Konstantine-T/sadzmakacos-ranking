import { COUNTRIES, type Country } from './countries';

export interface FlagRound {
  answer: Country;
  /** Four options including the answer, already shuffled. */
  options: Country[];
}

/** Every country in the pool — and therefore the highest streak possible. */
export const PERFECT = COUNTRIES.length;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one question, or return null when the pool is spent.
 *
 * A country is asked AT MOST ONCE PER RUN. That makes the game finite: answer
 * all {@link PERFECT} of them and there is nothing left to ask, which is the
 * win condition rather than an error. It also removes the thing that made a
 * long streak cheap — with repeats allowed, a run was mostly a memory test of
 * the last few minutes.
 *
 * Note `used` constrains the ANSWER only. Distractors are drawn from the whole
 * region including countries already asked, because a wrong option is not spent
 * by being shown — and late in a run, excluding them would leave nothing to
 * draw from.
 *
 * The three wrong answers come from the SAME REGION as the right one, and that
 * single rule is most of what separates a real quiz from a formality. Drawn
 * globally, a flag round is trivial: nobody hesitates between Japan and Kenya.
 * Drawn from one region, Slovakia arrives beside Slovenia and Croatia.
 *
 * Every region holds at least fourteen countries, so a draw of four never runs
 * short; the global top-up below is a guard for a future edit to the pool, not
 * a case that fires today.
 *
 * @param used codes already asked in this run. Pass every one of them, not a
 *   sliding window — the no-repeat rule is what makes PERFECT reachable.
 */
export function nextRound(used: readonly string[] = []): FlagRound | null {
  const spent = new Set(used);
  const pool = COUNTRIES.filter((c) => !spent.has(c.code));
  if (pool.length === 0) return null;

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
