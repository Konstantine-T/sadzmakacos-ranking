import { Box, Paper, Stack, Typography } from '@mui/material';
import { EmptyState } from '@/components/Splash';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { MemberBadge } from '@/lib/database.types';

/**
 * Gold is rank #1 and things that descend from it. Everything else is a plain
 * chip — if every badge glowed, none of them would.
 */
const GOLD_BADGES = new Set(['weekly_king', 'crown_streak_3', 'all_time_leader']);

interface BadgeShelfProps {
  badges: MemberBadge[];
  title?: string;
  /** Profiles render the shelf bare; the badge wall keeps its card. */
  bare?: boolean;
}

/** Badges are awarded automatically at week close and never by hand (§1.8). */
export function BadgeShelf({ badges, title = ka.profile.badges, bare }: BadgeShelfProps) {
  // Collapse repeats: "კვირის მეფე ×3" rather than three identical chips.
  const counts = new Map<string, number>();
  for (const badge of badges) {
    counts.set(badge.badge_key, (counts.get(badge.badge_key) ?? 0) + 1);
  }

  const body =
    counts.size === 0 ? (
      <EmptyState text={ka.profile.noBadges} />
    ) : (
      <Stack direction="row" spacing="7px" flexWrap="wrap" useFlexGap>
        {[...counts.entries()].map(([key, count]) => {
          const gold = GOLD_BADGES.has(key);
          return (
            <Box
              key={key}
              sx={{
                height: 32,
                px: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: gold ? 'rgba(255,206,92,0.38)' : 'divider',
                bgcolor: gold ? 'rgba(255,206,92,0.1)' : 'surface2',
                fontSize: 12.5,
                fontWeight: 600,
                color: gold ? signal.gold : 'text.secondary',
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  flex: 'none',
                  bgcolor: gold ? signal.gold : 'primary.main',
                }}
              />
              {ka.badges[key] ?? key}
              {count > 1 && (
                <Box
                  component="span"
                  sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}
                >
                  ×{count}
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    );

  if (bare) {
    return (
      <Stack spacing={1.25}>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
        {body}
      </Stack>
    );
  }

  return (
    <Paper sx={{ borderRadius: 4, p: 2 }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {body}
    </Paper>
  );
}
