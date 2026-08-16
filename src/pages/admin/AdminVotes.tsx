import { useMemo, useState } from 'react';
import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useToast } from '@/app/providers/ToastProvider';
import { EmptyState } from '@/components/Splash';
import { WeekSelect } from './WeekSelect';
import { useVoidVote, useVoteMatrix } from '@/features/admin/api';
import { useMembers } from '@/features/members/api';
import { useOpenWeek } from '@/features/week/api';
import { ka } from '@/i18n/ka';
import { signal } from '@/theme/tokens';

/**
 * The one place in the entire product where "who voted for whom" is visible,
 * and it is reachable only through admin_vote_matrix() — there is no view and
 * no table policy that would let this data out any other way.
 *
 * Rows are voters, columns are targets. Click a cell to void that vote.
 */
export function AdminVotes() {
  const { toastError } = useToast();
  const openWeek = useOpenWeek();
  const [weekId, setWeekId] = useState<number | undefined>();

  const effectiveWeek = weekId ?? openWeek.data?.id;
  const matrix = useVoteMatrix(effectiveWeek);
  const members = useMembers();
  const voidVote = useVoidVote(effectiveWeek);

  const active = useMemo(
    () => (members.data ?? []).filter((m) => m.is_active),
    [members.data],
  );

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of matrix.data ?? []) {
      const bucket = map.get(row.voter_id) ?? new Map<string, number>();
      bucket.set(row.target_id, row.value);
      map.set(row.voter_id, bucket);
    }
    return map;
  }, [matrix.data]);

  const headCell = {
    position: 'sticky' as const,
    left: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    borderRight: '1px solid',
    borderColor: 'divider',
    px: 1,
    minWidth: 88,
    maxWidth: 88,
  };

  return (
    <Stack spacing={1.5} sx={{ px: 2 }}>
      <WeekSelect value={effectiveWeek} onChange={setWeekId} />

      {(matrix.data ?? []).length === 0 ? (
        <Paper sx={{ borderRadius: 3 }}>
          <EmptyState text={ka.admin.noVotes} />
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ ...headCell, py: 1, textAlign: 'left' }}>
                    <Typography variant="caption" fontWeight={700}>
                      {ka.admin.voter} \ {ka.admin.target}
                    </Typography>
                  </Box>
                  {active.map((target) => (
                    <Box
                      component="th"
                      key={target.id}
                      sx={{ px: 0.5, py: 1, minWidth: 34, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Tooltip title={target.nickname}>
                        <Typography variant="caption" sx={{ writingMode: 'vertical-rl', rotate: '180deg' }}>
                          {target.nickname.slice(0, 6)}
                        </Typography>
                      </Tooltip>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box component="tbody">
                {active.map((voter) => (
                  <Box component="tr" key={voter.id}>
                    <Box component="td" sx={{ ...headCell, py: 0.5 }}>
                      <Typography variant="caption" noWrap fontWeight={600}>
                        {voter.nickname}
                      </Typography>
                    </Box>

                    {active.map((target) => {
                      const value = grid.get(voter.id)?.get(target.id);
                      const isSelf = voter.id === target.id;

                      return (
                        <Box
                          component="td"
                          key={target.id}
                          onClick={() => {
                            if (value === undefined) return;
                            voidVote.mutate(
                              { voterId: voter.id, targetId: target.id },
                              { onError: toastError },
                            );
                          }}
                          title={value !== undefined ? ka.admin.voidVote : undefined}
                          sx={{
                            textAlign: 'center',
                            py: 0.75,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            cursor: value !== undefined ? 'pointer' : 'default',
                            bgcolor: isSelf ? 'action.hover' : 'transparent',
                            color:
                              value === 1 ? signal.up : value === -1 ? signal.down : 'text.disabled',
                            fontWeight: 800,
                          }}
                        >
                          {isSelf ? '·' : value === 1 ? '+' : value === -1 ? '−' : ''}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
