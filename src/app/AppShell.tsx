import { useMemo } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  IconButton,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import LeaderboardIcon from '@mui/icons-material/EmojiEventsOutlined';
import RankIcon from '@mui/icons-material/BarChartRounded';
import PostsIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ArchiveIcon from '@mui/icons-material/HistoryRounded';
import ProfileIcon from '@mui/icons-material/PersonOutlineRounded';
import DarkIcon from '@mui/icons-material/DarkModeOutlined';
import LightIcon from '@mui/icons-material/LightModeOutlined';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
import { ka } from '@/i18n/ka';
import { useAuth } from './providers/AuthProvider';
import { useColorMode } from './providers/ColorModeProvider';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';

const NAV = [
  { to: '/', label: ka.nav.ranking, icon: <RankIcon /> },
  { to: '/posts', label: ka.nav.posts, icon: <PostsIcon /> },
  { to: '/weeks', label: ka.nav.archive, icon: <ArchiveIcon /> },
  { to: '/me', label: ka.nav.profile, icon: <ProfileIcon /> },
];

const BOTTOM_NAV_HEIGHT = 64;

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { member } = useAuth();
  const { mode, toggle } = useColorMode();

  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path.startsWith('/posts')) return 1;
    if (path.startsWith('/weeks')) return 2;
    if (path.startsWith('/me') || path.startsWith('/members')) return 3;
    return -1;
  }, [location.pathname]);

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(14px)',
          backgroundColor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(20,16,15,0.82)' : 'rgba(251,247,246,0.86)',
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Container maxWidth="sm" disableGutters>
          <Toolbar sx={{ gap: 0.5, minHeight: 56, px: 2 }}>
            <Typography
              component={RouterLink}
              to="/"
              variant="h3"
              sx={{
                flexGrow: 1,
                textDecoration: 'none',
                color: 'text.primary',
                fontFamily: (t) => t.typography.h1.fontFamily,
                letterSpacing: '-0.01em',
              }}
            >
              {ka.appName}
            </Typography>

            <Tooltip title={ka.allTime.title}>
              <IconButton
                onClick={() => navigate('/all-time')}
                aria-label={ka.allTime.title}
                size="small"
              >
                <LeaderboardIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={ka.common.theme}>
              <IconButton onClick={toggle} aria-label={ka.common.theme} size="small">
                {mode === 'dark' ? <LightIcon fontSize="small" /> : <DarkIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {member?.isAdmin && (
              <Tooltip title={ka.nav.admin}>
                <IconButton onClick={() => navigate('/admin')} aria-label={ka.nav.admin} size="small">
                  <ShieldIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {member && (
              <IconButton
                onClick={() => navigate('/me')}
                aria-label={ka.nav.profile}
                sx={{ p: 0.5 }}
              >
                <Badge
                  overlap="circular"
                  variant="dot"
                  color="primary"
                  invisible={!member.isAdmin}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                  <Avatar
                    {...avatarProps(member.id, member.nickname, avatarUrl(member.avatarUrl))}
                    sx={{
                      ...avatarProps(member.id, member.nickname, avatarUrl(member.avatarUrl)).sx,
                      width: 32,
                      height: 32,
                      fontSize: '0.8rem',
                    }}
                  />
                </Badge>
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          flexGrow: 1,
          pb: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 16px)`,
        }}
      >
        <Outlet />
      </Container>

      <Paper
        square
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          borderLeft: 0,
          borderRight: 0,
          borderBottom: 0,
          pb: 'env(safe-area-inset-bottom)',
          backgroundColor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(20,16,15,0.94)' : 'rgba(251,247,246,0.96)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Container maxWidth="sm" disableGutters>
          <BottomNavigation
            value={activeIndex}
            showLabels
            sx={{ height: BOTTOM_NAV_HEIGHT, backgroundColor: 'transparent' }}
            onChange={(_, index: number) => navigate(NAV[index].to)}
          >
            {NAV.map((item) => (
              <BottomNavigationAction
                key={item.to}
                label={item.label}
                icon={item.icon}
                sx={{ '& .MuiBottomNavigationAction-label': { fontSize: 12, mt: 0.25 } }}
              />
            ))}
          </BottomNavigation>
        </Container>
      </Paper>
    </Box>
  );
}
