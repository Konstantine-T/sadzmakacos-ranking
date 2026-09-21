import { supabase } from '@/lib/supabase';

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

  const registration = await navigator.serviceWorker.ready;

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

/** Unsubscribe this device and forget it server-side. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

/** Is THIS device subscribed? Another phone being subscribed says nothing. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) !== null;
}
