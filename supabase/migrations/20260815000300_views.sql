-- ============================================================================
-- 03 · aggregate views — THE ANONYMITY BOUNDARY
--
-- These views are owned by `postgres`, which also owns the base tables, and
-- they run with security_invoker = off. A table owner is exempt from that
-- table's RLS policies (no FORCE ROW LEVEL SECURITY anywhere), so the views can
-- read every row of `votes` / `post_votes` / `*_reactions` while the callers
-- themselves cannot.
--
-- The only thing that ever crosses this boundary is a COUNT. No voter_id, no
-- reactor_id, ever, in any column of any view below.
-- ============================================================================

-- Supabase's default privileges hand `anon` and `authenticated` full table
-- grants. Drop the lot and hand back exactly what each role needs, here and in
-- migration 04. Nothing in this app is readable without signing in.
revoke all on all tables in schema public from anon, authenticated;

-- ---------- live standings: the open week, aggregated ----------
drop view if exists public.live_standings cascade;
create view public.live_standings as
select
  w.id                                 as week_id,
  m.id                                 as member_id,
  m.nickname,
  m.avatar_url,
  (count(*) filter (where v.value = 1))::int  as up,
  (count(*) filter (where v.value = -1))::int as down,
  coalesce(sum(v.value), 0)::int              as net,
  (count(v.id))::int                          as total_votes
from public.weeks w
cross join public.members m
left join public.votes v on v.week_id = w.id and v.target_id = m.id
where w.status = 'open' and m.is_active
group by w.id, m.id, m.nickname, m.avatar_url;

alter view public.live_standings set (security_invoker = off);

-- ---------- frozen standings, with member display data attached ----------
drop view if exists public.week_standings cascade;
create view public.week_standings as
select
  wr.week_id,
  wr.member_id,
  m.nickname,
  m.avatar_url,
  wr.up, wr.down, wr.net, wr.total_votes,
  wr.rank, wr.prev_rank, wr.movement, wr.edited
from public.weekly_results wr
join public.members m on m.id = wr.member_id;

alter view public.week_standings set (security_invoker = off);

-- ---------- turnout: "14/20 ხმა მიცემულია" ----------
drop view if exists public.week_turnout cascade;
create view public.week_turnout as
select
  w.id as week_id,
  (select count(distinct v.voter_id) from public.votes v where v.week_id = w.id)::int as voters,
  (select count(*) from public.members m where m.is_active)::int as total_members
from public.weeks w;

alter view public.week_turnout set (security_invoker = off);

-- ---------- post scores ----------
drop view if exists public.post_scores cascade;
create view public.post_scores as
select
  p.id                                          as post_id,
  p.week_id,
  (count(*) filter (where pv.value = 1))::int   as up,
  (count(*) filter (where pv.value = -1))::int  as down,
  coalesce(sum(pv.value), 0)::int               as net
from public.posts p
left join public.post_votes pv on pv.post_id = p.id
group by p.id, p.week_id;

alter view public.post_scores set (security_invoker = off);

-- ---------- reaction counts (never reactor_id) ----------
drop view if exists public.member_reaction_counts cascade;
create view public.member_reaction_counts as
select week_id, member_id, emoji, (count(*))::int as count
from public.member_reactions
group by week_id, member_id, emoji;

alter view public.member_reaction_counts set (security_invoker = off);

-- week_id is carried through so the client can fetch a whole week's reaction
-- counts in one query instead of one per post.
drop view if exists public.post_reaction_counts cascade;
create view public.post_reaction_counts as
select pr.post_id, p.week_id, pr.emoji, (count(*))::int as count
from public.post_reactions pr
join public.posts p on p.id = pr.post_id
group by pr.post_id, p.week_id, pr.emoji;

alter view public.post_reaction_counts set (security_invoker = off);

-- ---------- all-time ----------
drop view if exists public.all_time_standings cascade;
create view public.all_time_standings as
select
  m.id        as member_id,
  m.nickname,
  m.avatar_url,
  m.is_active,
  coalesce(sum(wr.net), 0)::int                as total_net,
  coalesce(sum(wr.up), 0)::int                 as total_up,
  coalesce(sum(wr.down), 0)::int               as total_down,
  (count(wr.week_id))::int                     as weeks_played,
  case when count(wr.week_id) > 0
       then round(coalesce(sum(wr.net), 0)::numeric / count(wr.week_id), 2)
       else 0::numeric end                     as avg_net,
  (count(*) filter (where wr.rank = 1))::int   as weeks_at_one
from public.members m
left join public.weekly_results wr on wr.member_id = m.id
group by m.id, m.nickname, m.avatar_url, m.is_active;

alter view public.all_time_standings set (security_invoker = off);

-- ============================================================================
-- Grants. `anon` gets nothing — the whole app is behind Google sign-in.
-- ============================================================================
grant select on public.live_standings          to authenticated;
grant select on public.week_standings          to authenticated;
grant select on public.week_turnout            to authenticated;
grant select on public.post_scores             to authenticated;
grant select on public.member_reaction_counts  to authenticated;
grant select on public.post_reaction_counts    to authenticated;
grant select on public.all_time_standings      to authenticated;

revoke all on public.live_standings         from anon;
revoke all on public.week_standings         from anon;
revoke all on public.week_turnout           from anon;
revoke all on public.post_scores            from anon;
revoke all on public.member_reaction_counts from anon;
revoke all on public.post_reaction_counts   from anon;
revoke all on public.all_time_standings     from anon;
