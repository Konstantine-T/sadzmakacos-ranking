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
import { useChatUnread } from "@/features/chat/api";
import { ka } from "@/i18n/ka";
import { useOpenWeek, useTurnout } from "@/features/week/api";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useUnreadCounts } from "@/features/notifications/api";
import { UnreadChip } from "@/components/UnreadChip";
import { NavRail } from "./NavRail";
import { SideRail } from "./SideRail";
import { useWideLayout, useWidestLayout } from "./layout";
import { formatDay } from "@/lib/time";

const NAV = [
  { to: "/", label: ka.nav.ranking },
  { to: "/posts", label: ka.nav.posts },
  { to: "/chat", label: ka.nav.chat },
  { to: "/trivia", label: ka.nav.trivia },
  { to: "/weeks", label: ka.nav.archive },
  { to: "/me", label: ka.nav.profile },
];

/**
 * What the wide layout's top bar calls each destination. The rail already
 * carries the app's name, so the bar names the page instead.
 */
const TITLES = [
  ka.standings.title,
  ka.posts.title,
  ka.nav.chat,
  ka.trivia.title,
  ka.archive.title,
  ka.nav.profile,
];

const BOTTOM_NAV_HEIGHT = 66;

/** Routes that are a level down from a tab, and so earn a back button. */
function isDetailRoute(path: string) {
  return /^\/(members|weeks)\/[^/]+/.test(path);
}

/**
 * The one screen that takes over the phone. A quiz question needs the whole
 * viewport and supplies its own header and its own bottom button, so the
 * shell's top bar and nav would be a second set of both.
 */
/**
 * Routes that must fit the viewport exactly instead of growing with content.
 *
 * A chat pins its composer to the bottom and scrolls only its message list, so
 * it needs a bounded height rather than the shell's usual "as tall as it needs
 * to be". Everything else stays exactly as it was.
 */
function isFullHeightRoute(path: string) {
  // The chat pins a composer to the bottom and owns its own scrolling, so it
  // must fit the viewport exactly rather than grow with its content.
  return path.startsWith("/chat");
}

function isImmersiveRoute(path: string) {
  return path.startsWith("/trivia/skills");
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const week = useOpenWeek();
  const wide = useWideLayout();
  const widest = useWidestLayout();
  const turnout = useTurnout(week.data?.id);

  const activeIndex = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return 0;
    if (path.startsWith("/posts")) return 1;
    if (path.startsWith("/chat")) return 2;
    if (path.startsWith("/trivia")) return 3;
    if (path.startsWith("/weeks")) return 4;
    if (path.startsWith("/me") || path.startsWith("/members")) return 5;
    return -1;
  }, [location.pathname]);

  /**
   * The პოსტები chip. Not a second counter — it is the 'post' slice of the
   * same unread_counts() the bell sums, which is why reading the posts drops
   * both at once.
   */
  const { counts } = useUnreadCounts();
  const chatUnread = useChatUnread();
  const navUnread: Record<string, number> = {
    "/posts": counts.post,
    "/chat": chatUnread.data ?? 0,
  };

  const detail = isDetailRoute(location.pathname);
  const immersive = isImmersiveRoute(location.pathname);
  const fullHeight = isFullHeightRoute(location.pathname);
  const live =
    !detail &&
    week.data !== null &&
    week.data !== undefined &&
    !week.data.is_paused;

  const backButton = (label: string) => (
    <ButtonBase
      onClick={() => navigate(-1)}
      sx={{
        flex: "none",
        height: 44,
        px: 1.75,
        whiteSpace: "nowrap",
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
      {label}
    </ButtonBase>
  );

  // ----------------------------------------------------------------- wide ---
  // Rail on the left, page in the middle, peripheral column on the right once
  // there is room for it. Same four destinations, same active-dash language —
  // the dash just turns vertical when the labels stack.
  if (wide) {
    return (
      <Box
        sx={{ minHeight: "100dvh", display: "flex", alignItems: "flex-start" }}
      >
        <NavRail
          items={NAV}
          activeIndex={activeIndex}
          turnout={
            week.data
              ? {
                  voters: turnout.data?.voters ?? 0,
                  total: turnout.data?.total_members ?? 0,
                }
              : undefined
          }
          unread={navUnread}
          onNavigate={(to) => navigate(to)}
        />

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: (t) => t.zIndex.appBar,
              height: 64,
              px: 3.5,
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderBottom: "1px solid",
              borderColor: "hairline",
              backgroundColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(20,16,15,0.9)"
                  : "rgba(251,247,246,0.9)",
              backdropFilter: "blur(16px)",
            }}
          >
            <Typography
              variant="h3"
              sx={{
                flex: "none",
                whiteSpace: "nowrap",
                fontFamily: (t) => t.typography.h1.fontFamily,
              }}
            >
              {TITLES[activeIndex] ?? ka.appName}
            </Typography>

            {week.data && (
              <Typography
                sx={{
                  flex: "none",
                  whiteSpace: "nowrap",
                  fontSize: 12.5,
                  color: "text.secondary",
                }}
              >
                {ka.week.range(
                  formatDay(week.data.starts_at),
                  formatDay(week.data.ends_at),
                )}
              </Typography>
            )}

            <Box sx={{ flexGrow: 1 }} />

            {detail && backButton(ka.nav.backToRanking)}

            {/* Same component as the phone header — there is no second bell. */}
            <NotificationBell />
          </Box>

          <Box
            component="main"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 3,
              px: 3.5,
              pt: 3,
              pb: 5,
              ...(fullHeight && {
                // 64px is the sticky header above; the rest is the chat's.
                height: "calc(100dvh - 64px)",
                minHeight: 0,
                pb: 0,
                alignItems: "stretch",
              }),
            }}
          >
            <Box
              sx={{
                flexGrow: 1,
                minWidth: 0,
                ...(fullHeight && {
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }),
              }}
            >
              <Outlet />
            </Box>

            {widest && (
              <SideRail
                weekId={week.data?.id}
                hidePosts={location.pathname.startsWith("/posts")}
              />
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------- phone ---
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        ...(fullHeight && { height: "100dvh", overflow: "hidden" }),
      }}
    >
      {!immersive && (
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
                noWrap
                sx={{
                  flexGrow: 1,
                  minWidth: 0,
                  textDecoration: "none",
                  color: "text.primary",
                  fontFamily: (t) => t.typography.h1.fontFamily,
                  letterSpacing: "-0.01em",
                }}
              >
                {ka.appName}
              </Typography>

              {detail && backButton(ka.common.back)}

              <NotificationBell />

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
                  <Typography
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "primary.light",
                    }}
                  >
                    Live
                  </Typography>
                </Box>
              )}
            </Toolbar>
          </Container>
        </AppBar>
      )}

      <Container
        component="main"
        maxWidth="sm"
        disableGutters
        sx={{
          flexGrow: 1,
          ...(!immersive && {
            pb: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 16px)`,
          }),
          // A bounded box the chat can fill; the pb above still reserves the
          // fixed bottom nav, so the composer sits above it rather than under.
          ...(fullHeight && {
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }),
        }}
      >
        <Outlet />
      </Container>

      {/*
        Icons are gone. Four Georgian words are shorter to read than four
        pictograms are to decode, and a 2px dash under the active one carries
        the state without competing with the board's own colour language.
      */}
      {!immersive && (
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
                      borderRadius: '10px',
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
                      component="span"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? "text.primary" : "textMute",
                        transition: "color .16s linear",
                      }}
                    >
                      {item.label}
                      <UnreadChip count={navUnread[item.to] ?? 0} />
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
}
