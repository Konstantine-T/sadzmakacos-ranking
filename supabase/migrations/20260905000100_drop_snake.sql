-- ============================================================================
-- სნეიკი is removed.
--
-- It was added on 2026-09-02 as a second game on the ტრივია tab — a silly one,
-- deliberately outside ტრივიას რანკი, with the group's own avatars as the food.
-- It worked, and it is going anyway: the group did not want it, and a game
-- nobody opens is a screen to maintain, a table to back up and a realtime
-- subscription to keep honest for nothing.
--
-- WHAT THIS TAKES WITH IT. `snake_scores` held one row per member with their
-- best score. Those scores are deleted, not archived. There is nothing to
-- preserve them for: no board will ever read them again, and keeping a table
-- alive against a future change of mind is how a schema silts up. If snake ever
-- returns it starts from zero, which is the honest thing anyway after a gap.
--
-- WHAT STAYS. `flag_scores` is the surviving per-game board and is untouched.
-- The rule snake established stays with it: every game owns its own board, and
-- nothing but უნარების ტესტები feeds ტრივიას რანკი.
--
-- Written to be re-runnable like everything else here — each step is guarded,
-- so pasting it twice is harmless.
-- ============================================================================

begin;

-- Out of the publication before the table goes, so the WAL stops carrying it
-- even on a database where the drop below is somehow deferred.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'snake_scores'
  ) then
    execute 'alter publication supabase_realtime drop table public.snake_scores';
  end if;
end $$;

drop function if exists public.submit_snake_score(int);

-- The policy and grants go with the table.
drop table if exists public.snake_scores;

commit;
