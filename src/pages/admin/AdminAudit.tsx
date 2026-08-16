import { Chip, Paper, Stack, Typography } from '@mui/material';
import { EmptyState, Splash } from '@/components/Splash';
import { useAuditLog } from '@/features/admin/api';
import { useMemberMap } from '@/features/members/api';
import { formatDateTime } from '@/lib/time';
import { ka } from '@/i18n/ka';

/** Read-only history. Every mutating admin action lands here (§11). */
export function AdminAudit() {
  const audit = useAuditLog();
  const { map: members } = useMemberMap();

  if (audit.isPending) return <Splash />;
  const rows = audit.data ?? [];

  return (
    <Stack spacing={1} sx={{ px: 2 }}>
      {rows.length === 0 ? (
        <Paper sx={{ borderRadius: 3 }}>
          <EmptyState text={ka.archive.empty} />
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {rows.map((entry) => (
            <Stack
              key={entry.id}
              spacing={0.5}
              sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" variant="outlined" label={entry.action} />
                <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                  {entry.actor_id ? (members.get(entry.actor_id)?.nickname ?? '—') : 'system'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(entry.created_at)}
                </Typography>
              </Stack>

              {entry.detail !== null && (
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    m: 0,
                    color: 'text.secondary',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontSize: 11,
                  }}
                >
                  {JSON.stringify(entry.detail)}
                </Typography>
              )}
            </Stack>
          ))}
        </Paper>
      )}
    </Stack>
  );
}
