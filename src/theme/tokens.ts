/**
 * Design tokens (§9.2).
 *
 * Three decisions here are load-bearing and should not drift:
 *
 *  1. The dark is WARM, not neutral — a red-brown tint, so the surface reads as
 *     cooling charcoal rather than a generic void.
 *  2. Downvotes are COLD, not red. Up = ember amber, down = desaturated slate.
 *     The scoreboard becomes a temperature scale, not a traffic light, and
 *     #F73718 stays reserved for brand and interactive accents so it never
 *     gets diluted.
 *  3. Wrapped energy is quarantined to profiles, week summaries and badge
 *     reveals. The scoreboard itself stays restrained.
 */

export const ember = {
  50: '#FFF1ED',
  100: '#FFDCD2',
  200: '#FFB9A3',
  300: '#FF8F70',
  400: '#FF6242',
  500: '#F73718', // brand
  600: '#D42708',
  700: '#A81E05',
  800: '#7A1704',
  900: '#4D0F03',
} as const;

export const dark = {
  bg: '#14100F', // warm charcoal, not #0A0A0A
  surface: '#1E1918',
  surface2: '#2A2321',
  hairline: '#241D1B', // between rows — quieter than `border`, which draws cards
  border: '#3A302D',
  text: '#F5EFED',
  textDim: '#A79B97',
  textMute: '#8E817D', // rank numerals below the podium, micro-labels
} as const;

export const light = {
  bg: '#FBF7F6',
  surface: '#FFFFFF',
  surface2: '#F4EEEC',
  hairline: '#EFE6E3',
  border: '#E4D9D5',
  text: '#1A1413',
  textDim: '#6E605C',
  textMute: '#8B7C77',
} as const;

export const signal = {
  up: '#FFB224', // ember amber — warm, rising
  upSoft: 'rgba(255,178,36,0.14)',
  down: '#6E86AB', // cool slate — cold, sinking
  downSoft: 'rgba(110,134,171,0.14)',
  gold: '#FFCE5C', // rank #1 only
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** The fixed reaction set (§1.6). Order is the display order. */
export const REACTIONS = ['🔥', '😂', '💀', '👑', '😭'] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * Font stacks.
 *
 * The plan called for FiraGO, but every installable build of it (Fontsource,
 * Google Fonts) ships the Latin subset only — it has no Georgian glyphs at all,
 * so it would silently fall back to the system font for the entire UI. Noto
 * Serif Georgian carries the display voice instead: a genuinely different
 * texture for the Wrapped moments, full Georgian coverage, variable weight.
 */
export const fonts = {
  display: "'Noto Serif Georgian Variable', 'Noto Serif Georgian', Georgia, serif",
  body: "'Noto Sans Georgian Variable', 'Noto Sans Georgian', 'BPG Arial', system-ui, sans-serif",
} as const;
