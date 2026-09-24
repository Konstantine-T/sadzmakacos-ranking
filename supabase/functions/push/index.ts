/**
 * Drain one push_outbox row to every device that should hear about it.
 *
 * Invoked by a Supabase Database Webhook on insert into `public.push_outbox`.
 * Nothing else calls it, and it is not meant to be reachable from the app.
 *
 * WHY A FUNCTION AND NOT A POSTGRES TRIGGER DOING THE HTTP. Web Push is not a
 * plain POST: each message is encrypted per subscription (AES128GCM) and signed
 * with a VAPID JWT. That is not something SQL can do, so something has to run
 * real code — and this is the smallest thing that can.
 *
 * SECRETS (Supabase → Edge Functions → push → Secrets):
 *   VAPID_PUBLIC_KEY    the same value the frontend builds with
 *   VAPID_PRIVATE_KEY   never leaves here
 *   VAPID_SUBJECT       a mailto: or https: URL identifying the sender
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 */

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface OutboxRow {
  id: number;
  recipient_id: string | null;
  exclude_id: string | null;
  kind: string;
  title: string;
  body: string;
  url: string;
}

// `||` rather than `??`: a secret saved with an empty value is "set" to the
// runtime and must still fall through, or the function dies on boot with a
// web-push error that names the symptom and not the cause.
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'https://www.rankbros.ge';

/**
 * Configured lazily, inside the request, rather than at module load.
 *
 * At module load a bad secret crashes the isolate before any request handler
 * runs, and the only trace is web-push's own stack — "No key set" — which says
 * nothing about WHICH secret, or whether the runtime can see any of them at
 * all. Checked here, a missing secret becomes a 500 whose body names it, and
 * lists every VAPID_* variable the runtime actually has, so "I saved it" and
 * "the function received it" can be told apart.
 */
function missingSecrets(): string[] {
  const missing: string[] = [];
  if (!VAPID_PUBLIC) missing.push('VAPID_PUBLIC_KEY');
  if (!VAPID_PRIVATE) missing.push('VAPID_PRIVATE_KEY');
  return missing;
}

// Service role: this reads other members' subscriptions, which RLS rightly
// forbids to everyone else.
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const missing = missingSecrets();
  if (missing.length > 0) {
    const seen = Object.keys(Deno.env.toObject()).filter((k) => k.startsWith('VAPID'));
    const msg = `missing secrets: ${missing.join(', ')}. VAPID_* visible to this function: ` +
      (seen.length ? seen.join(', ') : 'NONE');
    console.error(msg);
    return new Response(msg, { status: 500 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let row: OutboxRow;
  try {
    const payload = await req.json();
    row = payload.record ?? payload; // webhook shape, or a direct call while testing
  } catch {
    return new Response('bad payload', { status: 400 });
  }
  if (!row?.id) return new Response('no row', { status: 400 });

  // Who hears about it: one member, or everyone except whoever caused it.
  let query = db.from('push_subscriptions').select('endpoint, p256dh, auth, member_id');
  if (row.recipient_id) query = query.eq('member_id', row.recipient_id);
  if (row.exclude_id) query = query.neq('member_id', row.exclude_id);

  const { data: subs, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({
    title: row.title,
    body: row.body,
    url: row.url,
    kind: row.kind,
  });

  // A stale subscription is the normal case, not an error: browsers retire them
  // when the app is uninstalled or storage is cleared, and the push service
  // answers 404 or 410 forever after. Delete those rather than retrying them
  // every message until the end of time.
  const dead: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 12 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.error('push failed', s.endpoint.slice(-12), status);
      }
    }),
  );

  if (dead.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', dead);
  }

  await db.from('push_outbox').update({ sent_at: new Date().toISOString() }).eq('id', row.id);

  return new Response(
    JSON.stringify({ sent: (subs?.length ?? 0) - dead.length, pruned: dead.length }),
    { headers: { 'content-type': 'application/json' } },
  );
});
