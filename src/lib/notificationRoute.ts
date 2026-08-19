import type { Notification } from './database.types';

/** Everything the mapping needs — deliberately narrow, so it stays testable. */
export type Routable = Pick<Notification, 'kind' | 'post_id'>;

/**
 * Where tapping a notification takes you.
 *
 * A pure function rather than a switch inside a click handler, so the mapping
 * can be read and tested in one place. Deliberately routes to the TAB, not to
 * the individual post: with one post per member per week the list is short
 * enough that finding it costs nothing, and deep-linking would need post
 * anchors, scroll-into-view and a highlight state for very little.
 *
 * `post_id` is what separates the two kinds of reaction — one on your post,
 * one on you — which is why this takes the row and not just the kind.
 */
export function notificationRoute(row: Routable): string {
  switch (row.kind) {
    case 'post':
    case 'post_vote':
      return '/posts';
    case 'rank':
      return '/';
    case 'reaction':
      return row.post_id === null ? '/me' : '/posts';
  }
}
