import { motion, useReducedMotion } from 'framer-motion';

/**
 * Route transition (§9.5): 180ms fade + 8px rise, and nothing when the user has
 * asked for reduced motion.
 *
 * `fill` makes the wrapper a flex column that fills its parent rather than
 * hugging its content. A page that owns its own scrolling — the chat — needs an
 * unbroken height chain from the shell down, and an auto-height div in the
 * middle silently breaks it: the child's height:100% resolves against nothing,
 * the page grows instead, and the document becomes the scroller.
 */
export function PageTransition({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
}) {
  const reduced = useReducedMotion();
  const fillStyle = fill
    ? ({ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } as const)
    : undefined;

  if (reduced) {
    return fill ? <div style={fillStyle}>{children}</div> : <>{children}</>;
  }

  return (
    <motion.div
      style={fillStyle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
