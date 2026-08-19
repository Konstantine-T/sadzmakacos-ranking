import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { UnreadChip } from '@/components/UnreadChip';
import { ka } from '@/i18n/ka';

export const NAV_RAIL_WIDTH = 236;

interface NavRailProps {
  items: readonly { to: string; label: string }[];
  activeIndex: number;
  /** Omitted when there is no open week — the live card disappears with it. */
  turnout?: { voters: number; total: number };
  /** Path → unread count. Same chip the bottom bar uses, same source. */
  unread?: Record<string, number>;
  onNavigate: (to: string) => void;
}

/**
 * The wide layout's navigation.
 *
 * Same four destinations as the bottom bar, same 2px dash marking the active
 * one — the dash just turns vertical when the labels stack. Below them, the
 * status the phone header carries as a single "ღია" pill gets room to say how
 * many people have actually voted.
 */
export function NavRail({
  items,
  activeIndex,
  turnout,
  unread,
  onNavigate,
}: NavRailProps) {
  const pct =
    turnout && turnout.total > 0
      ? Math.min(100, Math.round((turnout.voters / turnout.total) * 100))
      : 0;

  return (
    <Stack
      component="nav"
      sx={{
        width: NAV_RAIL_WIDTH,
        flex: 'none',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100dvh',
        borderRight: '1px solid',
        borderColor: 'hairline',
        bgcolor: (t) => (t.palette.mode === 'dark' ? '#120E0D' : t.palette.surface2),
        px: 1.75,
        pt: 2.75,
        pb: 2.25,
      }}
    >
      <Stack spacing={0.5} sx={{ px: 1, pb: 2.5 }}>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'primary.main',
          }}
        >
          SADZMAKATSO
        </Typography>
        <Typography variant="h1" sx={{ fontSize: 20, lineHeight: 1.1 }}>
          {ka.appName}
        </Typography>
      </Stack>

      <Stack spacing="2px">
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <ButtonBase
              key={item.to}
              onClick={() => onNavigate(item.to)}
              aria-current={active ? 'page' : undefined}
              sx={{
                height: 42,
                px: 1.5,
                gap: 1.4,
                justifyContent: 'flex-start',
                borderRadius: '10px',
                bgcolor: active ? 'background.paper' : 'transparent',
                transition: 'background-color .16s linear',
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <Box
                sx={{
                  width: 2,
                  height: 16,
                  flex: 'none',
                  borderRadius: 99,
                  bgcolor: active ? 'primary.main' : 'transparent',
                  transition: 'background-color .16s linear',
                }}
              />
              <Typography
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: active ? 'text.primary' : 'textMute',
                  transition: 'color .16s linear',
                }}
              >
                {item.label}
                <UnreadChip count={unread?.[item.to] ?? 0} />
              </Typography>
            </ButtonBase>
          );
        })}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {turnout && (
        <Stack
          spacing={1}
          sx={{
            p: 1.5,
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'surface2',
            bgcolor: (t) => (t.palette.mode === 'dark' ? '#1A1514' : t.palette.background.paper),
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: 99,
                bgcolor: 'primary.main',
                animation: 'emberPulse 2s ease-in-out infinite',
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'primary.light',
              }}
            >
              {ka.week.openWeek}
            </Typography>
          </Stack>

          <Typography sx={{ fontSize: 11.5, lineHeight: 1.5, color: 'text.secondary' }}>
            {ka.week.turnout(turnout.voters, turnout.total)}
          </Typography>

          <Box sx={{ height: 3, borderRadius: 99, bgcolor: 'surface2', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 99,
                bgcolor: 'signal.up',
                transition: 'width .28s cubic-bezier(.2,.8,.2,1)',
              }}
            />
          </Box>
        </Stack>
      )}
    </Stack>
  );
}
