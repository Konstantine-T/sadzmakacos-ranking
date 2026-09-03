import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useReducedMotion } from 'framer-motion';
import { useWideLayout } from '@/app/layout';
import { avatarColor, avatarInitial } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { Member } from '@/lib/database.types';
import { DELTA, OPPOSITE, type Dir, type Point } from './direction';
import { SnakePad } from './SnakePad';

const GRID = 17; // cells per side — odd, so the snake starts dead centre
const START_MS = 190;
const MIN_MS = 85;
const SPEEDUP = 6; // ms shaved per avatar eaten
const POP_MS = 260;


interface SnakeGameProps {
  /** Every active member — one of them is the food at any moment. */
  members: Member[];
  onGameOver: (score: number) => void;
}

/**
 * Snake, on a canvas, eating the group.
 *
 * WHY THERE IS NO GAME LIBRARY. The first version of this felt choppy, and the
 * instinct was to reach for Pixi or Phaser. That would not have fixed it: the
 * choppiness was not the renderer, it was that the snake jumped a whole cell
 * per logic tick — about five frames a second of apparent motion at the
 * starting speed. A faster renderer just teleports it faster.
 *
 * What fixes it is decoupling the two clocks. The logic still advances on a
 * fixed grid every `speed` ms, which is what keeps snake fair and predictable,
 * but rendering runs every animation frame and INTERPOLATES each segment
 * between where it was and where it is going. The body is then one stroked path
 * with round joins rather than a row of squares, so a turn curves instead of
 * stepping. That is the whole trick, and it is about forty lines.
 *
 * framer-motion, which the rest of the app uses, animates DOM nodes — it has
 * nothing to say about canvas pixels. Its `useReducedMotion` is still honoured
 * here: with reduced motion the interpolation is switched off and the game
 * renders grid-snapped, which is the calmer original behaviour.
 *
 * React owns the score and the game-over flag. Everything that changes per tick
 * lives in refs — a setState per frame would re-render the tree sixty times a
 * second for nothing.
 */
