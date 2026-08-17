import { useEffect, useState } from "react";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import { WeekCountdown } from "./WeekCountdown";
import { formatDay } from "@/lib/time";
import { ka } from "@/i18n/ka";
import type { Week } from "@/lib/database.types";

interface WeekCardProps {
  week: Week;
  voters: number;
  total: number;
  onExpire?: () => void;
}

/** How much of the week is already gone, 0–100. */
function elapsedPct(week: Week, now: number): number {
  const start = new Date(week.starts_at).getTime();
  const end = new Date(week.ends_at).getTime();
  if (!(end > start)) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

/**
 * The week's header card: what week it is, how long is left, and how many
 * people have shown up.
 *
 * The hairline across the top is the week itself draining away — the same
 * information as the countdown, but ambient, so you read it without counting.
 */
export function WeekCard({ week, voters, total, onExpire }: WeekCardProps) {
  const [now, setNow] = useState(() => Date.now());
  console.log(voters, total);
  useEffect(() => {
    // A minute is plenty for a bar that takes a week to cross the card.
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Paper sx={{ borderRadius: 4, overflow: "hidden" }}>
      <Box sx={{ height: 2, bgcolor: "surface2" }}>
        <Box
          sx={{
            height: "100%",
            width: `${elapsedPct(week, now)}%`,
            background: (t) =>
              `linear-gradient(90deg, rgba(247,55,24,0.25), ${t.palette.primary.main})`,
            transition: "width .6s linear",
          }}
        />
      </Box>

      <Stack spacing={1.75} sx={{ p: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={1.5}
        >
          <Stack spacing="3px">
            <Typography variant="caption" color="text.secondary">
              {ka.week.current}
            </Typography>
            <Typography
              variant="h3"
              sx={{ fontFamily: (t) => t.typography.h1.fontFamily }}
            >
              {ka.week.range(
                formatDay(week.starts_at),
                formatDay(week.ends_at),
              )}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ pt: "3px" }}
          >
            {ka.week.endsIn}
          </Typography>
        </Stack>

        <WeekCountdown endsAt={week.ends_at} onExpire={onExpire} />

        {week.is_paused && (
          <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
            {ka.week.paused}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
