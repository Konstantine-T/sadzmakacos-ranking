import { useState } from 'react';
import { Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/Splash';
import { WeekSelect } from './WeekSelect';
import { useAdminDeleteComment, useAdminDeletePost } from '@/features/admin/api';
import { useScoredPosts } from '@/features/posts/api';
import { useComments } from '@/features/comments/api';
import { useMemberMap } from '@/features/members/api';
import { useOpenWeek } from '@/features/week/api';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

/** Delete any post or comment. Both actions land in audit_log with the body. */
export function AdminModeration() {
  const { toastError } = useToast();
  const openWeek = useOpenWeek();
  const [weekId, setWeekId] = useState<number | undefined>();
  const effectiveWeek = weekId ?? openWeek.data?.id;

  const posts = useScoredPosts(effectiveWeek);
  const comments = useComments(effectiveWeek);
  const { map: members } = useMemberMap();
  const deletePost = useAdminDeletePost(effectiveWeek);
  const deleteComment = useAdminDeleteComment(effectiveWeek);

  const row = (
    key: string,
    author: string,
    body: string,
    when: string,
    onDelete: () => void,
    muted?: boolean,
  ) => (
    <Stack
      key={key}
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', opacity: muted ? 0.45 : 1 }}
    >
      <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography variant="body2" fontWeight={600}>
            {author}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(when)}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {body}
        </Typography>
      </Stack>
      {!muted && (
        <IconButton size="small" aria-label={ka.common.delete} onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <WeekSelect value={effectiveWeek} onChange={setWeekId} />

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Typography variant="h3" sx={{ p: 2, pb: 1 }}>
          {ka.posts.title}
        </Typography>
        <Divider />
        {posts.rows.length === 0 ? (
          <EmptyState text={ka.posts.emptyArchive} />
        ) : (
          posts.rows.map((post) =>
            row(
              post.id,
              members.get(post.author_id)?.nickname ?? '—',
              post.body,
              post.created_at,
              () => deletePost.mutate(post.id, { onError: toastError }),
            ),
          )
        )}
      </Paper>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Typography variant="h3" sx={{ p: 2, pb: 1 }}>
          {ka.comments.title}
        </Typography>
        <Divider />
        {(comments.data ?? []).length === 0 ? (
          <EmptyState text={ka.comments.empty} />
        ) : (
          (comments.data ?? []).map((comment) =>
            row(
              comment.id,
              members.get(comment.author_id)?.nickname ?? '—',
              comment.deleted_at ? ka.comments.deleted : comment.body,
              comment.created_at,
              () => deleteComment.mutate(comment.id, { onError: toastError }),
              Boolean(comment.deleted_at),
            ),
          )
        )}
      </Paper>
    </Stack>
  );
}
