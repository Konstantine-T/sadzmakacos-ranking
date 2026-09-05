import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton, Stack, Typography } from '@mui/material';
import { useAuth } from '@/app/providers/AuthProvider';
import { PageTransition } from '@/components/PageTransition';
import { Splash } from '@/components/Splash';
import { ScopeToggle } from '@/features/standings/ScopeToggle';
import { useOpenWeek } from '@/features/week/api';
import { useRealtime } from '@/features/realtime/useRealtime';
import { ScoreScopeTabs } from '@/features/trivia/ScoreScopeTabs';
import { TriviaBoard } from '@/features/trivia/TriviaBoard';
import { TriviaGameCard } from '@/features/trivia/TriviaGameCard';
import { FlagGameCard } from '@/features/flags/FlagGameCard';
import { useFlagBoard } from '@/features/flags/api';
import {
  useMyAnswers,
  useTriviaAllTimeBoard,
  useTriviaWeekBoard,
  useWeekQuestions,
} from '@/features/trivia/api';
import { ka } from '@/i18n/ka';

type Tab = 'games' | 'rank';
type Scope = 'week' | 'allTime';

const TABS = [
  { value: 'games' as const, label: ka.trivia.games },
  { value: 'rank' as const, label: ka.trivia.rank },
];

const SCOPES = [
  { value: 'week' as const, label: ka.trivia.thisWeek },
  { value: 'allTime' as const, label: ka.trivia.allTime },
];

/**
 * ტრივია: the games list and the boards, one tab each.
 *
 * The rank tab carries its own week/all-time switch rather than a third top-level
 * tab — two tabs is the structure, and three Georgian labels do not fit a 390px
 * pill without abbreviating them into nonsense.
 */
export function TriviaPage() {
  const navigate = useNavigate();
  const { member } = useAuth();

  const [tab, setTab] = useState<Tab>('games');
  const [scope, setScope] = useState<Scope>('week');

  const weekQuery = useOpenWeek();
  const weekId = weekQuery.data?.id;

  useRealtime(weekId);

  const questions = useWeekQuestions(weekId);
  const answers = useMyAnswers(weekId, member?.id);
  const weekBoard = useTriviaWeekBoard(weekId);
  const allTime = useTriviaAllTimeBoard();
  const flags = useFlagBoard();

  const answeredCount = useMemo(() => {
    const ids = new Set((questions.data ?? []).map((q) => q.id));
    return (answers.data ?? []).filter((a) => ids.has(a.question_id)).length;
  }, [questions.data, answers.data]);

  if (weekQuery.isPending) return <Splash />;

  const isAllTime = scope === 'allTime';

  return (
    <PageTransition>
      <Stack spacing={2} sx={{ p: 2, pt: 1.75 }}>
        <Typography variant="h2">{ka.trivia.title}</Typography>

        <ScopeToggle value={tab} segments={TABS} ariaLabel={ka.trivia.title} onChange={setTab} />

        {tab === 'games' ? (
          // `questions` fetches only once weekId is known, so it always has its
          // own brief pending window right as the page appears. Without this
          // guard, `total` reads as 0 before the fetch resolves and the card
          // flashes ka.trivia.errors.noTest ("no test this week") even in weeks
          // that have one — indistinguishable from an actually dry pool. A short
          // skeleton, sized to the card it replaces, avoids asserting a false
          // negative while the real answer is still in flight.
          //
          // Gated on weekId too: react-query v5 reports `isPending: true` for a
          // disabled query forever, not just while a real fetch is in flight, so
          // without weekId a bare `questions.isPending` check would swap the
          // dry-pool message for an unending skeleton instead of fixing anything.
          weekId !== undefined && questions.isPending ? (
            <Stack spacing={1.25}>
              <Skeleton variant="rounded" height={158} sx={{ borderRadius: '16px' }} />
              <Skeleton variant="rounded" height={54} sx={{ borderRadius: '16px' }} />
            </Stack>
          ) : (
            <Stack spacing={1.25}>
              <TriviaGameCard
                answered={answeredCount}
                total={questions.data?.length ?? 0}
                onOpen={() => navigate('/trivia/skills')}
              />
              {/* The flag game does not feed ტრივიას რანკი. Every game owns its
                  own board: a weekly ten-question test and an endless run
                  cannot be summed without whoever plays most winning. */}
              <FlagGameCard
                topStreak={flags.rows[0]?.best_streak ?? 0}
                myBest={flags.rows.find((r) => r.member_id === member?.id)?.best_streak}
                onOpen={() => navigate('/trivia/flags')}
              />
            </Stack>
          )
        ) : (
          <Stack spacing={1.5}>
            <ScoreScopeTabs
              value={scope}
              segments={SCOPES}
              ariaLabel={ka.trivia.rank}
              onChange={setScope}
            />
            <TriviaBoard
              rows={isAllTime ? allTime.rows : weekBoard.rows}
              loading={
                isAllTime
                  ? allTime.isPending
                  : // Same trap as the games tab: `useTriviaWeekBoard(undefined)` is a
                    // disabled query, and TanStack Query v5 reports `isPending: true`
                    // for a disabled query forever — during a week gap this spun the
                    // board's skeleton rows with no fetch ever in flight to resolve it.
                    weekId !== undefined && weekBoard.isPending
              }
              myId={member?.id}
            />
          </Stack>
        )}
      </Stack>
    </PageTransition>
  );
}
