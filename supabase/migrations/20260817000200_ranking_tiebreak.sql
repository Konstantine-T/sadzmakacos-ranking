-- ============================================================================
-- Rank on net ALONE, and let downvotes decide order inside a tie.
--
-- Before: rank() over (order by net desc, total_votes desc)
--         Two members both on +5 could hold different rank numbers, because the
--         pair (net, total_votes) was the grouping key. 6/1 became #3 and 5/0
--         became #4 — same score, different rank, which reads as a bug.
-- After:  rank() over (order by net desc)
--         Same net, same rank. All four members on +5 are #3, and the next rank
--         skips past all of them: 1, 2, 3, 3, 3, 3, 7, 7, 7, 7, 11.
--
-- Downvotes no longer touch the rank NUMBER. They order rows inside a shared
-- rank, exactly like nickname always has — the clean sheet sits on top, so 5/0
-- renders above 6/1 while both read #3. That ordering is applied where the rows
-- are displayed (src/lib/ranking.ts), because a window function's rank is a
-- number, not a sort.
--
-- This has to change in THREE places or the board will disagree with itself:
--   1. close_current_week()   — the frozen snapshot            (here)
--   2. admin_update_result()  — re-ranks a week after an edit   (here)
--   3. src/lib/ranking.ts     — the live board, client-side     (already done)
--
-- Existing rows in weekly_results are NOT touched. Closed weeks are immutable
-- snapshots (rule 3). Nothing has been closed yet, so in practice there is no
-- history to disagree with.
--
-- Safe to run more than once: both functions are CREATE OR REPLACE.
-- ============================================================================

begin;

-- Identical to migration 06 except for the one `order by` — a plpgsql body is
-- replaced whole, so the rest is reproduced verbatim.
create or replace function public.close_current_week(p_force boolean default false)
returns int
language plpgsql security definer set search_path = public as $$
declare
  w_id         int;
  w_end        timestamptz;
  prev_week    int;
  v_next_start timestamptz;
  v_next_end   timestamptz;
  v_new_week   int;
