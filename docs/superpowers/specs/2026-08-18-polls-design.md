# Polls — design

**Date:** 2026-08-18
**Status:** implemented

The admin asks the group a question with a fixed set of answers. Everyone
answers. The first use is "which feature do you want next".

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Anonymity | **Signed** — everyone sees who picked what | A poll asks about the app, not about a person. Knowing who wants what is the useful part. |
| Lifecycle | Admin opens and closes; **not tied to a week** | "Which feature next" isn't a weekly question. Modelled on `announcements`. |
| Placement | Top of the board, in the announcements slot | The screen everyone opens twenty times a day, so it gets answered. |
| After closing | Final results stay until the admin hides it | Two flags give three states with no new screens. |
| Single vs multi | Chosen by the admin at creation | Stated requirement. |
| Composer | Question + textarea, one option per line | Leaner *and* more flexible than a builder: reordering is moving a line, and there's no drag target to miss on a phone. |

### The anonymity exception

This is the app's first signed vote-like thing and a deliberate exception to
rule 1. Two consequences follow from having no identity to protect:

- **No aggregate-only view.** That machinery exists to stop a client resolving
  identity. Clients read `poll_answers` whole and count it — with twenty
  members that is cheaper than the view would be.
- **All three tables join the realtime publication.** `votes` never can:
  publishing it would stream the WAL to every subscriber and undo the RLS. Poll
  answers carry nothing the UI doesn't already show.

The member card names each option's voters and says
`პასუხები ღიაა — ყველა ხედავს ვინ რა აირჩია`, so the different contract is
visible rather than buried in a migration. Recorded in CLAUDE.md rule 1.

## Data model

```
polls         id, question, is_multi, is_active, created_at, closed_at
poll_options  id, poll_id, label, position       unique (poll_id, position)
poll_answers  poll_id, option_id, member_id, created_at   PK (option_id, member_id)
```

`poll_answers.poll_id` is denormalised so "my answers to this poll" needs no
join, and so RLS can gate on the parent without one either.

**States**, from two independent flags:

| `is_active` | `closed_at` | Members see |
|---|---|---|
| true | null | Answerable poll |
| true | set | Final result, read-only |
| false | either | Nothing |

**RLS:** `select` for authenticated on all three, gated on the parent poll being
active. No insert/update/delete policy anywhere — every write is an RPC, so no
privileged change can skip its `audit_log` row.

Options are **immutable** after creation, the same one-shot contract posts have.
Renaming an option after people answer would silently rewrite what they agreed
to. Wrong options → close it, make another.

## RPCs

`answer_poll(poll_id, option_ids[])` — replaces the caller's whole answer set
atomically. Rejects a closed poll (`poll_closed`), more than one option when
`is_multi` is false (`single_choice_only`), and options belonging to another
poll (`bad_option`). Empty array clears, mirroring `cast_vote(null)`.

Server-side because "at most one option, unless a flag on the parent says
otherwise" is not expressible as a constraint, and a client-side
delete-then-insert can half-fail and leave a member with no answer.

Admin, all `security definer` + `audit_log`:

- `admin_create_poll(question, options[], is_multi)` — 2–10 options, trims
  blanks, `position` from ordinality.
- `admin_set_poll(poll_id, is_active?, closed?)` — null means unchanged, like
  `admin_set_week`. `closed = false` reopens.
- `admin_delete_poll(poll_id)` — logs the question and final tally before the
  cascade, so the record outlives the row.
- `admin_list_polls()` — everything including hidden polls. RLS cannot see an
  inactive poll and there are deliberately no admin RLS policies, so this is the
  only door.

## UI

**`PollCard`** — board, above the week card. Options are ≥44px rows; the tally
is drawn *behind* the label rather than beside it so a long Georgian option
never fights a bar for width. Round marker = pick one, square = pick several.
Voter faces sit on each row. Tapping your current answer clears it.

**`/admin/polls`** — the composer plus a list with hide switch, close/reopen and
delete.

## Out of scope

Poll history screen · editing options after creation · deadlines and auto-close
· anonymous polls · notifications (a standing non-goal).

## Files

New: `supabase/migrations/20260818000100_polls.sql`, `src/features/polls/api.ts`,
`src/features/polls/PollCard.tsx`, `src/pages/admin/AdminPolls.tsx`.

Modified: `src/lib/database.types.ts`, `src/i18n/ka.ts`, `src/pages/HomePage.tsx`,
`src/features/realtime/useRealtime.ts`, `src/features/admin/api.ts`,
`src/pages/admin/AdminLayout.tsx`, `src/app/routes.tsx`, `CLAUDE.md`.
