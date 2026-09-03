-- ============================================================================
-- გამოიცანი ქვეყანა დროშის მიხედვით — the flag game's scoreboard.
--
-- SEPARATE RANK, ON PURPOSE. This does not touch ტრივიას რანკი, and neither
-- does სნეიკი. Summing scores across games only works if the games are the same
-- shape, and they are not: უნარების ტესტები is ten questions a week answered
-- once, this is an endless streak you can chase all evening. Adding them
-- together would mean whoever plays the most wins the trivia rank regardless of
-- what they know. Every game owns its board; that is the rule from here on.
--
-- NO COUNTRY TABLE. The 195 countries and their Georgian names are bundled with
-- the app (src/features/flags/countries.ts), not stored here. There is nothing
-- to hide: the score is client-reported anyway, exactly like snake's, so a
-- server-side answer key would protect nothing while costing a seed paste and a
-- deploy-time coupling. Contrast უნარების ტესტები, where correct_index really
-- is withheld — there the score is graded server-side and the secrecy buys
-- something real.
--
-- ONE ROW PER MEMBER, best streak only. Not a log of every game; twenty friends
-- chasing a streak would fill a table nobody reads, and the only question the
-- board asks is "what is your best". `plays` earns its place as an honest
-- tiebreak — the same streak reached in fewer attempts sits higher.
--
-- This is deliberately a near-copy of snake_scores rather than a shared
-- `game_scores` table. Generalising would mean migrating a table that is
-- already live and working, to save thirty lines. When a fourth game arrives,
-- that is the moment to fold all three into one — not before.
-- ============================================================================

begin;

create table if not exists public.flag_scores (
  member_id   uuid primary key references public.members(id) on delete cascade,
  best_streak int not null default 0 check (best_streak >= 0 and best_streak <= 1000),
  plays       int not null default 0 check (plays >= 0),
  updated_at  timestamptz not null default now()
);
create index if not exists flag_scores_best on public.flag_scores (best_streak desc);

alter table public.flag_scores enable row level security;

drop policy if exists flag_scores_select on public.flag_scores;

-- Everyone sees everyone. That is what a leaderboard is.
create policy flag_scores_select on public.flag_scores
  for select to authenticated using (true);

-- No insert/update/delete policy: the RPC is the only way in, so nobody can
-- reach in and set someone else's streak, or their own to 999.
revoke all on public.flag_scores from anon, authenticated;
grant select on public.flag_scores to authenticated;

-- Record a finished run. Returns the member's best streak afterwards.
--
-- `plays` counts every finished run; `best_streak` only ever climbs, so
-- submitting a worse run is harmless and still counted — which is what lets the
-- board tiebreak on persistence.
create or replace function public.submit_flag_score(p_streak int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_best   int;
begin
  if p_streak is null or p_streak < 0 or p_streak > 1000 then
    raise exception 'bad_score' using errcode = '22023';
  end if;

  insert into public.flag_scores (member_id, best_streak, plays, updated_at)
  values (v_member, p_streak, 1, now())
  on conflict (member_id) do update
     set best_streak = greatest(public.flag_scores.best_streak, excluded.best_streak),
         plays       = public.flag_scores.plays + 1,
         updated_at  = now()
  returning best_streak into v_best;

  return v_best;
end $$;

revoke all    on function public.submit_flag_score(int) from public, anon;
grant execute on function public.submit_flag_score(int) to authenticated;

-- Published whole, like snake_scores: every column is already on the
-- leaderboard for everybody, so the WAL carries no secret and no identity-free
-- event table is needed to stand in front of it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'flag_scores'
  ) then
    execute 'alter publication supabase_realtime add table public.flag_scores';
  end if;
end $$;

commit;