begin
  -- Lock the open week so a cron fire and a manual close cannot race.
  select id, ends_at into w_id, w_end
    from public.weeks where status = 'open'
    for update;

  if w_id is null then
    return null;
  end if;

  -- Idempotence: cron can fire early or twice; only a forced close (admin)
  -- may run ahead of the buzzer.
  if not p_force and now() < w_end - interval '1 minute' then
    return null;
  end if;

  select id into prev_week
    from public.weeks
   where status = 'closed' and id <> w_id
   order by id desc
   limit 1;

  -- ---------------------------------------------------------- 1. snapshot --
  insert into public.weekly_results
    (week_id, member_id, up, down, net, total_votes, rank, prev_rank, movement)
  with agg as (
    select m.id                                       as member_id,
           (count(*) filter (where v.value = 1))::int  as up,
           (count(*) filter (where v.value = -1))::int as down,
           coalesce(sum(v.value), 0)::int              as net,
           (count(v.id))::int                          as total_votes
    from public.members m
    left join public.votes v
           on v.week_id = w_id and v.target_id = m.id
    where m.is_active
    group by m.id
  ), ranked as (
    select a.*,
           -- net only: the same score is the same rank, and the next rank
           -- skips past everyone sharing it.
           (rank() over (order by a.net desc))::int as rank
    from agg a
  )
  select w_id,
         r.member_id, r.up, r.down, r.net, r.total_votes, r.rank,
         pr.rank,
         pr.rank - r.rank         -- positive = climbed; null = NEW
  from ranked r
  left join public.weekly_results pr
         on pr.week_id = prev_week and pr.member_id = r.member_id
  on conflict (week_id, member_id) do nothing;

  -- ------------------------------------------------------------ 2. freeze --
  -- Done before badges so that "closed weeks" queries below read naturally.
  update public.weeks
     set status = 'closed', closed_at = now(), is_paused = false
   where id = w_id;

  -- ------------------------------------------------------------ 3. badges --
  -- კვირის მეფე — rank 1 this week.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'weekly_king', w_id
    from public.weekly_results
   where week_id = w_id and rank = 1
  on conflict do nothing;

  -- სამი კვირა ტახტზე — rank 1 in this week and the two before it.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'crown_streak_3', w_id
  from (
    select wr.member_id, wr.rank,
           row_number() over (partition by wr.member_id order by wr.week_id desc) as rn
    from public.weekly_results wr
    where wr.week_id <= w_id
  ) t
  group by member_id
  having count(*) filter (where rn <= 3 and rank = 1) = 3
  on conflict do nothing;

  -- კვირის ამწევი — biggest positive rank movement.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'top_climber', w_id
    from public.weekly_results
   where week_id = w_id
     and movement is not null and movement > 0
     and movement = (select max(movement) from public.weekly_results where week_id = w_id)
  on conflict do nothing;

  -- კვირის ჩამვარდნილი — biggest negative rank movement.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'top_faller', w_id
    from public.weekly_results
   where week_id = w_id
     and movement is not null and movement < 0
     and movement = (select min(movement) from public.weekly_results where week_id = w_id)
  on conflict do nothing;

  -- კვირის ანტიგმირი — most downvotes.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'most_hated', w_id
    from public.weekly_results
   where week_id = w_id and down > 0
     and down = (select max(down) from public.weekly_results where week_id = w_id)
  on conflict do nothing;

  -- გამყოფი — loudest week with a near-zero net. Under the new tiebreak a
  -- contested week costs you rank, so this badge is what still gives it a name:
  -- lots of noise, no verdict.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'polarizing', w_id
    from public.weekly_results
   where week_id = w_id and abs(net) <= 1 and total_votes > 0
     and total_votes = (
       select max(total_votes) from public.weekly_results
        where week_id = w_id and abs(net) <= 1)
  on conflict do nothing;

  -- აჩრდილი — nobody thought about you at all.
  insert into public.member_badges (member_id, badge_key, week_id)
  select member_id, 'ghost', w_id
    from public.weekly_results
   where week_id = w_id and total_votes = 0
  on conflict do nothing;

  -- ლეგენდა — currently #1 all-time by total net.
  insert into public.member_badges (member_id, badge_key, week_id)
  with tot as (
    select member_id, sum(net) as total_net
      from public.weekly_results
     group by member_id
  )
  select member_id, 'all_time_leader', w_id
    from tot
   where total_net = (select max(total_net) from tot)
  on conflict do nothing;

  -- --------------------------------------------------- 4. open next week --
  -- Back-to-back: the new week starts exactly where the old one ended, so
  -- voting never pauses. A forced early close starts the next week now
  -- instead, and next_week_boundary() snaps its end back onto Monday 00:00.
  v_next_start := case when now() < w_end then now() else w_end end;
  v_next_end   := public.next_week_boundary(v_next_start);
  if v_next_end <= v_next_start then
    v_next_end := v_next_start + interval '7 days';
  end if;

  insert into public.weeks (starts_at, ends_at, status)
  values (v_next_start, v_next_end, 'open')
  returning id into v_new_week;

  insert into public.audit_log (action, detail)
  values ('week_closed', jsonb_build_object(
    'week_id', w_id, 'forced', p_force, 'next_week_id', v_new_week,
    'next_starts_at', v_next_start, 'next_ends_at', v_next_end));

  return v_new_week;
end $$;

revoke all on function public.close_current_week(boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The same rule where an admin edits a frozen result and the week re-ranks.
-- Leaving the old ordering here would make a hand-edited week disagree with
-- every week closed normally.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_result(
  p_week_id int, p_member_id uuid, p_up int, p_down int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_old jsonb;
begin
  if p_up < 0 or p_down < 0 then
    raise exception 'negative_counts' using errcode = '22023';
  end if;

  select to_jsonb(wr) into v_old from public.weekly_results wr
   where wr.week_id = p_week_id and wr.member_id = p_member_id;
  if v_old is null then
    raise exception 'unknown_result' using errcode = '22023';
  end if;

  update public.weekly_results set
    up = p_up, down = p_down,
    net = p_up - p_down, total_votes = p_up + p_down,
    edited = true
  where week_id = p_week_id and member_id = p_member_id;

  with ranked as (
    select member_id,
           rank() over (order by net desc) as r
    from public.weekly_results where week_id = p_week_id
  )
  update public.weekly_results wr
     set rank = ranked.r,
         movement = wr.prev_rank - ranked.r
  from ranked
  where ranked.member_id = wr.member_id and wr.week_id = p_week_id;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'result_edited', jsonb_build_object(
    'week_id', p_week_id, 'member_id', p_member_id,
    'before', v_old, 'after', jsonb_build_object('up', p_up, 'down', p_down)));
end $$;

revoke all on function public.admin_update_result(int, uuid, int, int) from public, anon;
grant execute on function public.admin_update_result(int, uuid, int, int) to authenticated;

commit;
