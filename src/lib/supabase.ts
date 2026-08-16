import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Checked by App so a missing .env produces a readable setup screen rather
 * than a white page — throwing here would happen at import time, before any
 * error boundary exists.
 */
export const isConfigured = Boolean(url && anonKey);

/**
 * The one and only client. The anon key is all the frontend ever gets — the
 * service-role key is never used here, and every privileged operation goes
 * through RLS or a security-definer RPC instead.
 */
export const supabase = createClient<Database>(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export const AVATAR_BUCKET = 'avatars';

/** Public URL for a stored avatar path, or null when there is no avatar. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}
