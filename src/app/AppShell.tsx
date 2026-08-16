import { useMemo } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Box,
  ButtonBase,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import { ka } from "@/i18n/ka";
import { useOpenWeek } from "@/features/week/api";

const NAV = [
  { to: "/", label: ka.nav.ranking },
  { to: "/posts", label: ka.nav.posts },
  { to: "/weeks", label: ka.nav.archive },
  { to: "/me", label: ka.nav.profile },
];

const BOTTOM_NAV_HEIGHT = 66;

/** Routes that are a level down from a tab, and so earn a back button. */
function isDetailRoute(path: string) {
  return /^\/(members|weeks)\/[^/]+/.test(path);
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const week = useOpenWeek();

  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return 0;
    if (path.startsWith("/posts")) return 1;
    if (path.startsWith("/weeks")) return 2;
    if (path.startsWith("/me") || path.startsWith("/members")) return 3;
    return -1;
  }, [location.pathname]);

  const detail = isDetailRoute(location.pathname);
  const live =
    !detail &&
    week.data !== null &&
    week.data !== undefined &&
    !week.data.is_paused;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: "blur(16px)",
          backgroundColor: (t) =>
            t.palette.mode === "dark"
              ? "rgba(20,16,15,0.86)"
              : "rgba(251,247,246,0.88)",
          borderBottom: (t) => `1px solid ${t.palette.hairline}`,
        }}
      >
        <Container maxWidth="sm" disableGutters>
          <Toolbar sx={{ gap: 1.25, minHeight: 56, px: 2 }}>
            <Typography
              component={RouterLink}
              to="/"
              variant="h3"
              sx={{
                flexGrow: 1,
                textDecoration: "none",
                color: "text.primary",
                fontFamily: (t) => t.typography.h1.fontFamily,
                letterSpacing: "-0.01em",
              }}
            >
              {ka.appName}
            </Typography>

            {detail && (
              <ButtonBase
                onClick={() => navigate(-1)}
                sx={{
                  height: 44,
                  px: 1.75,
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.secondary",
                  fontSize: 13,
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "primary.main",
                    color: "text.primary",
                  },
                }}
              >
                {ka.common.back}
              </ButtonBase>
            )}

            {/* The week is open and taking votes — the only status the header carries. */}
            {live && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: 26,
                  px: "10px",
                  borderRadius: 999,
                  bgcolor: "rgba(247,55,24,0.12)",
                  border: "1px solid rgba(247,55,24,0.34)",
                }}
              >
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: 99,
                    bgcolor: "primary.main",
                    animation: "emberPulse 2s ease-in-out infinite",
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                    },
                  }}
                />
                {/* <Typography
                  sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'primary.light' }}
                >
                  {ka.week.open}
                </Typography> */}
              </Box>
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

      {/*
        Icons are gone. Four Georgian words are shorter to read than four
        pictograms are to decode, and a 2px dash under the active one carries
        the state without competing with the board's own colour language.
      */}
      <Box
        component="nav"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          pb: "env(safe-area-inset-bottom)",
          backgroundColor: (t) =>
            t.palette.mode === "dark"
              ? "rgba(20,16,15,0.93)"
              : "rgba(251,247,246,0.96)",
          backdropFilter: "blur(16px)",
          borderTop: (t) => `1px solid ${t.palette.hairline}`,
        }}
      >
        <Container maxWidth="sm" disableGutters>
          <Box sx={{ display: "flex", p: 1 }}>
            {NAV.map((item, index) => {
              const active = index === activeIndex;
              return (
                <ButtonBase
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    flex: 1,
                    height: 50,
                    flexDirection: "column",
                    gap: "6px",
                    borderRadius: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 2,
                      borderRadius: 99,
                      bgcolor: active ? "primary.main" : "transparent",
                      transition: "background-color .16s linear",
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: active ? "text.primary" : "textMute",
                      transition: "color .16s linear",
                    }}
                  >
                    {item.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
