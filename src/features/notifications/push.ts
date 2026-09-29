import { supabase } from '@/lib/supabase';
import { pushSyncAction, type PushIntent } from './pushSync';

/**
 * Subscribing a device to push.
 *
 * Three things have to be true before a notification can ever arrive, and they
 * fail in different ways, so they are checked separately rather than collapsed
 * into one "supported" boolean:
 *
 *   * the browser has PushManager at all;
 *   * the app is installed — on iOS that is the whole ballgame, since Safari
 *     exposes no push in a normal tab;
 *   * the member granted permission, which can only be asked once.
 */

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission(): NotificationPermission {
  return pushSupported() ? Notification.permission : 'denied';
}

/**
 * The VAPID key travels as base64url; PushManager wants raw bytes.
 *
 * Typed as ArrayBuffer rather than Uint8Array because TypeScript 5.7 made
 * typed arrays generic over their buffer, and `applicationServerKey` wants a
 * BufferSource backed by a real ArrayBuffer.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/**
 * What the member last chose on this device, kept so that a subscription the
 * browser drops can be put back without overriding one they turned off
 * (see pushSync.ts). localStorage can throw or come back empty; either reads
 * as "never chose", which never subscribes anyone.
 */
const INTENT_KEY = 'push-intent';

function readIntent(): PushIntent {
  try {
    const value = localStorage.getItem(INTENT_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

function writeIntent(intent: 'on' | 'off') {
  try {
    localStorage.setItem(INTENT_KEY, intent);
  } catch {
    // Nothing to do: the next launch just cannot heal this device.
  }
}

/** Subscribe (or reuse the subscription) and record the device server-side. */
async function subscribeAndSave(registration: ServiceWorkerRegistration): Promise<boolean> {
  if (!VAPID_PUBLIC) return false;

  // An existing subscription is reused: re-subscribing would issue a new
  // endpoint and leave the old row behind, so the member would get every
  // message twice.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC),
    }));

  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw error;
  return true;
}

/**
 * Ask for permission, subscribe, and record the device.
 *
 * Must be called from a real user gesture — Safari ignores a permission request
 * that did not come from a tap, silently, which looks exactly like a bug.
 *
 * @returns true when the device is now subscribed.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported() || !VAPID_PUBLIC) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const subscribed = await subscribeAndSave(await navigator.serviceWorker.ready);
  if (subscribed) writeIntent('on');
  return subscribed;
}

/** Unsubscribe this device and forget it server-side. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  // First, so that a failure below can never be "healed" back on next launch.
  writeIntent('off');

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

let syncing: Promise<void> | null = null;

/**
 * Put this device's push back the way the member left it. Called once per
 * launch by the shell, for an active member only (the RPC needs one).
 *
 * Never throws and never prompts: at worst it does nothing, and the profile
 * card offers the button exactly as before.
 */
export function syncPush(): Promise<void> {
  syncing ??= (async () => {
    if (!pushSupported()) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscribed = (await registration.pushManager.getSubscription()) !== null;
      const action = pushSyncAction({
        permission: Notification.permission,
        subscribed,
        intent: readIntent(),
      });
      if (action === 'none') return;

      // Also stamps intent on devices subscribed before it was recorded, so
      // they are protected from the next drop too.
      if (await subscribeAndSave(registration)) writeIntent('on');
    } catch {
      // Some browsers refuse subscribe() outside a gesture. The card still works.
    }
  })();
  return syncing;
}

/** Is THIS device subscribed? Another phone being subscribed says nothing. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  // Let the heal finish first, or the card reads "off" for a device that is
  // about to be back on. Started here too, not just awaited: on a cold load of
  // /me the card's effect runs before the shell's.
  await syncPush();
  if (Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) !== null;
}
