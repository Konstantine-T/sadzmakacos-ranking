/**
 * The four directions, shared by the game loop and the on-screen pad.
 *
 * Lives in its own module so `SnakePad` can speak the same language as
 * `SnakeGame` without the two importing each other.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/**
 * Which way a stick displacement points, or null inside the dead zone.
 *
 * Snake is four-directional, so the analogue angle is snapped: whichever axis
 * is displaced further wins. A diagonal push therefore resolves to the
 * direction you were mostly heading rather than flickering between two, which
 * is what makes a round pad usable for a square game.
 */
export function dirFromOffset(dx: number, dy: number, deadZone: number): Dir | null {
  if (Math.hypot(dx, dy) < deadZone) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
