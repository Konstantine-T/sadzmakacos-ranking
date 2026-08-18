-- ============================================================================
-- Ranking votes become anonymous to EVERYONE, the admin included.
--
-- Rule 1 used to read "secret from users, visible to admin". It now reads
-- secret, full stop. Nothing in the database can resolve who voted for whom.
--
-- Deleting the admin screen was not enough. There were three doors, and the
-- screen was the least of them:
--
--   1. `votes_select_own` carried `or public.is_admin()`, so an admin could
--      open devtools and `select * from votes`. No RPC involved — this is the
--      one that mattered.
--   2. `admin_vote_matrix()` returned the whole 20x20 grid on request. Still
--      callable after the page is gone.
--   3. `admin_void_vote()` is an ORACLE. It takes (week, voter, target) and
--      deletes that ballot. Call it against a guess and watch live_standings:
--      if the net moves, the vote existed. Destructive, slow, and a complete
--      read of the matrix given patience. Anonymity that survives only because
--      nobody is patient is not anonymity.
--
-- WHAT THIS COSTS: individual votes can no longer be moderated. There is no
-- way to void one ballot, because there is no way to identify one. A member
-- can still clear their own vote (cast_vote with a null value), and an admin
-- can still correct a whole closed week through admin_update_result(), which
-- works on aggregate up/down counts and never touches identity. That is the
-- deliberate trade.
--
-- Aggregates are untouched. live_standings, week_turnout, close_current_week()
-- and admin_dashboard() all read `votes` as the table owner with
-- security_invoker off, so RLS never applied to them and nothing here changes
-- what the board shows.
-- ============================================================================

begin;

-- ---------------------------------------------------- 1. the RLS back door --
-- Identical to migration 04 minus `or public.is_admin()`. You may read your own
-- ballots and nobody else's, and now that is true of every account.
drop policy if exists votes_select_own on public.votes;

create policy votes_select_own on public.votes
  for select to authenticated
  using (voter_id = public.current_member_id());

-- ------------------------------------------------------- 2. the front door --
drop function if exists public.admin_vote_matrix(int);

-- ------------------------------------------------------------ 3. the oracle --
drop function if exists public.admin_void_vote(int, uuid, uuid);

commit;
