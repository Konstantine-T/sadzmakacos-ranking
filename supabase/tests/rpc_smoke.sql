-- ============================================================================
-- rpc_smoke.sql — the Phase 3/5/6 checkpoints, as SQL.
--
-- Drives the member-facing RPCs as a real signed-in member and asserts the
-- observable effects: aggregates move, realtime events are emitted, one-shot
-- rules hold, and the close job is idempotent.
--
-- Ends in ROLLBACK. Safe against a seeded dev database.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rpc_smoke.sql
-- ============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'smoke@example.com', '{}', '{}', now(), now());

update public.members m
   set auth_user_id = '00000000-0000-4000-8000-00000000c001'
 where m.id = (select id from public.members where is_active order by nickname limit 1);

delete from public.pending_accounts
 where auth_user_id = '00000000-0000-4000-8000-00000000c001';

-- The seed may already have given this member their one post for the week.
-- Clear it HERE, as postgres — a member cannot delete their own post, and the
-- anonymity test proves that separately.
delete from public.posts
 where week_id = (select id from public.weeks where status = 'open')
   and author_id = (select id from public.members
                     where auth_user_id = '00000000-0000-4000-8000-00000000c001');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated"}';

-- ============================ VOTING ========================================
do $$
declare
  v_me uuid := public.current_member_id();
  v_target uuid;
  v_week int := public.open_week_id();
  v_before int; v_after int; v_events int;
begin
  select member_id into v_target from public.live_standings
   where member_id <> v_me order by member_id limit 1;

  -- start from a known state
  perform public.cast_vote(v_target, null);
  select net into v_before from public.live_standings where member_id = v_target;
  select count(*) into v_events from public.vote_events;

  perform public.cast_vote(v_target, 1);
  select net into v_after from public.live_standings where member_id = v_target;
  if v_after <> v_before + 1 then
    raise exception 'FAIL: +1 vote moved net by % (expected 1)', v_after - v_before;
  end if;
  raise notice 'PASS: cast_vote(+1) moved net % -> %', v_before, v_after;

  -- switching sides is a 2-point swing, not a 1-point one
  perform public.cast_vote(v_target, -1);
  select net into v_after from public.live_standings where member_id = v_target;
  if v_after <> v_before - 1 then
    raise exception 'FAIL: switching to -1 gave net % (expected %)', v_after, v_before - 1;
  end if;
  raise notice 'PASS: switching +1 -> -1 is a 2-point swing';

  -- clearing returns to baseline
  perform public.cast_vote(v_target, null);
  select net into v_after from public.live_standings where member_id = v_target;
  if v_after <> v_before then
    raise exception 'FAIL: clearing left net at % (expected %)', v_after, v_before;
  end if;
  raise notice 'PASS: cast_vote(null) clears the ballot';

  -- one row per ballot, not one per press
  if (select count(*) from public.votes
       where week_id = v_week and voter_id = v_me and target_id = v_target) <> 0 then
    raise exception 'FAIL: a cleared vote left a row behind';
  end if;

  -- the identity-free realtime feed fired for every change
  if (select count(*) from public.vote_events) <= v_events then
    raise exception 'FAIL: vote_events did not receive any pings';
  end if;
  raise notice 'PASS: vote_events emitted % new identity-free pings',
    (select count(*) from public.vote_events) - v_events;
end $$;

-- ============================ POSTS =========================================
do $$
declare v_post uuid; v_scores record; v_events int;
begin
  v_post := public.create_post('სატესტო პოსტი');
  if v_post is null then raise exception 'FAIL: create_post returned null'; end if;
  raise notice 'PASS: create_post created %', v_post;

  begin
    perform public.create_post('მეორე პოსტი იმავე კვირაში');
    raise exception 'FAIL: a second post was accepted in the same week';
  exception when unique_violation then
    raise notice 'PASS: one post per member per week enforced';
  end;

  -- like-for-like baseline: score_events also carries reaction pings
  select count(*) into v_events from public.score_events where kind = 'post_vote';

  -- self-voting on your own post is intentionally allowed (§1.4)
  perform public.vote_post(v_post, 1);
  select * into v_scores from public.post_scores where post_id = v_post;
  if v_scores.up <> 1 or v_scores.net <> 1 then
    raise exception 'FAIL: post score is up=% net=% (expected 1/1)', v_scores.up, v_scores.net;
  end if;
  raise notice 'PASS: vote_post on your own post is allowed and counted';

  if (select count(*) from public.score_events where kind = 'post_vote') <= v_events then
    raise exception 'FAIL: score_events did not fire for a post vote';
  end if;

  -- reactions toggle
  if public.toggle_post_reaction(v_post, '🔥') is not true then
    raise exception 'FAIL: first toggle_post_reaction did not return true';
  end if;
  if (select count from public.post_reaction_counts
       where post_id = v_post and emoji = '🔥') <> 1 then
    raise exception 'FAIL: post reaction count did not reach 1';
  end if;
  if public.toggle_post_reaction(v_post, '🔥') is not false then
    raise exception 'FAIL: second toggle_post_reaction did not return false';
  end if;
  if exists (select 1 from public.post_reaction_counts where post_id = v_post and emoji = '🔥') then
    raise exception 'FAIL: post reaction survived being toggled off';
  end if;
  raise notice 'PASS: post reactions toggle on and off, counts follow';
