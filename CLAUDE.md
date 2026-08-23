# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# საძმაკაცოს რანკი — working rules

A weekly ranking app for one closed group of ~20 lifelong friends. React 18 +
Vite + MUI v6 in `src/`, Supabase (Postgres, RLS, realtime, Google OAuth) in
`supabase/`, deployed to Vercel. Product spec:
[sadzmakatsos-ranki-plan.md](sadzmakatsos-ranki-plan.md) — its `§n` numbers are
cited throughout the code. Everything you do by hand in a dashboard is in
[SETUP.md](SETUP.md).

## The seven rules (do not violate these)

1. **Individual votes are secret from everyone, the admin included.** No query
   by any account may resolve *who* voted for whom. Enforced in Postgres (RLS +
   aggregate-only views), never in the frontend. Getting this wrong breaks the
   whole social contract of the app. Reactions follow the same contract, except
   that reaction identity is still admin-readable.
   A consequence, once the rule holds end to end: a single vote cannot be
   moderated, because nothing can identify one. An admin corrects a whole
   closed week through `admin_update_result()`, which works on aggregate counts
   and never sees identity.

   > **⚠ The migration set does not currently match this rule.** Settle this
   > before touching anything vote-shaped.
   > `20260818000200_votes_anonymous_to_admin.sql` closed the three doors — the
   > `or public.is_admin()` clause on `votes_select_own`, `admin_vote_matrix()`,
   > and `admin_void_vote()` (an oracle: void a guessed ballot, watch the net
   > move). It was added in `8baabb0` *removed matrix* and deleted again in
   > `ed3a66c` *added new emojis*, a commit that otherwise touches only three
   > `api.ts` files. What is in the tree today:
   > - `supabase/migrations/` — **all three doors open.** `votes_select_own`
   >   ([…_rls.sql:77](supabase/migrations/20260815000400_rls.sql#L77)) still
   >   carries `or public.is_admin()`, and both RPCs are still defined and
   >   granted in [20260815000500_rpc.sql](supabase/migrations/20260815000500_rpc.sql).
   >   [anonymity.sql:224](supabase/tests/anonymity.sql#L224) asserts the matrix
   >   *works* for an admin.
   > - `src/` — the admin door is gone: no `AdminVotes.tsx`, no route, no
   >   `ka.ts` strings. `useMyVotes`
   >   ([standings/api.ts](src/features/standings/api.ts)) documents the open
   >   `is_admin()` clause and defends against it with an explicit `voter_id`
   >   filter.
   >
   > So a database built from this repo today lets the admin
   > `select * from votes` from devtools. Either restore the migration
   > (`git show 8baabb0:supabase/migrations/20260818000200_votes_anonymous_to_admin.sql`)
   > and flip `anonymity.sql` to assert the doors are shut, or rewrite this
   > rule — but do not leave the two disagreeing. Note that
   > `post_votes_select_own` carries the same `or public.is_admin()` and was
   > never covered by that migration.

   **The one exception is polls**, whose answers are deliberately signed — a
   poll asks about the app, not about a person, so `poll_answers` has no
   aggregate view, is readable in full by every member, and is published to
   realtime. The poll UI states this on the card
   ([docs/superpowers/specs/2026-08-18-polls-design.md](docs/superpowers/specs/2026-08-18-polls-design.md)).
   Do not copy that pattern to anything that judges a member.
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
   `timestamptz`, render in Tbilisi time — always through `src/lib/time.ts`.

## Commands

```
npm run dev         # vite, localhost:5173
npm run build       # tsc --noEmit && vite build
npm run lint        # typecheck only — an alias for tsc --noEmit
npm run test:unit   # node:test, bundled through the esbuild vite already ships
```

There is no linter beyond TypeScript, and no test framework: `test:unit` bundles
`src/lib/*.test.ts` with esbuild and runs it on node's built-in runner, so it
covers pure logic only (it cannot touch React, the DOM or Supabase). Add a case
there when a bug turns out to live in a decision rather than in rendering —
`src/lib/avatarImage.test.ts` is the pattern. The bundle lands in
`node_modules/.cache/` and is executed with plain `node <file>` rather than
`node --test <file>`, because the built-in runner refuses to collect anything
under `node_modules`.

**The real test suite is SQL**, run against a database, each file
self-contained and ending in `ROLLBACK`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/anonymity.sql   # one file = one run
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc_smoke.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rank_notices.sql
```

A clean run prints only `PASS` lines; any `FAIL` raises and aborts the
transaction. They also paste straight into the Supabase SQL editor. To run
without a Supabase project at all, `supabase/tests/local_shim.sql` fakes
`auth.users`, `auth.uid()`, the `anon`/`authenticated` roles and
`storage.objects` well enough for the whole migration set to apply to a plain
Postgres 15 container — shim, then every migration in order, then `seed.sql`,
then the tests (SETUP.md § *Running it without a Supabase project*).

`anonymity.sql` is the one that matters: it signs in as a normal member and
tries everything that must be impossible. If it ever fails, that is the
highest-priority bug in the repo.

## Database workflow

Migrations are **applied by hand, in filename order, through the Supabase SQL
editor** (SETUP.md § 3) — there is no `db push` in the loop. So a new migration
has to be a standalone, re-runnable file: wrap it in `begin`/`commit`, prefer
`create or replace` and `drop … if exists`, and never edit an applied one.

Later migrations redefine earlier functions rather than patching them, so
**`grep -n 'function public.<name>' supabase/migrations/*.sql` and read the last
hit** — the live `close_current_week()` is in `…_ranking_tiebreak.sql`, not
`…_week_close.sql`, and the live `emit_rank_notices()` is in
`…_rank_notice_accuracy.sql`, not `…_notifications.sql`.

`src/lib/database.types.ts` is a **hand-maintained** mirror of the schema.
Change a migration, change it in the same commit.

Every migration opens with a long comment explaining the decision, not the
mechanics. Match that when you add one —
`20260819000300_rank_notice_accuracy.sql` is the model: the bug, the report from
the group, the fix, and what deliberately did not change.

## Architecture facts worth knowing before editing

- **The anonymity boundary is `supabase/migrations/*_views.sql`.** Those views
  are owned by `postgres`, run with `security_invoker = off`, and are the only
  path by which vote counts reach a client. A table owner is exempt from that
  table's RLS, which is what lets a view read all of `votes` while its caller
  cannot. Never add an identity column to one of these views.
- **`votes` is deliberately not in the realtime publication.** Publishing it
  would stream the WAL to every subscriber and undo the RLS in one line. The
  identity-free `vote_events` / `score_events` tables exist for that reason:
  clients subscribe to those and refetch aggregates. `notifications` is out of
  the publication for the same reason — per-member rows would stream to
  everybody — so the bell refetches on any signal instead.
- **Never let RLS alone define "my rows".** Because `votes_select_own` grants
  the admin the whole table, a `select … where week_id = x` folded into a
  `target_id → value` map showed the admin somebody else's ballot as their own,
  with correct counts beside it. Every "my rows" query carries an explicit
  `.eq('voter_id', memberId)` / `.eq('member_id', memberId)` filter. Keep that
  true of any new one.
- **Every admin write goes through a `security definer` RPC**, never an RLS
  policy, so that no privileged change can skip its `audit_log` row. There is
  no admin INSERT/UPDATE/DELETE policy anywhere on purpose. On the client that
  is `useAdminMutation` in `src/features/admin/api.ts`, which invalidates the
  audit and dashboard keys on every success.
- **Column-level GRANTs, not RLS, keep members out of `is_admin`.** RLS cannot
  say "you may edit your nickname but not your admin flag"; grants can.
- **Ranking is competition ranking on `net` ALONE.** The same score is the same
  rank: everyone on +5 is #3, and the next rank skips past all of them —
  1, 2, 3, 3, 3, 3, 7. Nothing but `net` can move the rank *number*.
  `total_votes` and `nickname` order rows *inside* a shared rank and never
  change it, cleanest sheet first, so `5/0` renders above `6/1` while both read
  #3. Ascending `total_votes` *is* ascending downvotes, since
  `total = net + 2·down` when `net` is fixed. The rule lives in **four** places
  and they must agree — `src/lib/ranking.ts`, `close_current_week()` and
  `admin_update_result()` (both redefined in
  `20260817000200_ranking_tiebreak.sql`), and `live_ranks()` (added in
  `20260819000200_notifications.sql`, which needs the *open* week's ranks
  server-side because `live_standings` carries none). Change one, change all
  four. A rank notification reads "ახლა #4 ხარ" while the member is looking at
  the board, so `live_ranks()` disagreeing with `ranking.ts` is visible.
  Closed weeks display via `sortFrozen()`, which reorders rows but never
  recomputes the frozen rank (rule 3).
- **A rank notice is the app's only present-tense line.** Every other
  notification kind (`post`, `reaction`, `post_vote`) records an event, and an
  event stays true forever; `#6` stops being true the moment another vote lands.
  So rank notices *coalesce*: an unread one is rewritten in place — `rank_to`
  moves, `rank_from` and `created_at` do not — and is deleted if it lands back
  on its own `rank_from`. Do not reintroduce a cooldown; the one that was there
  dropped notices instead of delaying them, leaving stale ranks on screen.
- **`cast_vote` resolves the open week server-side.** Never send a client
  `week_id` for a write.

## Frontend conventions

- `@/` aliases `src/` (`vite.config.ts` + `tsconfig.json`). Feature-first:
  `src/features/<feature>/` owns its components *and* its `api.ts`; `src/pages/`
  only composes them.
- Each `api.ts` exports a `<feature>Keys` object alongside its React Query
  hooks. Those key objects are the contract the realtime layer invalidates
  against — never inline a query key at a call site.
- **`src/features/realtime/useRealtime.ts` is the only Supabase channel in the
  app.** It debounces every signal for 400ms and then invalidates the affected
  keys, so a burst of twenty votes causes one refetch. A new realtime-driven
  feature adds a `Signal` there rather than a second subscription.
- Freshness comes from that channel, not from polling: the shared `QueryClient`
  sets `staleTime: 30s` and no refetch interval. Closed-week queries use
  `staleTime: Infinity` — rule 3.
- Auth is `src/app/providers/AuthProvider.tsx`, whose five-state `status`
  (`loading` / `signedOut` / `pending` / `inactive` / `active`) drives the guards
  in `src/app/guards.tsx`. **Admin routes render a 404, not a 403** — there is no
  reason to advertise that `/admin` exists.
- Layout has three tiers and the numbers are load-bearing (`src/app/layout.ts`):
  phone below `lg`, rail + table board at `lg`, right rail at 1440. Phone first,
  always.
- Colour lives in `src/theme/tokens.ts` — warm charcoal dark, up = ember amber,
  down = cold slate (*not* red/green), gold reserved for #1 — and
  `src/theme/heat.ts` decides how much of it a given row earns. Neither invents
  a colour the other doesn't know about.

## Non-goals (do not build)

Email or push notifications · categories or multiple ranking dimensions ·
images in posts · multiple friend groups · multiple admins · vote reasons ·
seasons/resets · **comments of any kind** (the feature was dropped in
`20260817000100_drop_comments.sql` — posts carry the conversation) · editing or
deleting your own post · public sharing outside the group.
