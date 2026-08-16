import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import SendIcon from '@mui/icons-material/SendRounded';
import { EmptyState } from '@/components/Splash';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';
import type { Comment, Member } from '@/lib/database.types';

const MAX = 100;

interface CommentItemProps {
  comment: Comment;
  author: Member | undefined;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (body: string) => void;
  onDelete: () => void;
}

function CommentItem({ comment, author, canEdit, canDelete, onEdit, onDelete }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const nickname = author?.nickname ?? '—';

  if (comment.deleted_at) {
    return (
      <Stack direction="row" spacing={1.5} sx={{ px: 2, py: 1.25, opacity: 0.5 }}>
        <Typography variant="body2" fontStyle="italic" color="text.secondary">
          {ka.comments.deleted}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Avatar
        {...avatarProps(comment.author_id, nickname, avatarUrl(author?.avatar_url ?? null))}
        sx={{
          ...avatarProps(comment.author_id, nickname, avatarUrl(author?.avatar_url ?? null)).sx,
          width: 30,
          height: 30,
          fontSize: '0.75rem',
          mt: 0.25,
        }}
      />

      <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0.25}>
        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography
            component={RouterLink}
            to={`/members/${comment.author_id}`}
            variant="body2"
            sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none' }}
          >
            {nickname}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(comment.created_at)}
          </Typography>
        </Stack>

        {editing ? (
          <Stack spacing={1} sx={{ pt: 0.5 }}>
            <TextField
              fullWidth
              multiline
              size="small"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX))}
              helperText={ka.posts.limit(MAX - draft.length)}
            />
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                disabled={draft.trim().length === 0}
                onClick={() => {
                  onEdit(draft.trim());
                  setEditing(false);
                }}
              >
                {ka.comments.save}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                {ka.common.cancel}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
            {comment.body}
          </Typography>
        )}
      </Stack>

      {!editing && (canEdit || canDelete) && (
        <Stack direction="row" spacing={0.25} alignItems="flex-start">
          {canEdit && (
            <IconButton size="small" aria-label={ka.comments.edit} onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {canDelete && (
            <IconButton size="small" aria-label={ka.comments.remove} onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      )}
    </Stack>
  );
}

interface CommentComposerProps {
  disabled?: boolean;
  onSubmit: (body: string) => void;
}

function CommentComposer({ disabled, onSubmit }: CommentComposerProps) {
  const [body, setBody] = useState('');
  const remaining = MAX - body.length;
  const canSend = body.trim().length > 0 && !disabled;

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ p: 2 }}>
      <TextField
        fullWidth
        multiline
        maxRows={3}
        size="small"
        value={body}
        disabled={disabled}
        placeholder={ka.comments.placeholder}
        onChange={(event) => setBody(event.target.value.slice(0, MAX))}
        helperText={body.length > 0 ? ka.posts.limit(remaining) : ' '}
        inputProps={{ 'aria-label': ka.comments.placeholder }}
      />
      <IconButton
        color="primary"
        aria-label={ka.comments.send}
        disabled={!canSend}
        onClick={() => {
          onSubmit(body.trim());
          setBody('');
        }}
        sx={{ mt: 0.25 }}
      >
        <SendIcon />
      </IconButton>
    </Stack>
  );
}

interface CommentThreadProps {
  comments: Comment[];
  members: Map<string, Member>;
  myId: string;
  isAdmin: boolean;
  /** Threads lock when the week closes (§1.5). */
  locked: boolean;
  onCreate: (body: string) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}

/** One thread per week, attached to the week rather than to any person. */
export function CommentThread({
  comments,
  members,
  myId,
  isAdmin,
  locked,
  onCreate,
  onEdit,
  onDelete,
}: CommentThreadProps) {
  // Soft-deleted rows are kept in the list on purpose — CommentItem renders
  // them as „წაშლილია" so the thread keeps its shape.
  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
      {comments.length === 0 ? (
        <EmptyState text={ka.comments.empty} />
      ) : (
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            author={members.get(comment.author_id)}
            canEdit={!locked && comment.author_id === myId}
            canDelete={!locked && (comment.author_id === myId || isAdmin)}
            onEdit={(body) => onEdit(comment.id, body)}
            onDelete={() => onDelete(comment.id)}
          />
        ))
      )}

      {locked ? (
        <Alert severity="info" variant="outlined" sx={{ m: 2, borderRadius: 2 }}>
          {ka.comments.locked}
        </Alert>
      ) : (
        <CommentComposer onSubmit={onCreate} />
      )}
    </Paper>
  );
}
