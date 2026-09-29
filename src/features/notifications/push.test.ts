/**
 * Run with:
 *   npm run test:unit
 *
 * THE BUG. Members turned notifications on, and some time later found the
 * profile card saying they were off again. Nothing in the app had turned them
 * off: the iPhone had. WebKit counts every push that does not end in
 * showNotification() as a "silent push", and after three of them — ever; the
 * count never resets — it revokes every subscription the origin has. Our
 * worker dropped a chat push whenever the app was focused, so three chat
 * messages that arrived while someone was already looking at the app cost them
 * push for good.
 *
 * The worker is plain JS in public/, so it is loaded here as source text into a
 * fake worker global rather than imported.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pushSyncAction } from './pushSync';

interface Shown {
  title: string;
  tag: string | undefined;
  closed: boolean;
}

type Listener = (event: unknown) => void;

function loadWorker(windows: { focused: boolean }[] = []) {
  const listeners: Record<string, Listener> = {};
  const shade: Shown[] = [];

  const self = {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async () => {},
    },
    registration: {
      showNotification: async (title: string, options: { tag?: string } = {}) => {
        shade.push({ title, tag: options.tag, closed: false });
      },
      getNotifications: async ({ tag }: { tag?: string } = {}) =>
        shade
          .filter((n) => !n.closed && (tag === undefined || n.tag === tag))
          .map((n) => ({ close: () => (n.closed = true) })),
    },
  };

  new Function('self', readFileSync('public/sw.js', 'utf8'))(self);

  /** Deliver a push and wait for whatever the worker handed to waitUntil. */
  async function push(data: string | null) {
    let pending: Promise<unknown> = Promise.resolve();
    listeners.push({
      data: data === null ? null : { json: () => JSON.parse(data), text: () => data },
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
  }

  return { push, shade };
}

const payload = (kind: string) =>
  JSON.stringify({ kind, title: `${kind} title`, body: 'body', url: '/' });

test('a chat push while the app is focused still calls showNotification', async () => {
  const { push, shade } = loadWorker([{ focused: true }]);
  await push(payload('chat'));

  // The regression itself: something must have been shown, or WebKit counts it.
  assert.equal(shade.length, 1);
  // …but the member looking at the chat does not keep it in the shade.
  assert.ok(shade.every((n) => n.closed));
  assert.ok(shade.every((n) => n.tag !== 'chat'), 'must not reuse the real chat tag');
});

test('closing the quiet one leaves a real chat notification alone', async () => {
  const { push, shade } = loadWorker([{ focused: false }]);
  await push(payload('chat')); // arrives in the shade while away

  const focused = loadWorker([{ focused: true }]);
  focused.shade.push(...shade);
  await focused.push(payload('chat'));

  const real = focused.shade.find((n) => n.tag === 'chat');
  assert.ok(real && !real.closed);
});

test('a chat push with the app in the background is shown normally', async () => {
  const { push, shade } = loadWorker([{ focused: false }]);
  await push(payload('chat'));
  assert.deepEqual(shade, [{ title: 'chat title', tag: 'chat', closed: false }]);
});

test('a rank push is shown even with the app focused', async () => {
  const { push, shade } = loadWorker([{ focused: true }]);
  await push(payload('rank'));
  assert.deepEqual(shade, [{ title: 'rank title', tag: 'rank', closed: false }]);
});

test('a push with no payload still calls showNotification', async () => {
  const { push, shade } = loadWorker();
  await push(null);
  assert.equal(shade.length, 1);
});

test('a push with an unreadable payload still calls showNotification', async () => {
  const { push, shade } = loadWorker();
  await push('not json');
  assert.equal(shade.length, 1);
});

/* ------------------------------------------------------------- app start --- */

test('a device that asked for push and lost its subscription gets it back', () => {
  // The other half of "never again": whatever the browser drops, the next
  // launch puts back — but only for a device whose member turned it on.
  assert.equal(
    pushSyncAction({ permission: 'granted', subscribed: false, intent: 'on' }),
    'resubscribe',
  );
});

test('a device the member turned off stays off', () => {
  assert.equal(pushSyncAction({ permission: 'granted', subscribed: false, intent: 'off' }), 'none');
});

test('a device nobody ever turned on is never subscribed behind its back', () => {
  assert.equal(pushSyncAction({ permission: 'granted', subscribed: false, intent: null }), 'none');
});

test('a live subscription is re-saved, whatever the stored intent says', () => {
  // Re-saving restores a server row the push function pruned, and moves the
  // endpoint to whoever is signed in now.
  for (const intent of ['on', 'off', null] as const) {
    assert.equal(pushSyncAction({ permission: 'granted', subscribed: true, intent }), 'save');
  }
});

test('without permission there is nothing to do', () => {
  for (const permission of ['default', 'denied'] as const) {
    assert.equal(pushSyncAction({ permission, subscribed: false, intent: 'on' }), 'none');
    assert.equal(pushSyncAction({ permission, subscribed: true, intent: 'on' }), 'none');
  }
});
