/**
 * What to do about push on this device when the app starts.
 *
 * The browser owns the subscription and can drop it without asking: iOS
 * revokes one after a few silent pushes, a push service can expire or rotate
 * its keys, and the push function deletes a server row the moment the service
 * answers 410. The member only ever sees the result — the profile card saying
 * "off" when they turned it on — so every launch puts things back.
 *
 * Pure, and kept apart from push.ts, so the decision can be tested without a
 * browser or a Supabase client.
 *
 * `intent` is what the member last chose ON THIS DEVICE, or null if they never
 * chose (or chose before intent was recorded). Null never subscribes anyone:
 * with permission granted and no subscription, "the browser dropped it" and
 * "they turned it off" look identical, and only one of them may be undone.
 */

export type PushIntent = 'on' | 'off' | null;
export type PushSyncAction = 'none' | 'save' | 'resubscribe';

export function pushSyncAction({
  permission,
  subscribed,
  intent,
}: {
  permission: NotificationPermission;
  subscribed: boolean;
  intent: PushIntent;
}): PushSyncAction {
  if (permission !== 'granted') return 'none';
  // Re-saving is an upsert: it restores a pruned row, and hands the endpoint
  // to whoever is signed in now.
  if (subscribed) return 'save';
  return intent === 'on' ? 'resubscribe' : 'none';
}
