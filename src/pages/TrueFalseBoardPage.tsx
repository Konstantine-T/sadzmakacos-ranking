import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Skeleton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageTransition } from '@/components/PageTransition';
import { useRealtime } from '@/features/realtime/useRealtime';
import { TrueFalseBoard } from '@/features/truefalse/TrueFalseBoard';
import { useTrueFalseBoards } from '@/features/truefalse/api';
import { categoryLabel, isCategory } from '@/features/truefalse/categories';
import { ka } from '@/i18n/ka';

/**
 * One category's full true/false ranking — where a board on the game page
 * leads when tapped. Its own route, so the phone's back gesture works.
 */
export function TrueFalseBoardPage() {
  const navigate = useNavigate();
  const { category } = useParams();
  const { member } = useAuth();

  useRealtime(undefined);

  const { boards, isPending } = useTrueFalseBoards();

  if (!isCategory(category)) return <Navigate to="/trivia/truefalse" replace />;

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2, pt: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack>
            <Typography variant="caption" color="text.secondary">
              {ka.truefalse.name}
            </Typography>
            <Typography variant="h2">{categoryLabel(category)}</Typography>
          </Stack>
          <Button
            onClick={() => navigate('/trivia/truefalse')}
            aria-label={ka.truefalse.close}
            sx={{ minWidth: 44, height: 44, color: 'text.secondary' }}
          >
            <CloseIcon />
          </Button>
        </Stack>

        {isPending ? (
          <Stack spacing={0.5}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : (
          <TrueFalseBoard rows={boards[category]} myId={member?.id} />
        )}
      </Stack>
    </PageTransition>
  );
}
