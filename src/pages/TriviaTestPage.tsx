import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useWideLayout } from '@/app/layout';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { Splash } from '@/components/Splash';
import { useOpenWeek } from '@/features/week/api';
import { QuestionCard } from '@/features/trivia/QuestionCard';
import { useAnswerTrivia, useMyAnswers, useWeekQuestions } from '@/features/trivia/api';
import { ka } from '@/i18n/ka';

/**
 * Quiz runner: one question per screen, animated reveal of correct/incorrect.
 *
 * Resumability is not state we keep — it is derived. `trivia_answers` is the
 * only record that you answered anything, so on mount we jump to the first
 * question without a row. Closing the app mid-test and coming back lands you
 * exactly where you were, on any device.
 */
export function TriviaTestPage() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const wide = useWideLayout();

  /**
   * The runner owns the whole screen only on a phone, where AppShell strips its
   * top bar and nav for this route. Wide, that chrome stays — so a forced 100dvh
   * here is a viewport's worth of height BELOW the bar, and the option list's
   * `flex: 1` expands into it and pushes დადასტურება off the bottom.
   */
  const fullHeight = wide ? undefined : '100dvh';
  const { toastError } = useToast();

  const weekQuery = useOpenWeek();
  const weekId = weekQuery.data?.id;

  const questions = useWeekQuestions(weekId);
  const answers = useMyAnswers(weekId, member?.id);
  const answer = useAnswerTrivia(weekId);

  /** questionId -> the choice already committed. */
  const answeredBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of answers.data ?? []) map.set(a.question_id, a.choice_index);
    return map;
  }, [answers.data]);

  const list = questions.data ?? [];

  // Resume point: the first unanswered question.
  const firstUnanswered = useMemo(() => {
    const i = list.findIndex((q) => !answeredBy.has(q.id));
    return i === -1 ? list.length : i;
  }, [list, answeredBy]);

  const [cursor, setCursor] = useState<number | null>(null);
  const [grade, setGrade] = useState<{ questionId: string; correctIndex: number } | null>(null);

  if (weekQuery.isPending) return <Splash />;

  const close = () => navigate('/trivia');

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 1, pt: 'calc(8px + env(safe-area-inset-top))', pb: 0.5 }}
    >
      <Typography sx={{ pl: 1, fontSize: 13, fontWeight: 700 }}>
        {ka.trivia.skills.name}
      </Typography>
      <Button
        onClick={close}
        aria-label={ka.trivia.finished.back}
        sx={{ minWidth: 44, height: 44, color: 'text.secondary' }}
      >
        <CloseIcon />
      </Button>
    </Stack>
  );

  // Weeks can have a gap between one closing and the next opening. Checked
  // here, before gating on `questions`/`answers`: those two queries stay
  // disabled (and therefore permanently `isPending`) while `weekId` is
  // undefined, so folding them into one big pending check with `weekQuery`
  // would spin the Splash forever instead of ever reaching the empty state.
  if (!weekQuery.data) {
    return (
      <Stack sx={{ minHeight: fullHeight }}>
        {header}
        <Box sx={{ p: 2 }}>
          <Alert severity="warning" sx={{ borderRadius: '12px' }}>
            {ka.errors.noOpenWeek}
          </Alert>
        </Box>
      </Stack>
    );
  }

  if (questions.isPending || answers.isPending) return <Splash />;

  const index = cursor ?? firstUnanswered;
  const done = index >= list.length;

  if (list.length === 0) {
    return (
      <Stack sx={{ minHeight: fullHeight }}>
        {header}
        <Box sx={{ p: 2 }}>
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            {ka.trivia.errors.noTest}
          </Alert>
        </Box>
      </Stack>
    );
  }

  const correctCount = (answers.data ?? []).filter((a) => a.is_correct).length;

  if (done) {
    return (
      <Stack sx={{ minHeight: fullHeight }}>
        {header}
        <Stack spacing={2} sx={{ p: 3, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h2">{ka.trivia.finished.title}</Typography>
          <Typography sx={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {ka.trivia.finished.score(correctCount, list.length)}
          </Typography>
          <Button variant="contained" sx={{ height: 52, px: 4 }} onClick={close}>
            {ka.trivia.finished.back}
          </Button>
        </Stack>
      </Stack>
    );
  }

  const question = list[index];
  const answeredChoice = answeredBy.get(question.id) ?? null;
  const correctIndex =
    grade && grade.questionId === question.id ? grade.correctIndex : null;

  // Progress segments: green/red for settled questions, ember for the current one.
  const segments = list.map((q, i) => {
    const a = (answers.data ?? []).find((x) => x.question_id === q.id);
    if (a) return a.is_correct ? 'ok' : 'no';
    return i === index ? 'now' : 'idle';
  });

  return (
    <Stack sx={{ minHeight: fullHeight }}>
      {header}

      <Stack direction="row" spacing="3px" sx={{ px: 2, pb: 1.5 }}>
        {segments.map((s, i) => (
          <Box
            key={i}
            sx={{
              height: 3,
              flex: 1,
              borderRadius: '2px',
              bgcolor: (t) =>
                s === 'ok'
                  ? t.palette.quiz.correct
                  : s === 'no'
                    ? t.palette.quiz.wrong
                    : s === 'now'
                      ? 'primary.main'
                      : 'surface2',
            }}
          />
        ))}
      </Stack>

      <QuestionCard
        key={question.id}
        question={question}
        index={index}
        total={list.length}
        answeredChoice={answeredChoice}
        correctIndex={correctIndex}
        pending={answer.isPending}
        isLast={index === list.length - 1}
        onConfirm={(choiceIndex) =>
          answer.mutate(
            { questionId: question.id, choiceIndex },
            {
              onSuccess: (g) => {
                setGrade({ questionId: question.id, correctIndex: g.correct_index });
                // Pin the index: without this, the refetch advances the page before the member reads their grade.
                setCursor(index);
              },
              onError: toastError,
            },
          )
        }
        onNext={() => {
          setGrade(null);
          setCursor(index + 1);
        }}
      />
    </Stack>
  );
}
