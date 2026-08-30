# ტრივია — design

**Status:** approved for planning · **Date:** 2026-08-30

A second scoreboard for the group, unrelated to votes. The first and only game
is **უნარების ტესტები**: ten ზოგადი უნარები questions a week, answered once,
graded instantly, ranked on correct answers alone.

Nothing here touches `votes`, `weekly_results` or the ranking on the home
board. Trivia is a parallel feature that happens to share the week clock.

---

## 1 · Why this does not break rule 1

Rule 1 says individual votes are secret from everyone, the admin included.
Trivia has a leaderboard, so it is signed by definition — and that is fine for
the same reason polls are (§ `20260818000100_polls.sql`): **a trivia question
judges a question, not a person.** Getting 4/10 is a fact about you and a
sequence puzzle; it is not the group's opinion of you.

Two boundaries still hold, and they are the ones that matter:

- **Scores are public, individual answers are not.** Everyone sees that you
  scored 7/10. Nobody — admin included — sees *which* three you missed.
  `trivia_answers` is select-own; the boards read aggregate views.
- **The answer key is secret from every client, always.** Not for privacy — for
  the game. See § 3.

Both are enforced in Postgres, never in the frontend, exactly as rule 1
requires of anything vote-shaped.

> Note: unlike `votes_select_own` and `post_votes_select_own`, the policy on
> `trivia_answers` carries **no** `or public.is_admin()` clause. The admin
> plays this game; giving them a door into everyone's answers would be a
> cheat-sheet as well as a privacy hole.

---

## 2 · Data model

Four objects. All names are English, per rule 4.

### `trivia_questions` — the pool

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `source` | text unique | e.g. `2015-I-Q1`. Makes the seed idempotent. |
| `section` | text not null | `ანალოგიები`, `ლოგიკა`, … — drives stratified draw |
| `prompt` | text not null | |
| `options` | jsonb not null | array of 4–5 strings, original order, never shuffled |
| `correct_index` | smallint not null | 0-based index into `options` |
| `week_id` | int null → weeks | **null means unused.** This is the used flag. |
| `position` | smallint null | 1–10 within its week |
| `created_at` | timestamptz | |

`unique (week_id, position)` fixes a week's ten in a stable order.
`options` stays `jsonb` rather than five columns because the pool has both
4-option and 5-option questions (28 and 150 respectively).

The nullable `week_id` doubles as the used flag *and* records which week
consumed the question, so there is no separate boolean to drift out of sync.
Adding questions later is a plain `insert`; they join the unused pool with no
extra step.

### `trivia_answers` — one row per member per question

`(question_id, member_id)` primary key, plus `week_id`, `choice_index` and a
denormalised `is_correct`.

**The primary key is what makes an answer final.** "You cannot change it after
დადასტურება" is a uniqueness violation, not a disabled button. `is_correct` is
stored at write time so no aggregate ever needs to touch `correct_index`.

### `trivia_results` — the frozen week

`(week_id, member_id)` with `correct`, `answered`, `rank`. Written when a week
closes. Rule 3: closed weeks are read from here, never recomputed.

### `trivia_totals` — the all-time view

Owned by `postgres`, `security_invoker = off`, summing `trivia_answers` to
`total_correct`, `total_answered`, `tests_taken` per member. Same trick as
`all_time_standings`: the view reads rows its caller cannot.

---

## 3 · The answer key never reaches a browser

The admin plays this game, and so does everyone with devtools. So
`correct_index` is excluded from the GRANT:

```sql
grant select (id, week_id, position, prompt, options)
  on public.trivia_questions to authenticated;
```

Column-level grants, not RLS — the same mechanism that keeps members out of
`members.is_admin`, and for the same reason: RLS cannot say "you may read this
row but not that column".

Grading happens in `answer_trivia(p_question_id uuid, p_choice_index int)`, a
`security definer` RPC that:

1. resolves the member via `require_member()`;
2. verifies the question belongs to the **open** week (server-side — never
   trust a client `week_id`, same rule as `cast_vote`);
3. inserts the answer, computing `is_correct` in Postgres;
4. returns `correct_index` — *after* the write.

