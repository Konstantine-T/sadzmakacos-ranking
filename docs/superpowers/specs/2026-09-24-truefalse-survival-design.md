# მართალია თუ ტყუილი — Survival (design)

A third game on the ტრივია tab. English multiple-choice questions from
[The Trivia API](https://the-trivia-api.com/docs/), turned into true/false
cards: one question, one proposed answer, swipe right if it is right, left if
it is not. One miss ends the run.

## Decisions (from the brainstorm, 2026-09-24)

- **Mode: Survival only.** One mistake ends the run. No lives, no timer — pure
  knowledge, like the flag game.
- **Difficulty ramps with the streak:** cards 1–10 are `easy`, 11–20 `medium`,
  21+ `hard`.
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

For each API question: flip a coin. Heads, the card proposes `correctAnswer`
(truth = true). Tails, it proposes one random entry of `incorrectAnswers`
(truth = false). Questions containing the word *not* are dropped — "Which of
these is NOT a planet? — Mars?" asks the player to negate a negation.

A question id is shown at most once per run. Batches are fetched per difficulty
tier (50 at a time), the next tier is prefetched three cards before the ramp,
and a tier that stops yielding unseen questions ends the run as won.

## Data

One table, one RPC, mirroring `flag_scores` / `submit_flag_score`:

```
truefalse_scores (member_id, category, best_streak, plays, updated_at)
  primary key (member_id, category)
  category in ('all', <the ten API categories>)
submit_truefalse_score(p_category text, p_streak int) returns int
```

`best_streak` only climbs; `plays` counts every finished run and breaks ties
ascending. Published to realtime whole — every column is already on the board.
Kept separate from `flag_scores` rather than folded into a shared `game_scores`:
it is the second per-game board, not the third, and it has a category dimension
the flag game does not.

## Screens

- `/trivia/truefalse` — category chips + start button, then 11 boards × top 4.
  Playing replaces the boards with the card.
- `/trivia/truefalse/board/:category` — the full ranking for one category.

The card is dragged with framer-motion (already a dependency); two ≥52px
buttons (ტყუილი / მართალია) do the same thing for anyone who prefers tapping.
A right answer shows the verdict and the correct answer, then advances by
itself after a beat. A wrong one ends the run and names the correct answer.

## Testing

`src/features/truefalse/deck.test.ts` on the unit runner: the ramp boundaries,
the coin flip's two outcomes, the *not* filter, the per-run dedupe.
