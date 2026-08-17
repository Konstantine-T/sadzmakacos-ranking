# Setup — what you do, in order

Everything in this file is a step **you** take in the Supabase or Vercel
dashboard. The code is already written; none of it needs your credentials.

Total time: about 25 minutes, most of it waiting for a Supabase project to
provision.

---

## 1 · Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**
2. Region: **Central EU (Frankfurt)** — `eu-central-1`, the closest to Tbilisi.
3. Set a database password and save it somewhere. You need it in step 3.
4. Wait for provisioning (~2 min).

Then go to **Project Settings → API** and copy two values:

| Value               | Where it goes                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project URL         | `https://lzuvacrjijnkdqvdvdsi.supabase.co`                                                                                                                                                                         |
| `anon` `public` key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dXZhY3JqaWpua2RxdmR2ZHNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzcwMjUsImV4cCI6MjEwMjQ1MzAyNX0.NKeu9daq6byntYZlqbfXLMMSoMSN9ccupShQRcZFiIE` |

Do **not** copy the `service_role` key anywhere. The frontend never uses it, and
every privileged operation already goes through a security-definer RPC.

---

## 2 · Enable the extensions

**Database → Extensions**, enable:

- `pg_cron` — runs the weekly close job.
- `pgcrypto` — usually on already; the first migration enables it if not.

If you skip `pg_cron`, everything still works except automatic week closing —
you would have to press **კვირის დახურვა ახლავე** in `/admin/week` every Monday.
Migration `09_cron` prints a notice rather than failing if the extension is
missing, so you can enable it and re-run just that file later.

---

## 3 · Run the migrations

**SQL Editor → New query.** Paste and run each file **in this order**, waiting
for each to succeed before the next:

```
supabase/migrations/20260815000100_schema.sql
supabase/migrations/20260815000200_functions.sql
supabase/migrations/20260815000300_views.sql
supabase/migrations/20260815000400_rls.sql
supabase/migrations/20260815000500_rpc.sql
supabase/migrations/20260815000600_week_close.sql
supabase/migrations/20260815000700_realtime.sql
supabase/migrations/20260815000800_storage.sql
supabase/migrations/20260815000900_cron.sql
supabase/migrations/20260815001000_bootstrap.sql
```

Order matters: `04_rls` grants privileges that `03_views` first revokes, and
`10_bootstrap` seeds week 1 only if no week exists yet.

> If you later install the Supabase CLI, `supabase link` + `supabase db push`
> applies exactly these files, and `supabase gen types typescript --linked >
src/lib/database.types.ts` replaces the hand-maintained types.

### What migration 10 does

It creates **week 1 only**: from the moment you run it until
**Mon 24 Aug 2026, 00:00 Tbilisi**. That is the deliberately long first week
from §1.1 — the site goes live mid-week and skips the immediate Monday. Every
week after this one is created automatically by `close_current_week()`.

---

## 4 · Configure Google sign-in

**Authentication → Providers → Google** → enable.

You need a Google OAuth client:

1. <https://console.cloud.google.com/apis/credentials> → **Create credentials →
   OAuth client ID → Web application**.
2. **Authorised redirect URI** — paste the callback URL that Supabase shows you
   on the Google provider page. It looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copy the client ID and secret back into Supabase.

Note that this redirect URI points at **Supabase**, not at the app. Google always
hands the user back to Supabase, which then forwards them to whatever origin the
app asked for. That is why adding a new domain later needs no change in Google
Cloud at all — only in Supabase.

Then **Authentication → URL Configuration**:

- **Site URL**: `https://www.rankbros.ge` — the production origin. The apex
  308-redirects to it, so `window.location.origin` is always the `www` form.
- **Redirect URLs**: add all of
  - `https://www.rankbros.ge` and `https://www.rankbros.ge/**`
  - `https://rankbros.ge` and `https://rankbros.ge/**` — harmless, and keeps
    sign-in working if the apex is ever promoted to primary
  - `http://localhost:5173` and `http://localhost:5173/**` — local dev
  - `https://*.vercel.app/**` — otherwise sign-in breaks on preview deploys

The app calls `signInWithOAuth` with `redirectTo: window.location.origin`
(`src/app/providers/AuthProvider.tsx`), so it works on any origin in that list
without a rebuild. There is no hardcoded domain anywhere in `src/`.

There is no email confirmation to configure — rule 6 — Google only.

---

## 5 · Create the avatars bucket

Migration `08_storage` creates it for you, including the policies. Check
**Storage** shows a public `avatars` bucket with a 2MB limit. If it isn't there,
re-run that one file.

---

## 6 · Point the app at the project

```bash
cp .env.example .env
```

Fill in the two values from step 1, then:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. If you see an English "Supabase is not configured"
card, the `.env` values didn't load — restart the dev server after editing it.

---

## 7 · Make yourself the admin

This is the one step that has to happen in SQL, because the very first admin
cannot be created through an admin-only screen.

1. Sign in with Google at <http://localhost:5173>. You'll land on
   **დაელოდე დადასტურებას** — that's correct, you aren't linked to a member yet.
2. In the SQL editor, create your member row and claim it in one go:

