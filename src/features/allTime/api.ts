import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AllTimeStanding } from '@/lib/database.types';

export const allTimeKeys = { standings: ['allTime'] as const };

/**
 * Both columns are shown, both sortable (§1.7): total net rewards longevity,
 * average net per week is fairer to members who joined later.
 */
export function useAllTimeStandings() {
  return useQuery({
    queryKey: allTimeKeys.standings,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AllTimeStanding[]> => {
      const { data, error } = await supabase
        .from('all_time_standings')
        .select('*')
        .order('total_net', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
