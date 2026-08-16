import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CurrentMember {
  id: string;
  nickname: string;
  bio: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isActive: boolean;
}

export type AuthStatus =
  | 'loading' // still resolving the session or the member row
  | 'signedOut' // no Google session
  | 'pending' // signed in, but the admin hasn't linked an account yet
  | 'inactive' // linked to a member the admin has deactivated
  | 'active'; // a full player

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  member: CurrentMember | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  session: null,
  member: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/** Convenience for the many components that only render for a real player. */
export function useMember(): CurrentMember {
  const { member } = useAuth();
  if (!member) throw new Error('useMember() used outside an authenticated route');
  return member;
}

export const meQueryKey = ['me'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
      queryClient.invalidateQueries({ queryKey: meQueryKey });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: meQueryKey,
    enabled: sessionReady && session !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<{ member: CurrentMember | null; pending: boolean }> => {
      const { data, error } = await supabase.rpc('me');
      if (error) throw error;
      const row = data?.[0];
      if (!row || row.pending || !row.member_id) return { member: null, pending: true };
      return {
        pending: false,
        member: {
          id: row.member_id,
          nickname: row.nickname ?? '',
          bio: row.bio,
          avatarUrl: row.avatar_url,
          isAdmin: row.is_admin,
          isActive: row.is_active,
        },
      };
    },
    // While waiting for the admin to link the account, poll — so the pending
    // screen turns into the app on its own (auth.pendingHint).
    refetchInterval: (query) => (query.state.data?.pending ? 15_000 : false),
  });

  const status: AuthStatus = useMemo(() => {
    if (!sessionReady) return 'loading';
    if (!session) return 'signedOut';
    if (meQuery.isPending || (meQuery.isFetching && !meQuery.data)) return 'loading';
    if (meQuery.isError) return 'loading';
    if (!meQuery.data || meQuery.data.pending) return 'pending';
    if (!meQuery.data.member?.isActive) return 'inactive';
    return 'active';
  }, [sessionReady, session, meQuery.isPending, meQuery.isFetching, meQuery.isError, meQuery.data]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      member: meQuery.data?.member ?? null,
      signIn: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [status, session, meQuery.data, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
