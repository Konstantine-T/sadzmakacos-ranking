import { useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonBase, Divider, Popover, Stack, Typography } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { EmptyState } from '@/components/Splash';
import { UnreadChip } from '@/components/UnreadChip';
import { useMemberMap } from '@/features/members/api';
import { notificationRoute } from '@/lib/notificationRoute';
import type { Notification, NotificationKind } from '@/lib/database.types';
import { ka } from '@/i18n/ka';
import { NotificationRow } from './NotificationRow';
import {
  useMarkRead,
  useNotificationReads,
  useNotifications,
  useUnreadCounts,
} from './api';

/**
 * The bell, its count, and the feed behind it. One component for both layouts.
 *
 * WHY THE CURSORS ARE FROZEN. Opening the popover marks everything read
 * immediately, so the badge is honest the moment you look at it. But if the
 * rows drew their dots from those same fresh cursors, every dot would vanish
 * in the same frame and you would have no idea which lines were new. So the
 * cursors are snapshotted into a ref BEFORE the mark-read fires, and the dots
 * are drawn from the snapshot for as long as the popover stays open. Close and
 * reopen and the snapshot is retaken — by then everything really is read, so
 * the dots are correctly gone.
 *
 * The whole effect is one ref. No extra server state, nothing to clean up.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const notifications = useNotifications();
  const { total } = useUnreadCounts();
  const { cursors } = useNotificationReads();
  const markRead = useMarkRead();
  const { map: members } = useMemberMap();

  /** kind → read_at as it stood when this popover opened. */
  const frozen = useRef<Map<NotificationKind, string>>(new Map());

  const open = (event: MouseEvent<HTMLElement>) => {
    frozen.current = new Map(cursors); // snapshot BEFORE marking read
    setAnchor(event.currentTarget);
    if (total > 0) markRead.mutate(undefined);
  };

  const wasUnread = (row: Notification) => {
    const cursor = frozen.current.get(row.kind);
    return cursor === undefined || row.created_at > cursor;
  };

  const select = (row: Notification) => {
    setAnchor(null);
    navigate(notificationRoute(row));
  };

  const rows = notifications.data ?? [];

  return (
    <>
      <ButtonBase
        onClick={open}
        aria-label={ka.notifications.open}
        sx={{
          position: 'relative',
          flex: 'none',
          width: 44, // rule 5 — the icon is 21px, the target is not
          height: 44,
          borderRadius: 999,
          color: 'text.secondary',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <NotificationsIcon sx={{ fontSize: 21 }} />
        <UnreadChip count={total} variant="bell" />
      </ButtonBase>

      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              // Wide enough that Georgian does not wrap after two words, but
              // never wider than a 390px phone with room to breathe.
              width: 'min(340px, calc(100vw - 24px))',
              maxHeight: 'min(60vh, 420px)',
              borderRadius: '16px',
              mt: 0.5,
            },
          },
        }}
      >
        <Stack sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
            {ka.notifications.title}
          </Typography>
        </Stack>
        <Divider sx={{ borderColor: 'hairline' }} />

        {rows.length === 0 ? (
          <EmptyState text={ka.notifications.empty} />
        ) : (
          <Stack sx={{ p: 0.5 }}>
            {rows.map((row) => (
              <NotificationRow
                key={row.id}
                row={row}
                authorNickname={
                  row.actor_id ? members.get(row.actor_id)?.nickname : undefined
                }
                unread={wasUnread(row)}
                onSelect={select}
              />
            ))}
          </Stack>
        )}
      </Popover>
    </>
  );
}
