# გადარჩენა — trivia survival (design)

A third game on the ტრივია tab. English multiple-choice questions from
[The Trivia API](https://the-trivia-api.com/docs/), four options each, asked
until you get one wrong.

## Decisions (from the brainstorm, 2026-09-24)

- **Survival only.** One mistake ends the run. No lives, no timer — pure
  knowledge, like the flag game.
- **Four options, as the API wrote them.** The first cut turned each question
  into a true/false card (one proposed answer, right or wrong?). The API has no
  true/false questions, so that framing was invented on top of multiple choice
  and read that way; it was replaced before shipping. Four options also makes a
  blind guess survive 25% of the time instead of 50%.
- **Difficulty ramps with the streak:** questions 1–10 are `easy`, 11–20
  `medium`, 21+ `hard`.
- **Category is picked before a run:** `ყველა` (all ten mixed) or one of the
  API's ten categories. None are excluded.
- **Every category is ranked separately** — 11 boards. A geography-only streak
  and a mixed streak are not the same quantity.
- **The game page shows the top 4 of every board**; tapping a board opens that
  category's full ranking on its own route.
- The game card on the ტრივია tab shows the `ყველა` leader and your `ყველა` best.

## Where the questions come from

Fetched **in the browser**, straight from `https://the-trivia-api.com/v2/questions`
(CORS is `*`, no key, 50 per request, CC BY-NC 4.0 — free for a private group,
credited on the page). No server fetch, no question table.

That is safe for the same reason the flag game's is: the score is
client-reported, so a server-held answer key would protect nothing. The API
returns the answer alongside the question anyway.

Questions are English; every string around them stays Georgian in `ka.ts`.

### Card construction

The API lists `correctAnswer` apart from `incorrectAnswers`, so the options are
shuffled — unshuffled, the answer would always be the first button. A question
whose options repeat (case-insensitively) is dropped: two identical buttons,
one right and one wrong, would be a coin toss.

A question id is dealt at most once per run. Batches are fetched per difficulty
tier (50 at a time), the next tier is prefetched three questions before the
ramp, and a tier that stops yielding unseen questions ends the run as won.

## Data

One table, one RPC, mirroring `flag_scores` / `submit_flag_score`:

```
survival_scores (member_id, category, best_streak, plays, updated_at)
  primary key (member_id, category)
  category in ('all', <the ten API categories>)
submit_survival_score(p_category text, p_streak int) returns int
```

`best_streak` only climbs; `plays` counts every finished run and breaks ties
ascending. Published to realtime whole — every column is already on the board.
Kept separate from `flag_scores` rather than folded into a shared `game_scores`:
it is the second per-game board, not the third, and it has a category dimension
the flag game does not.

## Screens

- `/trivia/survival` — category chips + start button, then 11 boards × top 4.
  Playing replaces the boards with the game.
- `/trivia/survival/board/:category` — the full ranking for one category.

The game is the flag game's layout with a question in place of the flag: four
≥52px option buttons, green/red verdict, the right answer highlighted on a
miss. A right answer advances by itself after 900ms.

## Testing

`src/features/survival/deck.test.ts` on the unit runner: the ramp boundaries,
that every option appears once and the answer moves between positions, the
duplicate-option filter, the per-run dedupe.
