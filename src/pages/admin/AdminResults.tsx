import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/Splash';
import { WeekSelect } from './WeekSelect';
import { useUpdateResult } from '@/features/admin/api';
import { useWeekStandings } from '@/features/standings/api';
import { ka } from '@/i18n/ka';

/**
 * Editing a frozen result. The RPC re-ranks the whole week afterwards so the
 * snapshot stays internally consistent, flags the row `edited`, and writes the
 * before/after into audit_log.
 */
export function AdminResults() {
  const { toast, toastError } = useToast();
  const [weekId, setWeekId] = useState<number | undefined>();
  const standings = useWeekStandings(weekId);
  const updateResult = useUpdateResult();

  const [drafts, setDrafts] = useState<Record<string, { up: string; down: string }>>({});

  useEffect(() => {
    setDrafts({});
  }, [weekId]);

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <WeekSelect value={weekId} onChange={setWeekId} closedOnly />

      {weekId === undefined ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          {ka.archive.pick}
        </Alert>
      ) : (standings.data ?? []).length === 0 ? (
        <Paper sx={{ borderRadius: 3 }}>
          <EmptyState text={ka.archive.empty} />
        </Paper>
      ) : (
        (standings.data ?? []).map((row) => {
          const draft = drafts[row.member_id] ?? {
            up: String(row.up),
            down: String(row.down),
          };
          const up = Number(draft.up);
          const down = Number(draft.down);
          const valid = Number.isInteger(up) && Number.isInteger(down) && up >= 0 && down >= 0;
          const changed = valid && (up !== row.up || down !== row.down);

          return (
            <Paper key={row.member_id} sx={{ borderRadius: 3, p: 2 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="numeral" sx={{ fontSize: 18, minWidth: 24 }}>
                    {row.rank}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }} noWrap>
                    {row.nickname}
                  </Typography>
                  {row.edited && (
                    <Chip size="small" variant="outlined" color="warning" label={ka.admin.edited} />
                  )}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    type="number"
                    label="▲"
                    value={draft.up}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.member_id]: { ...draft, up: event.target.value },
                      }))
                    }
                    sx={{ width: 88 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="▼"
                    value={draft.down}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.member_id]: { ...draft, down: event.target.value },
                      }))
                    }
                    sx={{ width: 88 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {ka.standings.net} {up - down > 0 ? `+${up - down}` : up - down}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!changed || updateResult.isPending}
                    onClick={() =>
                      updateResult.mutate(
                        { weekId, memberId: row.member_id, up, down },
                        {
                          onSuccess: () => toast(ka.profile.saved, 'success'),
                          onError: toastError,
                        },
                      )
                    }
                  >
                    {ka.common.save}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })
      )}
    </Stack>
  );
}