So the key arrives one question at a time, only once your choice is committed,
and never in a payload that could be read ahead. A second call for the same
question raises on the primary key.

RLS on `trivia_questions` exposes only questions belonging to a week that has
started. A future week's ten are invisible even without their answers.

---

## 4 · How a week gets its ten

**An `after insert on weeks` trigger claims them.** Not `close_current_week()`,
which already creates the next week: this repo's convention is that a later
migration *redefines* a function rather than patching it, and redefining
`close_current_week()` would mean copying ~200 lines of unrelated week-close
logic to add one statement. A trigger touches nothing that exists and covers
every path that makes a week — cron close, forced close, bootstrap.

The draw is **random but stratified by section**. The pool is 35% ამოცანები, so
a purely random ten could be eight maths questions and would not feel like a
ზოგადი უნარები test. The trigger draws proportionally to the *remaining* pool's
section mix, then tops up randomly to ten if rounding leaves a shortfall.

If fewer than ten unused questions remain, the week claims what is left. If
none remain, the week simply has no test and the games tab says so. The admin
dashboard grows a `trivia_unused` count so the pool running low is visible
before it runs dry.

A second trigger, `after update on weeks when (old.status = 'open' and
new.status = 'closed')`, freezes `trivia_results`. Again: no existing function
is redefined.

---

## 5 · Ranking

**Competition ranking on `correct` ALONE.** Same shape as the main board:
everyone on 8 shares a rank and the next rank skips — 1, 2, 3, 3, 3, 7.

Inside a shared rank, rows order by `answered` ascending, then nickname. At a
fixed correct count, `answered = correct + wrong`, so ascending `answered` *is*
ascending wrong answers — the cleanest sheet sits on top, exactly as
`total_votes` works on the vote board.

Unanswered questions count for nothing on either side of the ratio. Stop at six
and you score what you got right out of six; you are not punished for stopping,
and you do not get the other four.

This rule lives in **two** places and they must agree:
`src/lib/triviaRanking.ts` and the SQL that writes `trivia_results`.

> It is deliberately **not** the same rule as `src/lib/ranking.ts`, which ranks
> on `net`. Do not merge them. `triviaRanking.ts` carries a comment saying so.

The all-time board ranks on `total_correct`, summed over every week played.

---

## 6 · Frontend

`src/features/trivia/` owns its components and its `api.ts`, exporting a
`triviaKeys` object like every other feature. `src/pages/` only composes.

### Routes

| route | page |
|---|---|
| `/trivia` | `TriviaPage` — the two tabs |
| `/trivia/skills` | `TriviaTestPage` — the test runner, full-bleed |

The test runner hides the bottom nav: one question owns the screen.

### Navigation

The bottom bar and rail go from four destinations to five —
რანკი · პოსტები · **ტრივია** · არქივი · პროფილი — with ტრივია in the middle
slot. Five 44px targets fit 390px.

### `/trivia` — two tabs

A `ScopeToggle` (the component the home board already uses) switches
**თამაშები** / **ტრივიას რანკი**.

- **თამაშები** — one card per game. Today that is one card: უნარების ტესტები,
  showing this week's progress (`3/10 პასუხი`) and a
  დაწყება / გაგრძელება / დასრულებულია button. A dashed "სხვა თამაშები მალე"
  slot sits underneath, so adding the next game is a row in a list.
- **ტრივიას რანკი** — the full board, with its own **ეს კვირა / საერთო**
  switch. This inner control is a new small component, not a second
  `ScopeToggle`: it renders as underlined text, so two levels of navigation on
  one screen never read as the same control.

### The test runner

One question per screen. Progress segments at the top (green for correct, red
for wrong, ember for current). Question in the display serif. Options as tappable
rows. **დადასტურება** confirms.

On confirm: your row goes crimson or green, the correct row goes green if you
missed it, the other options fade to 34%, and the button becomes **შემდეგი**.
Nothing moves on its own — you can sit with it. Closing the app mid-test and
returning resumes at the first unanswered question.

### Colour

