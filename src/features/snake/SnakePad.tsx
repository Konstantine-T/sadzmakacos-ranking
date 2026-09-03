import { useRef, useState } from 'react';
import { Box } from '@mui/material';
import { dirFromOffset, type Dir } from './direction';

const BASE = 148; // outer ring
const THUMB = 62;
const DEAD_ZONE = 14;

interface SnakePadProps {
  /** Fires only when the direction actually changes, not on every move event. */
  onDirection: (d: Dir) => void;
}

/**
 * A thumb stick for the phone.
 *
 * Swiping across the board was the original control and it was genuinely hard
 * to play with: a swipe needs a deliberate 24px gesture, it competes with the
 * page for the touch, and your hand covers the board exactly when you most need
 * to see it. A fixed pad below the canvas solves all three — the thumb never
 * leaves it, the board is never occluded, and a turn is a nudge rather than a
 * stroke.
 *
 * It reports a direction only when the snapped direction CHANGES. Holding the
 * stick left does not spam `left` sixty times a second, which matters because
 * the game queues turns and a flooded queue would swallow your next real one.
 *
 * Pointer events rather than touch events, so it works identically under a
 * mouse — useful for testing, harmless in production.
 */
export function SnakePad({ onDirection }: SnakePadProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const active = useRef(false);
  const lastDir = useRef<Dir | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [held, setHeld] = useState<Dir | null>(null);

  const move = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    // Clamp the thumb to the ring so it never escapes the base.
    const max = (BASE - THUMB) / 2;
    const dist = Math.hypot(dx, dy);
    const k = dist > max ? max / dist : 1;
    setOffset({ x: dx * k, y: dy * k });

    const d = dirFromOffset(dx, dy, DEAD_ZONE);
    setHeld(d);
    if (d && d !== lastDir.current) {
      lastDir.current = d;
      onDirection(d);
    }
  };

  const release = () => {
    active.current = false;
    lastDir.current = null;
    setOffset({ x: 0, y: 0 });
    setHeld(null);
  };

  return (
    <Box
      ref={ref}
      role="application"
      aria-label="joystick"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current) move(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      sx={{
        width: BASE,
        height: BASE,
        flex: 'none',
        position: 'relative',
        borderRadius: '50%',
        touchAction: 'none',
        userSelect: 'none',
        bgcolor: 'surface2',
        border: '1px solid',
        borderColor: 'border',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* Four hints, so the pad reads as directional even at rest. */}
      {(['up', 'down', 'left', 'right'] as const).map((d) => (
        <Box
          key={d}
          sx={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: held === d ? 'primary.main' : 'text.disabled',
            opacity: held === d ? 1 : 0.35,
            transition: 'background-color .12s linear, opacity .12s linear',
            ...(d === 'up' && { top: 12 }),
            ...(d === 'down' && { bottom: 12 }),
            ...(d === 'left' && { left: 12 }),
            ...(d === 'right' && { right: 12 }),
          }}
        />
      ))}

      <Box
        sx={{
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          opacity: held ? 1 : 0.82,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          // No transition while dragging or the stick lags the thumb; the snap
          // back to centre on release is the only thing worth animating.
          transition: active.current ? 'none' : 'transform .16s ease-out, opacity .16s linear',
          boxShadow: 3,
        }}
      />
    </Box>
  );
}
