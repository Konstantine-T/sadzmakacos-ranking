-- ============================================================================
-- Flag scores: reset, and bounded by a real number.
--
-- The game changed shape. It used to allow a country to come round again inside
-- a single run, which made a long streak mostly a memory test of the last few
-- minutes, and made the ceiling arbitrary — the original table guessed 1000. A
-- country is now asked at most once per run, so a run has an exact maximum:
-- 195, every sovereign state in src/features/flags/countries.ts. Answer all of
-- them and the game ends won.
--
-- Every existing score was earned under the old rules and is not comparable to
-- anything earned from here on, so they go. Deleted, not archived: no board
-- will read them again, and a table kept alive against a change of mind is how
-- a schema silts up.
--
-- The 195 below is deliberately a literal rather than anything derived. The
-- country list lives in the client, so Postgres cannot know it; if that list
-- ever grows, this constraint is the second thing to change and the comment on
-- COUNTRIES is the first place to look.
--
-- Guarded throughout, so it is safe to run before or after 20260903000200, and
-- safe to run twice.
-- ============================================================================

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'flag_scores'
  ) then
    raise notice 'flag_scores does not exist yet — apply 20260903000200_flags.sql first, then this.';
    return;
  end if;

  -- Scores earned when flags could repeat are not comparable to scores earned
  -- when they cannot.
  delete from public.flag_scores;

  -- The old ceiling was a guess; this one is the size of the pool.
  alter table public.flag_scores drop constraint if exists flag_scores_best_streak_check;
  alter table public.flag_scores
    add constraint flag_scores_best_streak_check
    check (best_streak >= 0 and best_streak <= 195);
end $$;

-- Redefined so the RPC rejects what the constraint would reject anyway, with a
-- named error instead of a constraint violation.
create or replace function public.submit_flag_score(p_streak int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_best   int;
begin
  if p_streak is null or p_streak < 0 or p_streak > 195 then
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

commit;
