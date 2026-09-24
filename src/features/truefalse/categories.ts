import { ka } from '@/i18n/ka';

/**
 * The Trivia API's ten categories, plus `all` — a run across every one of them.
 *
 * Each is its own board: a geography-only streak and a mixed streak are not the
 * same quantity. The ids are the API's own slugs and are also the values the
 * `truefalse_scores.category` check constraint accepts — add one here and that
 * constraint is the second place to change.
 *
 * `all` is first on purpose: it is the default pick and the headline board.
 */
export const CATEGORIES = [
  'all',
  'general_knowledge',
  'geography',
  'history',
  'science',
  'film_and_tv',
  'music',
  'sport_and_leisure',
  'food_and_drink',
  'arts_and_literature',
  'society_and_culture',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string | undefined): value is Category {
  return (CATEGORIES as readonly string[]).includes(value ?? '');
}

export function categoryLabel(category: Category): string {
  return ka.truefalse.categories[category];
}