export function SnakeGame({ members, onGameOver }: SnakeGameProps) {
  const wide = useWideLayout();
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  // Mutable game state. None of this belongs in React — it changes every tick.
  const snake = useRef<Point[]>([]);
  const prev = useRef<Point[]>([]); // positions before the last step, for interpolation
  const dir = useRef<Dir>('right');
  const queued = useRef<Dir[]>([]);
  const food = useRef<Point>({ x: 0, y: 0 });
  const foodMember = useRef<Member | null>(null);
  const images = useRef<Map<string, HTMLImageElement>>(new Map());
  const pop = useRef<{ x: number; y: number; at: number } | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const lastTick = useRef(0);
  const speed = useRef(START_MS);
  const running = useRef(false);

  /** Preload avatars once so the food never pops in a frame late. */
  useEffect(() => {
    for (const m of members) {
      const url = avatarUrl(m.avatar_url);
      if (!url || images.current.has(m.id)) continue;
      const img = new Image();
      img.src = url;
      images.current.set(m.id, img);
    }
  }, [members]);

  const placeFood = useCallback(() => {
    const taken = new Set(snake.current.map((p) => `${p.x},${p.y}`));
    const free: Point[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
    food.current = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
    foodMember.current =
      members.length > 0 ? members[Math.floor(Math.random() * members.length)] : null;
  }, [members]);

  /**
   * @param t progress through the current tick, 0..1. The whole point: at t=0.5
   *          every segment is drawn halfway between its old cell and its new one.
   */
  const draw = useCallback(
    (t: number, now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = canvas.width / dpr;
      const cell = size / GRID;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#14100F';
      ctx.fillRect(0, 0, size, size);

      // faint grid, so motion has something to read against
      ctx.strokeStyle = 'rgba(255,255,255,0.028)';
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        const p = Math.round(i * cell) + 0.5;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
      }

      const body = snake.current;
      if (body.length === 0) return;

      // Interpolated centre of segment i. A segment with no previous position
      // (the one just grown at the tail) sits still rather than flying in.
      const at = (i: number) => {
        const cur = body[i];
        const old = prev.current[i] ?? prev.current[prev.current.length - 1] ?? cur;
        return {
          x: (old.x + (cur.x - old.x) * t) * cell + cell / 2,
          y: (old.y + (cur.y - old.y) * t) * cell + cell / 2,
        };
      };

      // ---- the food, gently breathing ----
      const m = foodMember.current;
      const fx = food.current.x * cell + cell / 2;
      const fy = food.current.y * cell + cell / 2;
      const breathe = reduced ? 1 : 1 + Math.sin(now / 320) * 0.05;
      const radius = cell * 0.42 * breathe;
      if (m) {
        const img = images.current.get(m.id);
        ctx.save();
        ctx.beginPath();
        ctx.arc(fx, fy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (img?.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, fx - radius, fy - radius, radius * 2, radius * 2);
        } else {
          ctx.fillStyle = avatarColor(m.id);
          ctx.fillRect(fx - radius, fy - radius, radius * 2, radius * 2);
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${radius}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(avatarInitial(m.nickname), fx, fy + radius * 0.04);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(fx, fy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFB224';
        ctx.lineWidth = Math.max(1.5, cell * 0.07);
        ctx.stroke();
      }

      // ---- the eat ripple ----
      const p = pop.current;
      if (p && !reduced) {
        const age = (now - p.at) / POP_MS;
        if (age >= 1) {
          pop.current = null;
        } else {
          const e = 1 - Math.pow(1 - age, 2); // ease out
          ctx.beginPath();
          ctx.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, cell * (0.3 + e * 0.75), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,178,36,${(1 - e) * 0.8})`;
          ctx.lineWidth = Math.max(1, cell * 0.09 * (1 - e));
          ctx.stroke();
        }
      }

      // ---- the body, as one continuous stroke ----
      // Round joins are what turn a corner into a curve instead of a staircase.
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      const head = at(0);
      ctx.moveTo(head.x, head.y);
      for (let i = 1; i < body.length; i++) {
        const q = at(i);
        ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = 'rgba(247,55,24,0.28)';
      ctx.lineWidth = cell * 0.86;
      ctx.stroke();
      ctx.strokeStyle = '#F73718';
      ctx.lineWidth = cell * 0.62;
      ctx.stroke();

      // ---- the head, with eyes so you can read direction instantly ----
      ctx.beginPath();
      ctx.arc(head.x, head.y, cell * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = '#FF8F70';
      ctx.fill();

      const d = DELTA[dir.current];
      const ex = d.y !== 0 ? cell * 0.15 : 0;
      const ey = d.x !== 0 ? cell * 0.15 : 0;
      const fwd = cell * 0.12;
      ctx.fillStyle = '#14100F';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(head.x + d.x * fwd + ex * s, head.y + d.y * fwd + ey * s, cell * 0.075, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [reduced],
  );

  const step = useCallback(() => {
    const next = queued.current.shift();
    if (next && next !== OPPOSITE[dir.current]) dir.current = next;

    const d = DELTA[dir.current];
    const head = snake.current[0];
    const nx = head.x + d.x;
    const ny = head.y + d.y;

    const hitWall = nx < 0 || ny < 0 || nx >= GRID || ny >= GRID;
    const hitSelf = snake.current.some((p, i) => i > 0 && p.x === nx && p.y === ny);
    if (hitWall || hitSelf) {
      running.current = false;
      setOver(true);
      return;
    }

    prev.current = snake.current;
    const grown = [{ x: nx, y: ny }, ...snake.current];
    if (nx === food.current.x && ny === food.current.y) {
      pop.current = { x: nx, y: ny, at: performance.now() };
      snake.current = grown;
      setScore((s) => s + 1);
      speed.current = Math.max(MIN_MS, speed.current - SPEEDUP);
      placeFood();
    } else {
      grown.pop();
      snake.current = grown;
    }
  }, [placeFood]);

  const loop = useCallback(
    (now: number) => {
      if (!running.current) return;
      if (lastTick.current === 0) lastTick.current = now;

      // Fixed logic step, variable render rate. A backgrounded tab returns with
      // a huge delta, so cap the catch-up rather than running fifty ticks at once.
      let guard = 0;
      while (now - lastTick.current >= speed.current && running.current && guard++ < 4) {
        lastTick.current += speed.current;
        step();
      }
      if (guard >= 4) lastTick.current = now;

      const t = reduced
        ? 1
        : Math.max(0, Math.min(1, (now - lastTick.current) / speed.current));
      draw(t, now);

      if (running.current) raf.current = requestAnimationFrame(loop);
      else draw(1, now); // settle on the final cell rather than mid-glide
    },
    [draw, step, reduced],
  );

  const start = useCallback(() => {
    const mid = Math.floor(GRID / 2);
    snake.current = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    prev.current = snake.current;
    dir.current = 'right';
    queued.current = [];
    pop.current = null;
    speed.current = START_MS;
    setScore(0);
    setOver(false);
    placeFood();
    running.current = true;
    lastTick.current = 0;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  }, [loop, placeFood]);

  // size the canvas to its box, at device resolution so it is not soft
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const box = canvas.parentElement;
      if (!box) return;
      // Also bounded by viewport height, not just width: the thumb stick sits
      // under the board and on a short phone a square canvas would push it off
      // the screen — the one control you cannot play without.
      const css = Math.min(box.clientWidth, 460, Math.round(window.innerHeight * 0.46));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = css * dpr;
      canvas.height = css * dpr;
      canvas.style.width = `${css}px`;
      canvas.style.height = `${css}px`;
      draw(1, performance.now());
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [draw]);

  useEffect(() => {
    start();
    return () => {
      running.current = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // start once on mount; restarting is an explicit button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report the finished game exactly once.
  const reported = useRef(false);
  useEffect(() => {
    if (over && !reported.current) {
      reported.current = true;
      onGameOver(score);
    }
    if (!over) reported.current = false;
  }, [over, score, onGameOver]);

  const turn = useCallback((d: Dir) => {
    // Queue rather than apply: two fast taps within one tick would otherwise
    // let you reverse into yourself through an intermediate direction.
    if (queued.current.length < 2) queued.current.push(d);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right',
      };
      const dd = map[e.key];
      if (dd) { e.preventDefault(); turn(dd); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  const touch = useRef<Point | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    touch.current = null;
  };

  return (
    <Stack spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ width: '100%', maxWidth: 460 }}
      >
        <Typography variant="caption" color="text.secondary">
          {ka.snake.score}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {score}
        </Typography>
      </Stack>

      <Box
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        sx={{
          width: '100%',
          maxWidth: 460,
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'border',
          touchAction: 'none',
          lineHeight: 0,
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {over && (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(20,16,15,0.86)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{ka.snake.over}</Typography>
            <Typography sx={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {score}
            </Typography>
            <Button variant="contained" sx={{ height: 48, px: 3 }} onClick={start}>
              {ka.snake.again}
            </Button>
          </Stack>
        )}
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
        {wide ? ka.snake.hintDesktop : ka.snake.hint}
      </Typography>

      {/* Phones only. The rail layout has a keyboard, and a thumb stick under a
          desktop board would just be a toy taking up half the screen. */}
      {!wide && <SnakePad onDirection={turn} />}
    </Stack>
  );
}
