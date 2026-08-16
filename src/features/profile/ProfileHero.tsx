import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';
import type { WeeklyResult } from '@/lib/database.types';

interface ProfileHeroProps {
  memberId: string;
  nickname: string;
  bio: string | null;
  avatarPath: string | null;
  results: WeeklyResult[];
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <Stack alignItems="center" spacing="3px" sx={{ flex: 1 }}>
      <Typography variant="numeral" sx={{ fontSize: 28, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      <Typography
        sx={{ fontSize: 11, fontWeight: 500, lineHeight: 1.3, color: 'textMute' }}
        textAlign="center"
      >
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * The one place the app is allowed to be loud (§9.1).
 *
 * Wrapped energy is quarantined to profiles, so this card gets the ember glow
 * bleeding out from behind the avatar and 28px numerals — none of which the
 * scoreboard is ever permitted. Weeks at #1 turns gold only if there is at
 * least one; an unearned gold zero would cheapen every real crown on the board.
 */
export function ProfileHero({
  memberId,
  nickname,
  bio,
  avatarPath,
  results,
}: ProfileHeroProps) {
  const ava = avatarProps(memberId, nickname, avatarUrl(avatarPath));
  const weeksAtOne = results.filter((r) => r.rank === 1).length;
  const bestRank = results.length > 0 ? Math.min(...results.map((r) => r.rank)) : null;

  return (
    <Paper sx={{ borderRadius: '18px', position: 'relative', overflow: 'hidden', p: '20px 16px 18px' }}>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '-40% 30% auto -20%',
          height: 180,
          background: 'radial-gradient(closest-side, rgba(247,55,24,0.14), rgba(247,55,24,0))',
          pointerEvents: 'none',
        }}
      />

      <Stack spacing={1.5} alignItems="center" sx={{ position: 'relative' }}>
        <Avatar {...ava} sx={{ ...ava.sx, width: 76, height: 76, fontSize: '1.75rem' }} />

        <Stack spacing="5px" alignItems="center">
          <Typography variant="h1" sx={{ fontSize: 25 }}>
            {nickname}
          </Typography>
          {bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              sx={{ textWrap: 'pretty' }}
            >
              {bio}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" sx={{ width: '100%', pt: 1 }}>
          <Stat
            value={weeksAtOne}
            label={ka.profile.weeksAtOne}
            color={weeksAtOne > 0 ? signal.gold : undefined}
          />
          <Box sx={{ width: '1px', bgcolor: 'divider', my: '2px' }} />
          <Stat value={bestRank ?? '–'} label={ka.profile.bestRank} />
          <Box sx={{ width: '1px', bgcolor: 'divider', my: '2px' }} />
          <Stat value={results.length} label={ka.profile.weeksPlayed} />
        </Stack>
      </Stack>
    </Paper>
  );
}
