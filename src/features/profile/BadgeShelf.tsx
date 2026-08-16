import { Box, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { EmptyState } from '@/components/Splash';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { MemberBadge } from '@/lib/database.types';

const BADGE_EMOJI: Record<string, string> = {
  weekly_king: '👑',
  crown_streak_3: '🏆',
  top_climber: '🚀',
  top_faller: '📉',
  most_hated: '😈',
  polarizing: '⚡',
  ghost: '👻',
  all_time_leader: '🐐',
};

/** Badges are awarded automatically at week close and never by hand (§1.8). */
export function BadgeShelf({ badges, title = ka.profile.badges }: { badges: MemberBadge[]; title?: string }) {
  // Collapse repeats: "კვირის მეფე ×3" rather than three identical chips.
  const counts = new Map<string, number>();
  for (const badge of badges) {
    counts.set(badge.badge_key, (counts.get(badge.badge_key) ?? 0) + 1);
  }

  return (
    <Paper sx={{ borderRadius: 3, p: 2 }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        {title}
      </Typography>

      {counts.size === 0 ? (
        <EmptyState text={ka.profile.noBadges} />
      ) : (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {[...counts.entries()].map(([key, count]) => (
            <Tooltip key={key} title={ka.badges[key] ?? key}>
              <Chip
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box component="span" sx={{ fontSize: 15 }}>
                      {BADGE_EMOJI[key] ?? '🎖'}
                    </Box>
                    <Box component="span">{ka.badges[key] ?? key}</Box>
                    {count > 1 && (
                      <Box
                        component="span"
                        sx={{ fontWeight: 800, color: signal.gold, fontVariantNumeric: 'tabular-nums' }}
                      >
                        ×{count}
                      </Box>
                    )}
                  </Stack>
                }
                variant="outlined"
                sx={{ height: 34, borderRadius: 99 }}
              />
            </Tooltip>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
