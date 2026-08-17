# საძმაკაცოს რანკი — working rules

A weekly ranking app for one closed group of ~20 lifelong friends.
Full spec: [sadzmakatsos-ranki-plan.md](sadzmakatsos-ranki-plan.md).

## The seven rules (do not violate these)

1. **Individual votes are secret from users, visible to admin.** No client query
   may ever resolve *who* voted for whom. Enforced in Postgres (RLS +
   aggregate-only views), never in the frontend. Getting this wrong breaks the
   whole social contract of the app. Same contract applies to reactions.
2. **Live totals are public all week.** Up count, down count and net are visible
   to every member in real time. Only voter identity is hidden.
3. **Past weeks are immutable snapshots.** Closed weeks are read from
   `weekly_results`, never recomputed from `votes`.
4. **All user-facing strings are Georgian**, and they all live in
   `src/i18n/ka.ts`. No hardcoded strings in components. Code, comments, table
   names and variable names stay English.
5. **Mobile is the primary target.** Design and test at 390×844 first, then
   scale up. Every tap target ≥ 44px.
6. **No email sending, no email verification.** Google OAuth only.
7. **Timezone is `Asia/Tbilisi`** (UTC+4, no DST). Store everything as
   `timestamptz`, render in Tbilisi time.

## Architecture facts worth knowing before editing

- **The anonymity boundary is `supabase/migrations/*_views.sql`.** Those views
  are owned by `postgres`, run with `security_invoker = off`, and are the only
  path by which vote counts reach a client. A table owner is exempt from that
  table's RLS, which is what lets a view read all of `votes` while its caller
  cannot. Never add an identity column to one of these views.
- **`votes` is deliberately not in the realtime publication.** Publishing it
  would stream the WAL to every subscriber and undo the RLS in one line. The
  identity-free `vote_events` / `score_events` tables exist for that reason:
  clients subscribe to those and refetch aggregates.
- **Every admin write goes through a `security definer` RPC**, never an RLS
  policy, so that no privileged change can skip its `audit_log` row. There is
  no admin INSERT/UPDATE/DELETE policy anywhere on purpose.
- **Column-level GRANTs, not RLS, keep members out of `is_admin`.** RLS cannot
  say "you may edit your nickname but not your admin flag"; grants can.
- **Ranking is competition ranking on `(net, total_votes)`** — ties share a rank
  and the next rank skips (1, 1, 3, 4). `nickname` breaks display order only,
  never the rank number. The live board computes this client-side in
  `src/lib/ranking.ts` using the same rules as `close_current_week()`; if you
  change one, change both.
- **`cast_vote` resolves the open week server-side.** Never send a client
  `week_id` for a write.

## Commands

```
npm run dev         # vite, localhost:5173
npm run build       # tsc -b && vite build
npm run lint        # typecheck only
```

Database changes go in a new `supabase/migrations/*.sql` file — never edit an
applied one. See [SETUP.md](SETUP.md) for how to apply them.

## Non-goals (do not build)

Email or push notifications · categories or multiple ranking dimensions ·
images in posts · multiple friend groups · multiple admins · vote reasons ·
seasons/resets · **comments of any kind** (the feature was dropped in
`20260817000100_drop_comments.sql` — posts carry the conversation) · editing or
deleting your own post · public sharing outside the group.
