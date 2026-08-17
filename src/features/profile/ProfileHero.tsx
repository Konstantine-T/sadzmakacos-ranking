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
  /** Wide: avatar left, identity centre, stats right. Phone: all stacked. */
  wide?: boolean;
  /** Badges join the hero on the wide layout instead of sitting below it. */
  badges?: React.ReactNode;
}

function Stat({
  value,
  label,
  color,
  wide,
}: {
  value: string | number;
  label: string;
  color?: string;
  wide?: boolean;
}) {
  return (
    <Stack
      alignItems="center"
      spacing={wide ? '4px' : '3px'}
      sx={wide ? { px: 2.75 } : { flex: 1 }}
    >
      <Typography variant="numeral" sx={{ fontSize: wide ? 34 : 28, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
      <Typography
        sx={{ fontSize: 11, fontWeight: 500, lineHeight: 1.3, color: 'textMute' }}
        textAlign="center"
        noWrap={wide}
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
  wide,
  badges,
}: ProfileHeroProps) {
  const ava = avatarProps(memberId, nickname, avatarUrl(avatarPath));
  const weeksAtOne = results.filter((r) => r.rank === 1).length;
  const bestRank = results.length > 0 ? Math.min(...results.map((r) => r.rank)) : null;

  const stats = (
    <Stack direction="row" sx={wide ? { flex: 'none' } : { width: '100%', pt: 1 }}>
      <Stat
        value={weeksAtOne}
        label={ka.profile.weeksAtOne}
        color={weeksAtOne > 0 ? signal.gold : undefined}
        wide={wide}
      />
      <Box sx={{ width: '1px', bgcolor: 'divider', my: '2px' }} />
      <Stat value={bestRank ?? '–'} label={ka.profile.bestRank} wide={wide} />
      <Box sx={{ width: '1px', bgcolor: 'divider', my: '2px' }} />
      <Stat value={results.length} label={ka.profile.weeksPlayed} wide={wide} />
    </Stack>
  );

  return (
    <Paper
      sx={{
        borderRadius: '18px',
        position: 'relative',
        overflow: 'hidden',
        p: wide ? 3 : '20px 16px 18px',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: wide ? '-50% 55% auto -12%' : '-40% 30% auto -20%',
          height: wide ? 260 : 180,
          background: 'radial-gradient(closest-side, rgba(247,55,24,0.14), rgba(247,55,24,0))',
          pointerEvents: 'none',
        }}
      />

      <Stack
        direction={wide ? 'row' : 'column'}
        spacing={wide ? 2.75 : 1.5}
        alignItems="center"
        sx={{ position: 'relative' }}
      >
        <Avatar
          {...ava}
          sx={{
            ...ava.sx,
            width: wide ? 84 : 76,
            height: wide ? 84 : 76,
            flex: 'none',
            fontSize: wide ? '1.9375rem' : '1.75rem',
          }}
        />

        <Stack
          spacing={wide ? 1 : '5px'}
          alignItems={wide ? 'flex-start' : 'center'}
          sx={{ flexGrow: wide ? 1 : 0, minWidth: 0 }}
        >
          <Typography variant="h1" sx={{ fontSize: wide ? 30 : 25 }}>
            {nickname}
          </Typography>
          {bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign={wide ? 'left' : 'center'}
              sx={{ textWrap: 'pretty' }}
            >
              {bio}
            </Typography>
          )}
          {wide && badges}
        </Stack>

        {stats}
      </Stack>
    </Paper>
  );
}
