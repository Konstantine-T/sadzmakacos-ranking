-- ============================================================================
-- სნეიკი — a silly game with a real leaderboard.
--
-- The second game in the ტრივია section, and deliberately NOT part of
-- ტრივიას რანკი. Trivia's ranking measures knowledge; snake measures thumbs.
-- Mixing them would make the trivia board meaningless, so snake keeps its own
-- table, its own board, and touches nothing the trivia views read.
--
-- ONE ROW PER MEMBER, holding their best score ever. Not a log of every game:
-- twenty friends playing a snake game generates a lot of rows nobody will ever
-- read, and the only question the board asks is "what is your best". `plays`
-- is kept because it makes an honest tiebreak — the same high score reached in
-- fewer attempts sits higher — and because it is the only way to tell a lucky
-- run from a habit.
--
-- ANONYMITY: none needed, and that is the point. A snake score is not a
-- judgement of anybody, so unlike `votes` and `trivia_answers` this table is
-- published to realtime whole. It contains exactly what the leaderboard already
-- shows on screen: who, and how well. There is no aggregate view hiding
-- anything, for the same reason polls have none.
--
-- The score still cannot be set to an arbitrary value by an arbitrary member:
-- submit_snake_score() is security definer, resolves the member server-side
-- (never trusting a client id, same rule as cast_vote), and only ever moves a
-- score UP. A determined member can still lie about their own score by calling
-- the RPC directly — that is unavoidable for any client-scored arcade game, and
-- it is a snake game between friends, so the check is `greatest()` and a sanity
-- ceiling rather than a replay-verified simulation.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- tables --
create table if not exists public.snake_scores (
  member_id  uuid primary key references public.members(id) on delete cascade,
  best_score int not null default 0 check (best_score >= 0 and best_score <= 10000),
  plays      int not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists snake_scores_best on public.snake_scores (best_score desc);

-- ------------------------------------------------------------------- rls --
alter table public.snake_scores enable row level security;

drop policy if exists snake_scores_select on public.snake_scores;

-- Everyone sees everyone. That is what a leaderboard is.
create policy snake_scores_select on public.snake_scores
  for select to authenticated using (true);

-- No insert/update/delete policy: every write goes through the RPC below, so a
-- member cannot reach in and set someone else's score, or their own to 9999.
revoke all on public.snake_scores from anon, authenticated;
grant select on public.snake_scores to authenticated;

-- ------------------------------------------------------------ member rpc --
-- Record a finished game. Returns the member's best score afterwards.
--
-- `plays` counts every finished game; `best_score` only ever climbs. Sending a
-- worse score than your record is therefore harmless and still counted as a
-- play, which is what lets the board tiebreak on persistence.
create or replace function public.submit_snake_score(p_score int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_best   int;
begin
  if p_score is null or p_score < 0 or p_score > 10000 then
    raise exception 'bad_score' using errcode = '22023';
  end if;

  insert into public.snake_scores (member_id, best_score, plays, updated_at)
  values (v_member, p_score, 1, now())
  on conflict (member_id) do update
     set best_score = greatest(public.snake_scores.best_score, excluded.best_score),
         plays      = public.snake_scores.plays + 1,
         updated_at = now()
  returning best_score into v_best;

  return v_best;
end $$;

revoke all    on function public.submit_snake_score(int) from public, anon;
grant execute on function public.submit_snake_score(int) to authenticated;

-- ------------------------------------------------------------ publication --
-- Published whole, unlike votes and trivia_answers: every column here is
-- already on screen for everybody, so the WAL carries no secret.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'snake_scores'
  ) then
    execute 'alter publication supabase_realtime add table public.snake_scores';
  end if;
end $$;

commit;
