import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Poll, PollAnswer, PollOption } from '@/lib/database.types';

/**
 * Polls are the one place in this app where a vote is SIGNED.
 *
 * Every other tally — ranking votes, reactions — reaches the client through an
 * aggregate-only view precisely so that identity cannot be resolved. Here there
 * is no view and no secret: the client reads `poll_answers` whole and counts it.
 * Twenty members means the whole table is a few hundred rows at worst, which is
 * cheaper than the view would be.
 *
 * If you ever make polls anonymous, this file is wrong end to end — you would
 * need the `security_invoker = off` view treatment from migration 03.
 */

export const pollKeys = {
  active: ['polls', 'active'] as const,
  answers: (pollId: string | undefined) => ['polls', 'answers', pollId] as const,
};

export interface PollOptionWithVoters extends PollOption {
  /** Member ids that picked this option, in no particular order. */
  voterIds: string[];
  count: number;
  /** Did *you* pick it. */
  mine: boolean;
}

export interface ActivePoll extends Poll {
  options: PollOptionWithVoters[];
  /** Distinct members who answered at all. */
  answeredBy: number;
  /** The most-picked option's count — the scale every bar is drawn against. */
  max: number;
  /** True once you have picked anything. */
  answered: boolean;
}

/**
 * Every poll a member is allowed to see, newest first, with its options and
 * answers already stitched together.
 *
 * RLS hides inactive polls, so this returns exactly what should render. The
 * three reads are separate because Supabase's nested selects would need FK
 * hints for two hops, and three flat queries over tables this small is both
 * faster to reason about and faster to run.
 */
export function useActivePolls(myId: string | undefined) {
  const query = useQuery({
    queryKey: pollKeys.active,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });
      if (pollsError) throw pollsError;
      if (!polls || polls.length === 0) {
        return { polls: [] as Poll[], options: [] as PollOption[], answers: [] as PollAnswer[] };
      }

      const [{ data: options, error: optionsError }, { data: answers, error: answersError }] =
        await Promise.all([
          supabase.from('poll_options').select('*').order('position', { ascending: true }),
          supabase.from('poll_answers').select('*'),
        ]);
      if (optionsError) throw optionsError;
      if (answersError) throw answersError;

      return { polls, options: options ?? [], answers: answers ?? [] };
    },
  });

  const polls = useMemo<ActivePoll[]>(() => {
    const data = query.data;
    if (!data) return [];

    const byOption = new Map<string, string[]>();
    const answeredMembers = new Map<string, Set<string>>();

    for (const answer of data.answers) {
      const voters = byOption.get(answer.option_id) ?? [];
      voters.push(answer.member_id);
      byOption.set(answer.option_id, voters);

      const members = answeredMembers.get(answer.poll_id) ?? new Set<string>();
      members.add(answer.member_id);
      answeredMembers.set(answer.poll_id, members);
    }

    return data.polls.map((poll) => {
      const options = data.options
        .filter((option) => option.poll_id === poll.id)
        .map((option) => {
          const voterIds = byOption.get(option.id) ?? [];
          return {
            ...option,
            voterIds,
            count: voterIds.length,
            mine: myId !== undefined && voterIds.includes(myId),
          };
        });

      return {
        ...poll,
        options,
        answeredBy: answeredMembers.get(poll.id)?.size ?? 0,
        max: options.reduce((max, option) => Math.max(max, option.count), 0),
        answered: options.some((option) => option.mine),
      };
    });
  }, [query.data, myId]);

  return { polls, isPending: query.isPending };
}

/**
 * Answering (§ polls migration): optimistic, because a tap on a poll option
 * should land as instantly as a tap on a vote arrow.
 *
 * `optionIds` is your COMPLETE answer for that poll — the RPC replaces the set
 * rather than toggling one row, so single-vs-multi is decided server-side and
 * an empty array clears your answer.
 */
export function useAnswerPoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, optionIds }: { pollId: string; optionIds: string[] }) => {
      const { error } = await supabase.rpc('answer_poll', {
        p_poll_id: pollId,
        p_option_ids: optionIds,
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pollKeys.active });
    },
  });
}
