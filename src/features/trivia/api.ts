import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { rankTrivia } from '@/lib/triviaRanking';
import type {
  TriviaAnswer,
  TriviaGrade,
  TriviaQuestion,
  TriviaResult,
  TriviaTotal,
  TriviaWeekScore,
} from '@/lib/database.types';

/**
 * Trivia's data layer.
 *
 * Two things here are load-bearing:
 *
 *  1. `correct_index` is never selected, because the column is not granted.
 *     `select('*')` on trivia_questions would fail outright — that is the
 *     point. Every read names its columns.
 *  2. "My answers" carries an explicit `.eq('member_id', …)` filter even though
 *     RLS already restricts the table. Never let RLS alone define "my rows":
 *     the same mistake on `votes` once showed the admin somebody else's ballot
 *     as their own.
 */

export const triviaKeys = {
  questions: (weekId: number | undefined) => ['trivia', 'questions', weekId] as const,
  myAnswers: (weekId: number | undefined) => ['trivia', 'myAnswers', weekId] as const,
  weekBoard: (weekId: number | undefined) => ['trivia', 'board', weekId] as const,
  allTime: ['trivia', 'allTime'] as const,
  myStats: (memberId: string | undefined) => ['trivia', 'stats', memberId] as const,
};

export const QUESTIONS_PER_WEEK = 10;

/** The columns a client is allowed to see. correct_index is NOT one of them. */
const QUESTION_COLUMNS = 'id, week_id, position, section, prompt, options';

export interface TriviaBoardRow {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  correct: number;
  answered: number;
  rank: number;
}

/** This week's ten, in their fixed order. */
export function useWeekQuestions(weekId: number | undefined) {
  return useQuery({
    queryKey: triviaKeys.questions(weekId),
    enabled: weekId !== undefined,
    staleTime: 5 * 60_000, // a week's questions never change once claimed
    queryFn: async (): Promise<TriviaQuestion[]> => {
      const { data, error } = await supabase
        .from('trivia_questions')
        .select(QUESTION_COLUMNS)
        .eq('week_id', weekId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TriviaQuestion[];
    },
  });
}

/** My answers for this week — explicitly filtered, not merely RLS-filtered. */
export function useMyAnswers(weekId: number | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: triviaKeys.myAnswers(weekId),
    enabled: weekId !== undefined && memberId !== undefined,
    staleTime: 30_000,
    queryFn: async (): Promise<TriviaAnswer[]> => {
      const { data, error } = await supabase
        .from('trivia_answers')
        .select('*')
        .eq('week_id', weekId!)
        .eq('member_id', memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Commit one answer and learn whether it was right.
 *
 * The grade comes back from the server, after the write. There is no client
 * copy of the key to compare against, and there cannot be.
 */
export function useAnswerTrivia(weekId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { questionId: string; choiceIndex: number }): Promise<TriviaGrade> => {
      const { data, error } = await supabase.rpc('answer_trivia', {
        p_question_id: vars.questionId,
        p_choice_index: vars.choiceIndex,
      });
      if (error) throw error;
      // The RPC returns a one-row table.
      const row = Array.isArray(data) ? data[0] : data;
      return row as TriviaGrade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: triviaKeys.myAnswers(weekId) });
      queryClient.invalidateQueries({ queryKey: triviaKeys.weekBoard(weekId) });
      queryClient.invalidateQueries({ queryKey: triviaKeys.allTime });
    },
  });
}

/** This week's board, live. */
export function useTriviaWeekBoard(weekId: number | undefined) {
  const query = useQuery({
    queryKey: triviaKeys.weekBoard(weekId),
    enabled: weekId !== undefined,
    staleTime: 30_000,
    queryFn: async (): Promise<TriviaWeekScore[]> => {
      const { data, error } = await supabase
        .from('trivia_week_scores')
        .select('*')
        .eq('week_id', weekId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo<TriviaBoardRow[]>(
    () =>
      rankTrivia(query.data ?? []).map((r) => ({
        member_id: r.member_id,
        nickname: r.nickname,
        avatar_url: r.avatar_url,
        correct: r.correct,
        answered: r.answered,
        rank: r.rank,
      })),
    [query.data],
  );

  return { rows, isPending: query.isPending };
}

/** Every week ever, summed. This is what the home card shows. */
export function useTriviaAllTimeBoard() {
  const query = useQuery({
    queryKey: triviaKeys.allTime,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TriviaTotal[]> => {
      const { data, error } = await supabase.from('trivia_totals').select('*');
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo<TriviaBoardRow[]>(() => {
    const played = (query.data ?? []).filter((t) => t.total_answered > 0);
    return rankTrivia(
      played.map((t) => ({
        member_id: t.member_id,
        nickname: t.nickname,
        avatar_url: t.avatar_url,
        correct: t.total_correct,
        answered: t.total_answered,
      })),
    ).map((r) => ({
      member_id: r.member_id,
      nickname: r.nickname,
      avatar_url: r.avatar_url,
      correct: r.correct,
      answered: r.answered,
      rank: r.rank,
    }));
  }, [query.data]);

  return { rows, isPending: query.isPending, played: rows.length > 0 };
}

export interface TriviaStats {
  totalCorrect: number;
  testsTaken: number;
  bestWeek: number;
  rank: number | null;
}

/** The numbers a profile shows. */
export function useMyTriviaStats(memberId: string | undefined) {
  const allTime = useTriviaAllTimeBoard();

  const results = useQuery({
    queryKey: triviaKeys.myStats(memberId),
    enabled: memberId !== undefined,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TriviaResult[]> => {
      const { data, error } = await supabase
        .from('trivia_results')
        .select('*')
        .eq('member_id', memberId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo<TriviaStats | null>(() => {
    const mine = allTime.rows.find((r) => r.member_id === memberId);
    if (!mine) return null;
    const best = (results.data ?? []).reduce((max, r) => Math.max(max, r.correct), 0);
    return {
      totalCorrect: mine.correct,
      testsTaken: results.data?.length ?? 0,
      bestWeek: best,
      rank: mine.rank,
    };
  }, [allTime.rows, results.data, memberId]);

  return { stats, isPending: allTime.isPending || results.isPending };
}
