import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Member, SnakeScore } from '@/lib/database.types';

/**
 * სნეიკი's data layer.
 *
 * Nothing here is secret. Unlike votes and trivia answers, a snake score judges
 * nobody, so `snake_scores` is read whole and published to realtime whole —
 * there is no aggregate view standing between the table and the client, for the
 * same reason polls have none.
 *
 * Deliberately NOT wired into `triviaKeys` or any trivia board: snake measures
 * thumbs, trivia measures knowledge, and mixing them would make the trivia rank
 * meaningless. The two features share a tab and nothing else.
 */

export const snakeKeys = {
  board: ['snake', 'board'] as const,
};

export interface SnakeRow {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  best_score: number;
  plays: number;
  rank: number;
}

const collator = new Intl.Collator('ka');

/**
 * Competition ranking on `best_score` — the same shape as the trivia board and
 * the vote board: equal scores share a rank and the next rank skips past them,
 * 1, 2, 2, 2, 5.
 *
 * `plays` breaks a tie ascending, so the same high score reached in fewer
 * attempts sits on top — the snake equivalent of the cleanest sheet. Neither it
 * nor the nickname can move the rank number.
 *
 * Kept local rather than shared with src/lib/triviaRanking.ts: that module's
 * header is explicit that its rule must not be merged with another, and this is
 * a different quantity with one call site.
 */
function rankSnake(rows: Omit<SnakeRow, 'rank'>[]): SnakeRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.best_score - a.best_score ||
      a.plays - b.plays ||
      collator.compare(a.nickname, b.nickname),
  );

  let rank = 0;
  let prev = Number.NaN;
  return sorted.map((row, index) => {
    if (row.best_score !== prev) {
      rank = index + 1; // the skip: index, not a running counter
      prev = row.best_score;
    }
    return { ...row, rank };
  });
}

/** Everyone who has ever finished a game, best first. */
export function useSnakeBoard() {
  const query = useQuery({
    queryKey: snakeKeys.board,
    staleTime: 30_000,
    queryFn: async (): Promise<{ scores: SnakeScore[]; members: Member[] }> => {
      const [{ data: scores, error: e1 }, { data: members, error: e2 }] = await Promise.all([
        supabase.from('snake_scores').select('*'),
        supabase.from('members').select('*').eq('is_active', true),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { scores: scores ?? [], members: members ?? [] };
    },
  });

  const rows = useMemo<SnakeRow[]>(() => {
    const members = new Map((query.data?.members ?? []).map((m) => [m.id, m]));
    const played = (query.data?.scores ?? []).filter((s) => s.plays > 0 && members.has(s.member_id));
    return rankSnake(
      played.map((s) => {
        const m = members.get(s.member_id)!;
        return {
          member_id: s.member_id,
          nickname: m.nickname,
          avatar_url: m.avatar_url,
          best_score: s.best_score,
          plays: s.plays,
        };
      }),
    );
  }, [query.data]);

  // `members` rides along because the game needs every active member's avatar
  // for its food, and the board has already paid for that query.
  return {
    rows,
    members: query.data?.members ?? [],
    isPending: query.isPending,
    played: rows.length > 0,
  };
}

/**
 * Record a finished game.
 *
 * The server keeps the higher of the two scores, so submitting a worse run is
 * harmless — it still counts as a play, which is what lets the board tiebreak
 * on persistence. Returns the member's best score afterwards.
 */
export function useSubmitSnakeScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (score: number): Promise<number> => {
      const { data, error } = await supabase.rpc('submit_snake_score', { p_score: score });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snakeKeys.board });
    },
  });
}
