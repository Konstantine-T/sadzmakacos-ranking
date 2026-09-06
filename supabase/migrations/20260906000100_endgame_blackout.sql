-- ============================================================================
-- The last six hours are played blind.
--
-- THE PROBLEM. People were watching the board in the closing minutes and voting
-- against it — dogpiling whoever was ahead, rescuing whoever was last. The week
-- stopped measuring what the group thought and started measuring who refreshed
-- at 23:50. Live totals all week are §1.2 and stay; what changes is that the
-- final stretch is played without the scoreboard.
--
-- ENFORCED HERE, NOT IN THE FRONTEND. `live_standings` is the only path by
-- which vote counts reach a client, exactly as migration 03 set it up, so this
-- is the only place the blackout can be real. Hiding the numbers in React would
-- leave them one devtools request away, which is the same mistake rule 1 exists
-- to prevent — and the people most likely to try are the ones this feature is
-- aimed at.
--
-- WHAT IS HIDDEN: up, down, net and total_votes, zeroed for every member. What
-- is NOT: who the members are, so the board still renders and voting continues
-- untouched. `cast_vote` is not modified by this migration at all.
--
-- NO ADMIN EXCEPTION, deliberately. The admin plays. A door that shows the real
-- standings to one account during the blackout would make that account the only
-- one able to vote tactically, which is the exact behaviour being removed.
--
-- vote_events ALSO GOES QUIET. It carries `target_id` and is published to
-- realtime, so a member could subscribe and watch who was collecting votes even
-- with the view zeroed — not the direction, but enough to see where the action
-- was. Nothing in the client reads that column (useRealtime only takes the ping
-- and refetches), so during the blackout it is written null. The ping still
-- fires; it just stops naming anybody.
--
-- Closed weeks are untouched. `week_standings` reads `weekly_results`, which is
-- written by close_current_week() from `votes` directly and never sees this
-- view — so the moment the week closes, everything appears at once, correct.
-- ============================================================================

begin;

-- The one place the six hours is written down.
create or replace function public.blackout_starts_at(p_ends_at timestamptz)
returns timestamptz
language sql immutable set search_path = public as $$
  select p_ends_at - interval '6 hours';
$$;

comment on function public.blackout_starts_at(timestamptz) is
  'When a week stops showing its standings. Change the interval here and both views follow.';

-- ---------------------------------------------------------------- views --
-- `create or replace` rather than drop/create: it keeps the existing grants and
-- the security_invoker setting, and nothing here changes the column list.
create or replace view public.live_standings as
select
  w.id                                 as week_id,
  m.id                                 as member_id,
  m.nickname,
  m.avatar_url,
  case when now() >= public.blackout_starts_at(w.ends_at) then 0
       else (count(*) filter (where v.value = 1))::int end   as up,
  case when now() >= public.blackout_starts_at(w.ends_at) then 0
       else (count(*) filter (where v.value = -1))::int end  as down,
  case when now() >= public.blackout_starts_at(w.ends_at) then 0
       else coalesce(sum(v.value), 0)::int end               as net,
  case when now() >= public.blackout_starts_at(w.ends_at) then 0
       else (count(v.id))::int end                           as total_votes
from public.weeks w
cross join public.members m
left join public.votes v on v.week_id = w.id and v.target_id = m.id
where w.status = 'open' and m.is_active
group by w.id, w.ends_at, m.id, m.nickname, m.avatar_url;

alter view public.live_standings set (security_invoker = off);

-- Turnout gains the flag, appended so existing callers are unaffected. The
-- client needs a server-sourced boolean rather than comparing `ends_at` against
-- its own clock: a phone an hour fast would otherwise show the banner while the
-- numbers were still live, or worse, the other way round.
create or replace view public.week_turnout as
select
  w.id as week_id,
  (select count(distinct v.voter_id) from public.votes v where v.week_id = w.id)::int as voters,
  (select count(*) from public.members m where m.is_active)::int as total_members,
  (w.status = 'open' and now() >= public.blackout_starts_at(w.ends_at)) as blackout
from public.weeks w;

-- ------------------------------------------------------------- realtime --
create or replace function public.emit_vote_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_week   int  := coalesce(new.week_id, old.week_id);
  v_target uuid := coalesce(new.target_id, old.target_id);
  v_hide   boolean;
begin
  select now() >= public.blackout_starts_at(w.ends_at)
    into v_hide
    from public.weeks w
   where w.id = v_week;

  -- During the blackout the ping still fires — clients must still refetch — but
  -- it stops saying who was voted on.
  insert into public.vote_events (week_id, target_id)
  values (v_week, case when coalesce(v_hide, false) then null else v_target end);

  return null;
end $$;

-- target_id has to allow null for the line above. It is a fan-out table nobody
-- joins on; the column exists only because migration 01 wrote it, and no client
-- has ever read it.
alter table public.vote_events alter column target_id drop not null;

commit;
