import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useWideLayout } from '@/app/layout';
import { avatarColor, avatarInitial } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { Member } from '@/lib/database.types';

const GRID = 17; // cells per side — odd, so the snake starts dead centre
const START_MS = 190;
const MIN_MS = 85;
const SPEEDUP = 6; // ms shaved per avatar eaten

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface SnakeGameProps {
  /** Every active member — one of them is the food at any moment. */
  members: Member[];
  onGameOver: (score: number) => void;
}

/**
 * Snake, on a canvas, eating the group.
 *
 * No library. Snake is a grid, a deque and a timer; every package that wraps
 * that would also own the rendering, and the rendering is the whole point here —
 * the food is a member's avatar, drawn as a circle, with their colour-and-
 * initial fallback when they have no photo. That is the same pair the boards
 * use, so a person looks like themselves wherever they appear.
 *
 * The game loop is a ref-driven interval rather than React state: at 85ms a
 * setState per tick would re-render the whole tree eleven times a second for no
 * reason. React owns the score and the game-over flag; the canvas owns the rest.
 */
export function SnakeGame({ members, onGameOver }: SnakeGameProps) {
  const wide = useWideLayout();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  // Mutable game state. None of this belongs in React — it changes every tick.
  const snake = useRef<Point[]>([]);
  const dir = useRef<Dir>('right');
  const queued = useRef<Dir[]>([]);
  const food = useRef<Point>({ x: 0, y: 0 });
  const foodMember = useRef<Member | null>(null);
  const images = useRef<Map<string, HTMLImageElement>>(new Map());
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const size = canvas.width / (window.devicePixelRatio || 1);
    const cell = size / GRID;
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // board
    ctx.fillStyle = '#14100F';
    ctx.fillRect(0, 0, size, size);

    // the snake, brightest at the head so direction reads at a glance
    const body = snake.current;
    body.forEach((p, i) => {
      const t = body.length === 1 ? 1 : 1 - i / body.length;
      ctx.fillStyle = `rgba(247, 55, 24, ${0.35 + t * 0.65})`;
      const pad = cell * 0.08;
      const r = cell * 0.28;
      const x = p.x * cell + pad;
      const y = p.y * cell + pad;
      const w = cell - pad * 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, w, r);
      ctx.fill();
    });

    // the food: a member
    const m = foodMember.current;
    const fx = food.current.x * cell + cell / 2;
    const fy = food.current.y * cell + cell / 2;
    const radius = cell * 0.42;
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
  }, []);

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

    snake.current = [{ x: nx, y: ny }, ...snake.current];
    if (nx === food.current.x && ny === food.current.y) {
      setScore((s) => s + 1);
      speed.current = Math.max(MIN_MS, speed.current - SPEEDUP);
      placeFood();
    } else {
      snake.current.pop();
    }
    draw();
  }, [draw, placeFood]);

  const loop = useCallback(
    (now: number) => {
      if (!running.current) return;
      if (now - lastTick.current >= speed.current) {
        lastTick.current = now;
        step();
      }
      raf.current = requestAnimationFrame(loop);
    },
    [step],
  );

  const start = useCallback(() => {
    const mid = Math.floor(GRID / 2);
    snake.current = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    dir.current = 'right';
    queued.current = [];
    speed.current = START_MS;
    setScore(0);
    setOver(false);
    placeFood();
    draw();
    running.current = true;
    lastTick.current = 0;
    raf.current = requestAnimationFrame(loop);
  }, [draw, loop, placeFood]);

  // size the canvas to its box, at device resolution so it is not soft
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const box = canvas.parentElement;
      if (!box) return;
      const css = Math.min(box.clientWidth, 460);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = css * dpr;
      canvas.height = css * dpr;
      canvas.style.width = `${css}px`;
      canvas.style.height = `${css}px`;
      draw();
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
    </Stack>
  );
}
