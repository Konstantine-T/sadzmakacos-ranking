import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Member, TrueFalseScore } from '@/lib/database.types';
import { CATEGORIES, isCategory, type Category } from './categories';

/**
 * The true/false game's data layer.
 *
 * Postgres holds one row per member per category with their best streak —
 * eleven boards in one table. The questions never touch Supabase; see
 * `source.ts`.
 *
 * Deliberately NOT wired into `triviaKeys`: every game owns its own board, and
 * nothing but უნარების ტესტები feeds ტრივიას რანკი.
 */

export const truefalseKeys = {
  boards: ['truefalse', 'boards'] as const,
};

export interface TrueFalseRow {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  best_streak: number;
  plays: number;
  rank: number;
}

export type TrueFalseBoards = Record<Category, TrueFalseRow[]>;

const collator = new Intl.Collator('ka');

/**
 * Competition ranking on `best_streak` — equal streaks share a rank and the
 * next rank skips, 1, 2, 2, 2, 5, as everywhere else in this app.
 *
 * `plays` breaks a tie ascending: the same streak reached in fewer attempts
 * sits on top. Neither it nor the nickname can move the rank number.
 */
function rank(rows: Omit<TrueFalseRow, 'rank'>[]): TrueFalseRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.best_streak - a.best_streak ||
      a.plays - b.plays ||
      collator.compare(a.nickname, b.nickname),
  );

  let current = 0;
  let prev = Number.NaN;
  return sorted.map((row, index) => {
    if (row.best_streak !== prev) {
      current = index + 1; // the skip: index, not a running counter
      prev = row.best_streak;
    }
    return { ...row, rank: current };
  });
}

/** Every category's board, ranked. One fetch serves all eleven. */
export function useTrueFalseBoards() {
  const query = useQuery({
    queryKey: truefalseKeys.boards,
    staleTime: 30_000,
    queryFn: async (): Promise<{ scores: TrueFalseScore[]; members: Member[] }> => {
      const [{ data: scores, error: e1 }, { data: members, error: e2 }] = await Promise.all([
        supabase.from('truefalse_scores').select('*'),
        supabase.from('members').select('*').eq('is_active', true),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { scores: scores ?? [], members: members ?? [] };
    },
  });

  const boards = useMemo<TrueFalseBoards>(() => {
    const members = new Map((query.data?.members ?? []).map((m) => [m.id, m]));
    const grouped = Object.fromEntries(
      CATEGORIES.map((c) => [c, [] as Omit<TrueFalseRow, 'rank'>[]]),
    ) as Record<Category, Omit<TrueFalseRow, 'rank'>[]>;

    for (const s of query.data?.scores ?? []) {
      const m = members.get(s.member_id);
      if (!m || s.plays === 0 || !isCategory(s.category)) continue;
      grouped[s.category].push({
        member_id: s.member_id,
        nickname: m.nickname,
        avatar_url: m.avatar_url,
        best_streak: s.best_streak,
        plays: s.plays,
      });
    }

    return Object.fromEntries(
      CATEGORIES.map((c) => [c, rank(grouped[c])]),
    ) as TrueFalseBoards;
  }, [query.data]);

  return { boards, isPending: query.isPending };
}

/**
 * Record a finished run.
 *
 * The server keeps the higher of the two streaks, so submitting a worse run is
 * harmless — it still counts as a play, which is what lets the board tiebreak
 * on persistence.
 */
export function useSubmitTrueFalseScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      category,
      streak,
    }: {
      category: Category;
      streak: number;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('submit_truefalse_score', {
        p_category: category,
        p_streak: streak,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: truefalseKeys.boards });
    },
  });
}
