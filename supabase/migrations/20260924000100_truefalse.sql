-- ============================================================================
-- მართალია თუ ტყუილი — the true/false survival game's scoreboards.
--
-- The group wanted a quiz they could chase all evening that is not about
-- flags. Questions come from The Trivia API (English, multiple choice); the
-- client turns each one into a single proposed answer and asks "right or
-- wrong?". One miss ends the run. Design:
-- docs/superpowers/specs/2026-09-24-truefalse-survival-design.md
--
-- ELEVEN BOARDS, ONE TABLE. A run is played either across all ten of the API's
-- categories ('all') or inside one of them, and each is ranked separately: a
-- geography-only streak and a mixed streak are not the same quantity, so they
-- cannot share a board. That is a `category` column in the primary key, not
-- eleven tables.
--
-- SEPARATE FROM flag_scores, ON PURPOSE. The flag migration said a third scored
-- game should fold its siblings into one `game_scores` table. Snake came and
-- went, so this is the second per-game board, not the third — and it has a
-- category dimension the flag game does not, which a shared table would have to
-- carry as a meaningless constant for flags. Every game still owns its board,
-- and nothing here feeds ტრივიას რანკი.
--
-- NO QUESTION TABLE. Questions are fetched by the browser straight from the
-- API. The score is client-reported, exactly like the flag game's, so a
-- server-held answer key would protect nothing — the API hands the answer back
-- with the question anyway.
--
-- The 10000 ceiling is a sanity bound, not a real maximum: a question is asked
-- at most once per run, so the true ceiling is the size of the API's pool,
-- which grows every day and which Postgres cannot know.
-- ============================================================================

begin;

create table if not exists public.truefalse_scores (
  member_id   uuid not null references public.members(id) on delete cascade,
  category    text not null check (category in (
                'all',
                'arts_and_literature', 'film_and_tv', 'food_and_drink',
                'general_knowledge', 'geography', 'history', 'music',
                'science', 'society_and_culture', 'sport_and_leisure'
              )),
  best_streak int  not null default 0 check (best_streak >= 0 and best_streak <= 10000),
  plays       int  not null default 0 check (plays >= 0),
  updated_at  timestamptz not null default now(),
  primary key (member_id, category)
);
create index if not exists truefalse_scores_board
  on public.truefalse_scores (category, best_streak desc);

alter table public.truefalse_scores enable row level security;

drop policy if exists truefalse_scores_select on public.truefalse_scores;

-- Everyone sees everyone. That is what a leaderboard is.
create policy truefalse_scores_select on public.truefalse_scores
  for select to authenticated using (true);

-- No insert/update/delete policy: the RPC is the only way in, so nobody can
-- reach in and set someone else's streak.
revoke all on public.truefalse_scores from anon, authenticated;
grant select on public.truefalse_scores to authenticated;

-- Record a finished run. Returns the member's best streak in that category
-- afterwards.
--
-- `best_streak` only ever climbs, so submitting a worse run is harmless and
-- still counted as a play — which is what lets the board tiebreak on
-- persistence. An unknown category fails the table's check constraint; it is
-- checked here first so the client gets a named error instead.
create or replace function public.submit_truefalse_score(p_category text, p_streak int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_best   int;
begin
  if p_category is null or p_category not in (
       'all',
       'arts_and_literature', 'film_and_tv', 'food_and_drink',
       'general_knowledge', 'geography', 'history', 'music',
       'science', 'society_and_culture', 'sport_and_leisure'
     ) then
    raise exception 'bad_category' using errcode = '22023';
  end if;
  if p_streak is null or p_streak < 0 or p_streak > 10000 then
    raise exception 'bad_score' using errcode = '22023';
  end if;

  insert into public.truefalse_scores (member_id, category, best_streak, plays, updated_at)
  values (v_member, p_category, p_streak, 1, now())
  on conflict (member_id, category) do update
     set best_streak = greatest(public.truefalse_scores.best_streak, excluded.best_streak),
         plays       = public.truefalse_scores.plays + 1,
         updated_at  = now()
  returning best_streak into v_best;

  return v_best;
end $$;

revoke all    on function public.submit_truefalse_score(text, int) from public, anon;
grant execute on function public.submit_truefalse_score(text, int) to authenticated;

-- Published whole, like flag_scores: every column is already on the board for
-- everybody, so the WAL carries no secret and no event table has to stand in
-- front of it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'truefalse_scores'
  ) then
    execute 'alter publication supabase_realtime add table public.truefalse_scores';
  end if;
end $$;

commit;
