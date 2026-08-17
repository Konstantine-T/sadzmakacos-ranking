import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '@/components/Splash';
import { useScoredPosts } from '@/features/posts/api';
import { usePodiums, useWeeks } from '@/features/week/api';
import { useMemberMap } from '@/features/members/api';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { formatShort } from '@/lib/time';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';

export const SIDE_RAIL_WIDTH = 320;

/**
 * The extra column the widest layout earns.
 *
 * Everything here is read-only and already reachable elsewhere — this week's
 * posts and who won the last few weeks. That is the point: it is peripheral
 * vision, not a third place to act. Votes and reactions stay on the tabs that
 * own them, so there is exactly one control for each thing in the app.
 *
 * It hides itself on the posts tab, where the digest would just be a smaller
 * copy of the page you are already reading.
 */
export function SideRail({ weekId, hidePosts }: { weekId?: number; hidePosts?: boolean }) {
  const posts = useScoredPosts(weekId);
  const weeks = useWeeks();
  const podiums = usePodiums();
  const { map: members } = useMemberMap();

  const recent = (weeks.data ?? [])
    .filter((week) => week.status === 'closed')
    .slice(0, 4)
    .map((week) => ({ week, winner: podiums.data?.get(week.id)?.[0] }))
    .filter((entry) => entry.winner !== undefined);

  const cardHeader = (title: string, hint?: string) => (
    <Stack
      direction="row"
      alignItems="baseline"
      justifyContent="space-between"
      sx={{ px: 2, py: 1.6, borderBottom: '1px solid', borderColor: 'hairline' }}
    >
      <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>{title}</Typography>
      {hint && (
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{hint}</Typography>
      )}
    </Stack>
  );

  return (
    <Stack
      component="aside"
      spacing={2}
      sx={{ width: SIDE_RAIL_WIDTH, flex: 'none', position: 'sticky', top: 88 }}
    >
      {!hidePosts && (
        <Paper sx={{ borderRadius: '16px', overflow: 'hidden' }}>
          {cardHeader(ka.posts.title, ka.posts.oncePerWeek)}

          {posts.rows.length === 0 ? (
            <EmptyState text={ka.posts.empty} />
          ) : (
            posts.rows.slice(0, 3).map((post) => {
              const author = members.get(post.author_id);
              const nickname = author?.nickname ?? '—';
              const ava = avatarProps(
                post.author_id,
                nickname,
                avatarUrl(author?.avatar_url ?? null),
              );

              return (
                <Stack
                  key={post.id}
                  spacing={1}
                  sx={{
                    px: 2,
                    py: 1.6,
                    borderBottom: '1px solid',
                    borderColor: 'hairline',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar
                      {...ava}
                      sx={{ ...ava.sx, width: 24, height: 24, fontSize: '0.625rem' }}
                    />
                    <Typography
                      component={RouterLink}
                      to={`/members/${post.author_id}`}
                      noWrap
                      sx={{
                        flexGrow: 1,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'text.primary',
                        textDecoration: 'none',
                      }}
                    >
                      {nickname}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>
                      {formatShort(post.created_at)}
                    </Typography>
                  </Stack>

                  <Typography
                    sx={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'text.secondary',
                      textWrap: 'pretty',
                    }}
                  >
                    {post.body}
                  </Typography>

                  <Stack direction="row" spacing={1.5}>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'signal.up',
                      }}
                    >
                      ▲ {post.up}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'signal.down',
                      }}
                    >
                      ▼ {post.down}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })
          )}
        </Paper>
      )}

      {recent.length > 0 && (
        <Paper sx={{ borderRadius: '16px', overflow: 'hidden' }}>
          {cardHeader(ka.archive.recent)}

          {recent.map(({ week, winner }) => (
            <Stack
              key={week.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              component={RouterLink}
              to={`/weeks/${week.id}`}
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'hairline',
                textDecoration: 'none',
                color: 'inherit',
                '&:last-of-type': { borderBottom: 0 },
              }}
            >
              <Typography
                variant="numeral"
                sx={{ width: 34, flex: 'none', fontSize: 13, color: 'textMute' }}
              >
                {ka.week.number(week.id)}
              </Typography>
              <Typography noWrap sx={{ flexGrow: 1, fontSize: 13, fontWeight: 600 }}>
                {members.get(winner!.member_id)?.nickname ?? '—'}
              </Typography>
              <Box
                component="span"
                sx={{
                  flex: 'none',
                  height: 20,
                  px: '7px',
                  borderRadius: '4px',
                  bgcolor: 'rgba(255,206,92,0.1)',
                  border: '1px solid rgba(255,206,92,0.34)',
                  color: signal.gold,
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '20px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {winner!.net > 0 ? `+${winner!.net}` : winner!.net}
              </Box>
            </Stack>
          ))}
        </Paper>
      )}
    </Stack>
  );
}
