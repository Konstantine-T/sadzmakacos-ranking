import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Skeleton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageTransition } from '@/components/PageTransition';
import { useRealtime } from '@/features/realtime/useRealtime';
import { SurvivalBoard } from '@/features/survival/SurvivalBoard';
import { useSurvivalBoards } from '@/features/survival/api';
import { categoryLabel, isCategory } from '@/features/survival/categories';
import { ka } from '@/i18n/ka';

/**
 * One category's full survival ranking — where a board on the game page
 * leads when tapped. Its own route, so the phone's back gesture works.
 */
export function SurvivalBoardPage() {
  const navigate = useNavigate();
  const { category } = useParams();
  const { member } = useAuth();

  useRealtime(undefined);

  const { boards, isPending } = useSurvivalBoards();

  if (!isCategory(category)) return <Navigate to="/trivia/survival" replace />;

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2, pt: 1.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack>
            <Typography variant="caption" color="text.secondary">
              {ka.survival.name}
            </Typography>
            <Typography variant="h2">{categoryLabel(category)}</Typography>
          </Stack>
          <Button
            onClick={() => navigate('/trivia/survival')}
            aria-label={ka.survival.close}
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
          <SurvivalBoard rows={boards[category]} myId={member?.id} />
        )}
      </Stack>
    </PageTransition>
  );
}