```sql
-- Replace both values. Find your auth uid under Authentication → Users.
insert into public.members (nickname, is_admin, auth_user_id)
values ('შენი-მეტსახელი', true, '<your-auth-uid>')
on conflict (nickname) do update
  set is_admin = true, auth_user_id = excluded.auth_user_id;

delete from public.pending_accounts where auth_user_id = '<your-auth-uid>';
```

3. The waiting screen polls every 15 seconds, so it turns into the app on its
   own within a few seconds. No reload needed.

There is exactly one admin, enforced by a partial unique index — a second
`is_admin = true` row will be rejected by the database. You are otherwise a
normal player: same profile, same votes received, `/admin` is the only
difference.

---

## 8 · Add everyone else

In `/admin/members`, create the other ~19 members — nickname only is fine, they
can set their own bio and avatar later. They exist with no Google account
attached.

As each friend signs in, they appear in `/admin/accounts`; pick their member
from the dropdown and press **დაკავშირება**. Their pending screen becomes the
app within 15 seconds.

---

## 9 · Deploy to Vercel

1. Push the repo to GitHub, then **Vercel → Add New → Project → Import**.
2. Framework preset: **Vite** (auto-detected). `vercel.json` already sets the
   SPA rewrite, so deep links like `/weeks/3` won't 404.
3. **Environment Variables** — add both, for Production *and* Preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These are baked in at build time by Vite, so adding them after a deploy
   means redeploying before they take effect.
4. Deploy.

### The domain: rankbros.ge

5. **Vercel → project → Settings → Domains → Add** `rankbros.ge`, then add
   `www.rankbros.ge` and set it to redirect to the apex. Vercel then shows the
   exact DNS records it wants.
6. At the `.ge` registrar, either:
   - **delegate**: set the domain's nameservers to `ns1.vercel-dns.com` and
     `ns2.vercel-dns.com` and let Vercel hold the zone; or
   - **keep the zone**: add an `A` record for the apex pointing at the IP Vercel
     shows you, and a `CNAME` for `www` → `cname.vercel-dns.com`.

   Use the values from Vercel's own panel rather than any written here — Vercel
   has changed its apex IP before, and a stale one fails validation silently.
7. Wait for the domain to verify and the certificate to issue (automatic). `.ge`
   delegation can take a few hours to propagate.
8. Supabase → **Authentication → URL Configuration**: **Site URL** =
   `https://rankbros.ge`, and make sure the redirect list from step 4 above is
   in place. This is the only place the new domain has to be registered.

   Nothing changes in Google Cloud — see the note in step 4.

---

## Optional: seed dev data

`supabase/seed.sql` builds 20 members, six closed weeks and one open week, with
a tie at #1, a member on 0/0 and a polarising +7/−7 case so the HeatBar and the
tie logic are visibly exercised. It closes those six weeks by actually calling
`close_current_week()`, so it doubles as a test of the close job and the badges.

**It wipes all existing data**, and it refuses to run once any real Google
account has been linked to a member. Run it against a scratch project, never
against the real one.

---

## Optional: run the anonymity test

`supabase/tests/anonymity.sql` is the verification step §3 says not to skip. It
creates two throwaway auth users, links them to members, and then tries — as a
normal signed-in member — to do everything that must be impossible: read
somebody else's ballot, promote itself to admin, vote as another person,
self-vote, delete a post, open the vote matrix. It ends in `ROLLBACK`, so it
changes nothing.

Run it from the SQL editor (paste the whole file) or with psql:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/anonymity.sql
```

A clean run prints only `PASS` lines. Any `FAIL` aborts the transaction.

`supabase/tests/rpc_smoke.sql` is the companion: it drives the member-facing
RPCs as a signed-in member and asserts the observable effects — a vote moves
the aggregate, switching sides is a two-point swing, `vote_events` fires,
`create_post` is one-shot, reactions toggle, `close_current_week()` no-ops
before the buzzer, and ranks skip correctly after a tie. It also ends in
`ROLLBACK`.

### Running it without a Supabase project

`supabase/tests/local_shim.sql` recreates just enough of Supabase (`auth.users`,
`auth.uid()`, the `anon`/`authenticated` roles, `storage.objects`) to run the
whole migration set against a plain Postgres container:

```bash
docker run -d --name ranki-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:15
# then, in order: local_shim.sql, every migration, seed.sql, anonymity.sql
```

---

## Troubleshooting

**"ღია კვირა არ არის" on the landing page.** No week has `status = 'open'`.
Re-run `10_bootstrap.sql`, or close the current week from `/admin/week`.

**Nobody's votes appear in real time.** Check **Database → Replication** that
`supabase_realtime` includes `vote_events` and `score_events`. Migration 07 adds
them; it skips tables already present, so re-running it is safe. `votes` itself
must **not** be in that list — publishing it would leak the WAL to every
subscriber.

**The week didn't close on Monday.** Check `select * from cron.job;`. The job is
`close-week` at `0 20 * * 0` — Sunday 20:00 UTC, which is Monday 00:00 Tbilisi
all year, since Georgia has no DST. If `pg_cron` wasn't enabled when you ran
migration 09, enable it and re-run that file.

**A member can see who voted for them.** They can't — but if you want to prove
it, run the anonymity test. If it ever fails, treat it as the highest-priority
bug in the repo.
