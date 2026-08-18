import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import { PageTransition } from '@/components/PageTransition';
import { ka } from '@/i18n/ka';

const TABS = [
  { to: '/admin', label: ka.admin.dashboard },
  { to: '/admin/accounts', label: ka.admin.accounts },
  { to: '/admin/members', label: ka.admin.members },
  { to: '/admin/votes', label: ka.admin.votes },
  { to: '/admin/week', label: ka.admin.week },
  { to: '/admin/moderation', label: ka.admin.moderation },
  { to: '/admin/results', label: ka.admin.results },
  { to: '/admin/announcements', label: ka.admin.announcements },
  { to: '/admin/polls', label: ka.admin.polls },
  { to: '/admin/audit', label: ka.admin.audit },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = TABS.reduce(
    (best, tab, index) =>
      location.pathname === tab.to || (tab.to !== '/admin' && location.pathname.startsWith(tab.to))
        ? index
        : best,
    0,
  );

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ pt: 2 }}>
        <Typography variant="h1" sx={{ px: 2 }}>
          {ka.admin.title}
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={active}
            onChange={(_, index: number) => navigate(TABS[index].to)}
            variant="scrollable"
            scrollButtons={false}
            sx={{ px: 1 }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.to} label={tab.label} sx={{ minWidth: 'auto', px: 1.5 }} />
            ))}
          </Tabs>
        </Box>

        <Outlet />
      </Stack>
    </PageTransition>
  );
}
