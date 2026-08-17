import { Box, Stack, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
/**
 * "14/20 ხმა მიცემულია" (§5) — how many people have voted at all this week.
 *
 * Amber rather than ember: turnout is a warm signal about participation, and
 * ember stays reserved for brand and interactive accents so it never dilutes.
 */
export function TurnoutBar({
  voters,
  total,
}: {
  voters: number;
  total: number;
}) {
  const reduced = useReducedMotion();
  const pct = total > 0 ? Math.min(100, Math.round((voters / total) * 100)) : 0;

  return (
    <Stack spacing="7px" sx={{ width: "100%" }}>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
      >
        {/* <Typography variant="caption" color="text.secondary">
          {ka.week.turnout(voters, total)}
        </Typography> */}
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "signal.up",
          }}
        >
          {pct}%
        </Typography>
      </Stack>

      <Box
        sx={{
          height: 3,
          borderRadius: 99,
          bgcolor: "surface2",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 220, damping: 30 }
          }
          style={{ height: "100%" }}
        >
          <Box
            sx={{
              height: "100%",
              width: "100%",
              bgcolor: "signal.up",
              borderRadius: 99,
            }}
          />
        </motion.div>
      </Box>
    </Stack>
  );
}
