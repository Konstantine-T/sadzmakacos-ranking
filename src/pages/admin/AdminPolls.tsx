import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/Splash';
import {
  useAdminPolls,
  useCreatePoll,
  useDeletePoll,
  useSetPoll,
  type AdminPoll,
} from '@/features/admin/api';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

const QUESTION_MAX = 200;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

/** One option per line, blanks ignored — the textarea *is* the editor. */
function parseOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Create a poll, close it, hide it, delete it.
 *
 * The composer is a textarea rather than a builder with add/remove/reorder
 * controls: reordering is moving a line, removing is deleting one, and there is
 * no drag target to miss. Options are immutable once created — the same
 * one-shot rule posts follow — so the form is the only place they can be set.
 */
export function AdminPolls() {
  const { toast, toastError } = useToast();
  const polls = useAdminPolls();
  const create = useCreatePoll();
  const setPoll = useSetPoll();
  const remove = useDeletePoll();

  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [isMulti, setIsMulti] = useState(false);

  const options = parseOptions(optionsText);
  const canCreate =
    question.trim().length > 0 &&
    options.length >= MIN_OPTIONS &&
    options.length <= MAX_OPTIONS &&
    !create.isPending;

  const row = (poll: AdminPoll) => {
    const open = poll.closed_at === null;

    return (
      <Paper key={poll.id} sx={{ borderRadius: '12px', p: 2 }}>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                {poll.question}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(poll.created_at)} ·{' '}
                {poll.is_multi ? ka.polls.pickMany : ka.polls.pickOne} ·{' '}
                {open ? ka.archive.open : ka.polls.closed} · {poll.answered_by}
              </Typography>
            </Stack>

            {/* is_active — the same visible/hidden switch announcements use. */}
            <Switch
              checked={poll.is_active}
              inputProps={{ 'aria-label': poll.is_active ? ka.admin.hide : ka.admin.show }}
              onChange={(_, checked) =>
                setPoll.mutate({ pollId: poll.id, isActive: checked }, { onError: toastError })
              }
            />
          </Stack>

          <Stack spacing={0.5}>
            {poll.options.map((option) => (
              <Stack key={option.id} direction="row" spacing={1} alignItems="baseline">
                <Typography
                  sx={{
                    minWidth: 22,
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: option.count > 0 ? 'signal.up' : 'textMute',
                  }}
                >
                  {option.count}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {option.label}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                setPoll.mutate({ pollId: poll.id, closed: open }, { onError: toastError })
              }
            >
              {open ? ka.admin.pollClose : ka.admin.pollReopen}
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => remove.mutate(poll.id, { onError: toastError })}
            >
              {ka.admin.pollDelete}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <Paper sx={{ borderRadius: '12px', p: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            size="small"
            label={ka.admin.pollQuestion}
            value={question}
            onChange={(event) => setQuestion(event.target.value.slice(0, QUESTION_MAX))}
            helperText={ka.posts.limit(QUESTION_MAX - question.length)}
          />

          <TextField
            fullWidth
            multiline
            minRows={4}
            size="small"
            label={ka.admin.pollOptions}
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            helperText={`${ka.admin.pollOptionsHint} · ${options.length}`}
            error={options.length > MAX_OPTIONS}
          />

          <FormControlLabel
            control={
              <Checkbox checked={isMulti} onChange={(_, checked) => setIsMulti(checked)} />
            }
            label={<Typography variant="body2">{ka.admin.pollMulti}</Typography>}
          />

          <Box>
            <Typography variant="caption" color="text.secondary">
              {ka.admin.pollOnceWarning}
            </Typography>
          </Box>

          <Button
            variant="contained"
            disabled={!canCreate}
            onClick={() =>
              create.mutate(
                { question: question.trim(), options, isMulti },
                {
                  onSuccess: () => {
                    setQuestion('');
                    setOptionsText('');
                    setIsMulti(false);
                    toast(ka.profile.saved, 'success');
                  },
                  onError: toastError,
                },
              )
            }
          >
            {ka.admin.pollCreate}
          </Button>
        </Stack>
      </Paper>

      {(polls.data ?? []).length === 0 ? (
        <Paper sx={{ borderRadius: '12px' }}>
          <EmptyState text={ka.admin.pollNone} />
        </Paper>
      ) : (
        (polls.data ?? []).map(row)
      )}
    </Stack>
  );
}
