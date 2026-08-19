import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import type { Notification } from '@/lib/database.types';
import { tb } from '@/lib/time';
import { ka } from '@/i18n/ka';

interface NotificationRowProps {
  row: Notification;
  /** Author nickname, for 'post' rows only. Nothing else carries a name. */
  authorNickname?: string;
  /** Still showing its dot — frozen when the popover opened, not live. */
  unread: boolean;
  onSelect: (row: Notification) => void;
}

/**
 * One line of the feed.
 *
 * All copy comes from ka.notifications (rule 4). Note what this component
 * CANNOT do: name whoever reacted or voted. `actor_id` is null on those rows
 * by database constraint, so there is no name in scope to render even if
 * somebody later decided they wanted one.
 */
export function NotificationRow({
  row,
  authorNickname,
  unread,
  onSelect,
}: NotificationRowProps) {
  /**
   * A coalesced row (tally > 1) has had its emoji cleared, because "5
   * reactions" is no longer about one emoji. Missing emoji falls back to the
   * plural form too, so a null can never render as an empty gap in the middle
   * of a sentence.
   */
  const plural = row.tally > 1 || !row.emoji;

  const text = (() => {
    switch (row.kind) {
      case 'post':
        return ka.notifications.newPost(authorNickname ?? '—');
      case 'rank':
        return row.rank_from === null || row.rank_to === null
          ? ka.notifications.rankFirst(row.rank_to ?? 0)
          : ka.notifications.rankMoved(row.rank_from, row.rank_to);
      case 'reaction':
        if (row.post_id === null) {
          return plural
            ? ka.notifications.reactionMany(row.tally)
            : ka.notifications.reactionOne(row.emoji!);
        }
        return plural
          ? ka.notifications.postReactionMany(row.tally)
          : ka.notifications.postReactionOne(row.emoji!);
      case 'post_vote':
        return plural
          ? ka.notifications.postVoteMany(row.tally)
          : ka.notifications.postVoteOne;
    }
  })();

  /**
   * Rank rows borrow the board's temperature scale: climbing is ember amber,
   * sinking is cool slate. Same language as the scoreboard, so the direction
   * reads before the numbers do.
   */
  const rankTint =
    row.kind === 'rank' && row.rank_from !== null && row.rank_to !== null
      ? row.rank_to < row.rank_from
        ? 'signal.up'
        : 'signal.down'
      : undefined;

  return (
    <ButtonBase
      onClick={() => onSelect(row)}
      sx={{
        width: '100%',
        minHeight: 44, // rule 5
        px: 1.5,
        py: 1.25,
        gap: 1.25,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        borderRadius: '10px',
        textAlign: 'left',
        '&:hover': { bgcolor: 'surface2' },
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          mt: '6px',
          flex: 'none',
          borderRadius: 99,
          bgcolor: unread ? 'primary.main' : 'transparent',
        }}
      />

      <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0.25}>
        <Typography
          sx={{
            fontSize: 13,
            lineHeight: 1.45,
            fontWeight: unread ? 600 : 400,
            // The temperature only shows while the row is still unread. A read
            // rank line in full amber reads as new all over again, which is
            // exactly the signal the dot is there to carry.
            color: unread ? (rankTint ?? 'text.primary') : 'text.secondary',
          }}
        >
          {text}
        </Typography>
      </Stack>

      <Typography
        sx={{ flex: 'none', fontSize: 10.5, color: 'textMute', mt: '2px' }}
      >
        {tb(row.created_at).fromNow(true)}
      </Typography>
    </ButtonBase>
  );
}