`tokens.ts` gains a named pair: `quiz.correct = #4FB477`,
`quiz.wrong = #E5544B`. Crimson rather than the brand ember `#F73718`, which is
on the დადასტურება button — a wrong answer and a primary button must not be the
same colour. This is a deliberate, scoped exception to the board's
no-traffic-lights rule (§ `tokens.ts`), justified because a wrong answer is a
fact about a question, not a verdict on a person. It does not spread beyond the
test runner.

### Home page

A **ტრივიას ტოპ 5** card below the standings board, showing the top five of the
**all-time** board. All-time rather than this week so the card is never empty on
a Monday morning.

### Profile

`MePage` and `MemberPage` grow a trivia block: total correct, tests taken,
best week, current all-time rank.

### i18n

All strings under `ka.trivia` in `src/i18n/ka.ts`. No hardcoded strings.

---

## 7 · Realtime

One new `Signal` in `src/features/realtime/useRealtime.ts` — the app's only
Supabase channel — invalidating `triviaKeys`.

`trivia_answers` is **not** published: it is select-own, and streaming it would
hand every subscriber the per-question answers § 1 keeps private. An
identity-free `trivia_events (id, week_id, created_at)` table carries the ping
instead, exactly as `vote_events` does for `votes`. Clients refetch aggregates.

`trivia_events` joins the daily prune job alongside `vote_events` and
`score_events`.

---

## 8 · Ingestion

`supabase/seed/trivia_questions.json` — **178 questions**, already extracted
from the four 2015 ზოგადი უნარები variants and their answer key.

From 320 raw questions: −48 ტექსტის გააზრება (excluded by request),
−41 რაოდენობრივი შედარება and −16 მონაცემთა ანალიზი (two-column and
chart-based; unusable as text), −13 citing a figure, −7 whose fraction bars did
not survive extraction, −4 undetected inside already-excluded sections,
−13 cross-variant duplicates.

Every surviving question is answerable as plain text. **No question needs an
image**, so `trivia_questions` has no `image_url` and Supabase storage is not
involved.

Loading is one idempotent statement in the SQL editor:

```sql
insert into public.trivia_questions (source, section, prompt, options, correct_index)
select e->>'source', e->>'section', e->>'prompt', e->'options', (e->>'correct_index')::int
  from jsonb_array_elements($$[ … ]$$::jsonb) as e
on conflict (source) do nothing;
```

Topping up later: append to the JSON, regenerate `trivia_questions.sql`, paste
again. Only new rows land; nothing already served is disturbed.

At ten a week, 178 questions is **17 weeks**.

---

## 9 · Testing

`supabase/tests/trivia.sql`, self-contained and ending in `ROLLBACK`, in the
style of `anonymity.sql`. It signs in as a normal member and asserts:

1. `select correct_index from trivia_questions` **fails** — for a member *and*
   for the admin;
2. answering the same question twice fails;
3. answering a question from another week fails;
4. a member cannot read another member's `trivia_answers`;
5. an unstarted future week's questions are invisible;
6. ties share a rank and the next rank skips.

`src/lib/triviaRanking.test.ts` covers the ranking rule under
`npm run test:unit`, following `avatarImage.test.ts`.

---

## 10 · Deliberately not in scope

- **Timing or speed.** Ranking is correct count alone; nothing records how long
  you took. No per-question timer.
- **Retakes.** One attempt per question, ever.
- **Trivia notifications.** The bell has four kinds, each with its own read
  cursor; a fifth is its own piece of work. A trivia rank notice would also
  inherit the present-tense coalescing problem rank notices already have.
- **An admin question picker.** The admin plays, so no screen may preview a
  week's questions. The only admin surface is the unused-pool count.
- **Images in questions**, per § 8.
- **A second game.** The games tab is built so the next one is a row in a list,
  but only უნარების ტესტები exists.
- **Trivia affecting the main ranking.** The two boards never touch.

---

## 11 · Migration checklist

One new migration, `20260830000100_trivia.sql`, standalone and re-runnable
(`begin`/`commit`, `create or replace`, `drop … if exists`), opening with a
comment explaining the decision rather than the mechanics.

It also redefines `admin_dashboard()` to add `trivia_unused` — the only
existing function this feature touches.

`src/lib/database.types.ts` is hand-maintained: it changes in the same commit.