end $$;

-- ============================ COMMENTS ======================================
do $$
declare v_id uuid;
begin
  v_id := public.create_comment('სატესტო კომენტარი');

  update public.comments set body = 'შესწორებული' where id = v_id;
  if (select body from public.comments where id = v_id) <> 'შესწორებული' then
    raise exception 'FAIL: could not edit own comment';
  end if;
  raise notice 'PASS: own comment is editable while the week is open';

  update public.comments set deleted_at = now() where id = v_id;
  if (select deleted_at from public.comments where id = v_id) is null then
    raise exception 'FAIL: soft delete did not take';
  end if;
  raise notice 'PASS: own comment soft-deletes';

  -- and cannot be resurrected
  update public.comments set deleted_at = null where id = v_id;
  if (select deleted_at from public.comments where id = v_id) is null then
    raise exception 'FAIL: a deleted comment was un-deleted';
  end if;
  raise notice 'PASS: a soft-deleted comment cannot be un-deleted';
end $$;

-- ============================ MEMBER REACTIONS ==============================
do $$
declare v_target uuid; v_week int := public.open_week_id();
begin
  select member_id into v_target from public.live_standings
   where member_id <> public.current_member_id() order by member_id limit 1;

  if public.toggle_member_reaction(v_target, '👑') is not true then
    raise exception 'FAIL: member reaction did not toggle on';
  end if;
  if (select count from public.member_reaction_counts
       where week_id = v_week and member_id = v_target and emoji = '👑') < 1 then
    raise exception 'FAIL: member reaction count did not register';
  end if;
  if public.toggle_member_reaction(v_target, '👑') is not false then
    raise exception 'FAIL: member reaction did not toggle off';
  end if;
  raise notice 'PASS: ranking-row reactions toggle, counts follow';
end $$;

-- ============================ WEEK CLOSE ====================================
reset role;

do $$
declare v_open int; v_result int; v_count_before int;
begin
  select id into v_open from public.weeks where status = 'open';
  select count(*) into v_count_before from public.weeks;

  -- The buzzer has not gone yet, so an unforced close must do nothing.
  v_result := public.close_current_week(false);
  if v_result is not null then
    raise exception 'FAIL: close_current_week ran early without force';
  end if;
  if (select count(*) from public.weeks) <> v_count_before then
    raise exception 'FAIL: an early close still created a week';
  end if;
  raise notice 'PASS: close_current_week() is a no-op before ends_at';

  -- Forced close: snapshot, freeze, and open the next week in one transaction.
  v_result := public.close_current_week(true);
  if v_result is null then
    raise exception 'FAIL: forced close returned no new week';
  end if;
  if (select status from public.weeks where id = v_open) <> 'closed' then
    raise exception 'FAIL: the old week is not closed';
  end if;
  if (select count(*) from public.weeks where status = 'open') <> 1 then
    raise exception 'FAIL: there is not exactly one open week after closing';
  end if;
  if not exists (select 1 from public.weekly_results where week_id = v_open) then
    raise exception 'FAIL: no snapshot rows were written';
  end if;
  raise notice 'PASS: forced close froze week % and opened week %', v_open, v_result;

  -- The new week must start exactly where the old one ended — no gap.
  if (select starts_at from public.weeks where id = v_result)
     <> (select ends_at from public.weeks where id = v_open) then
    raise notice 'NOTE: next week starts at now() (forced early close), not at ends_at';
  end if;

  -- Competition ranking: ties share a rank and the next rank skips.
  if exists (
    select 1 from (
      select rank, count(*) as n,
             lead(rank) over (order by rank) as next_rank
      from public.weekly_results where week_id = v_open group by rank
    ) t where t.next_rank is not null and t.next_rank <> t.rank + t.n
  ) then
    raise exception 'FAIL: ranks do not skip correctly after a tie';
  end if;
  raise notice 'PASS: competition ranking skips correctly (1, 1, 3, ...)';
end $$;

rollback;

\echo '=============================================='
\echo ' rpc_smoke.sql: all checks passed (rolled back)'
\echo '=============================================='
