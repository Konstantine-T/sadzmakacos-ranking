/**
 * Row temperature.
 *
 * The heat used to live entirely inside a 10px bar. It now runs across the
 * whole row: a left-to-right wash whose HUE is the sign of the net score and
 * whose STRENGTH is how many votes the row drew at all. A row nobody thought
 * about is almost invisible; a loud one glows. Rank #1 overrides both with
 * gold, which is still the only place gold is ever used (§9.2).
 *
 * The three decisions in tokens.ts still hold — this file only decides how
 * much of each colour a given row earns, never which colours exist.
 */

import { dark, ember, light, signal } from './tokens';

const GOLD_RGB = '255,206,92';
const EMBER_RGB = '247,55,24';
const SLATE_RGB = '110,134,171';

/** Fade to a zero-alpha *of the same hue*, never to `transparent`. */
function fade(rgb: string, alpha: number, stop: number): string {
  return `linear-gradient(90deg, rgba(${rgb},${alpha.toFixed(3)}), rgba(${rgb},0) ${stop}%)`;
}

export interface RowHeat {
  /** Background gradient for the whole row. */
  wash: string;
  /** The 3px stripe down the left edge. */
  edge: string;
  /** Colour of the rank numeral. */
  rankColor: string;
  /** Colour of the warm half of the row's HeatBar. */
  upColor: string;
}

export function rowHeat(
  row: { rank: number; net: number; total_votes: number },
  /** The week's widest row — every wash on the board shares this scale. */
  max: number,
  isDark: boolean,
): RowHeat {
  const heat = max > 0 ? Math.min(1, row.total_votes / max) : 0;
  // A wash tuned for near-black has to work harder on a near-white page.
  const boost = isDark ? 1 : 1.6;
  const first = row.rank === 1;
  const podium = row.rank <= 3;

  return {
    wash: first
      ? fade(GOLD_RGB, 0.09 * boost, 62)
      : row.net >= 0
        ? fade(EMBER_RGB, (0.02 + heat * 0.07) * boost, 58)
        : fade(SLATE_RGB, (0.02 + heat * 0.06) * boost, 58),

    edge: first ? signal.gold : podium ? `rgba(${EMBER_RGB},0.5)` : 'transparent',

    rankColor: first
      ? signal.gold
      : podium
        ? isDark
          ? ember[300]
          : ember[600]
        : isDark
          ? dark.textMute
          : light.textMute,

    upColor: first ? signal.gold : signal.up,
  };
}

export type Tone = 'warm' | 'cold' | 'divisive';

/**
 * The one-word verdict shown when a row is expanded.
 *
 * "Divisive" is the interesting case and the reason the HeatBar diverges from a
 * centre axis in the first place: +7/−7 and 0/0 have the same net score, and
 * only one of them was a fight. It needs enough votes to mean anything, hence
 * the floor.
 */
export function toneOf(up: number, down: number): Tone {
  const total = up + down;
  if (total > 6 && Math.min(up, down) / total > 0.38) return 'divisive';
  return up >= down ? 'warm' : 'cold';
}
