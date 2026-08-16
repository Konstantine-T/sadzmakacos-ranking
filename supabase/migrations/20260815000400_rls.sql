-- ============================================================================
-- 04 · Row Level Security
--
-- Rule 1 of the build plan: individual votes are secret from users, visible to
-- admin, and that is enforced HERE — in Postgres — never in the frontend.
--
-- Two layers do the work:
--   * RLS policies decide which ROWS a role may touch.
--   * Column-level GRANTs decide which COLUMNS. RLS cannot express "you may
--     edit your nickname but not your is_admin flag"; grants can.
--
-- Every privileged write (anything an admin does) goes through a SECURITY
-- DEFINER RPC in migration 05 instead of a policy, so that audit_log entries
-- cannot be bypassed.
-- ============================================================================

alter table public.members          enable row level security;
alter table public.pending_accounts enable row level security;
alter table public.weeks            enable row level security;
alter table public.votes            enable row level security;
alter table public.vote_events      enable row level security;
alter table public.score_events     enable row level security;
alter table public.posts            enable row level security;
alter table public.post_votes       enable row level security;
alter table public.comments         enable row level security;
alter table public.member_reactions enable row level security;
alter table public.post_reactions   enable row level security;
alter table public.weekly_results   enable row level security;
alter table public.member_badges    enable row level security;
alter table public.announcements    enable row level security;
alter table public.audit_log        enable row level security;

-- ---------------------------------------------------------------- members --
drop policy if exists members_select     on public.members;
drop policy if exists members_update_own on public.members;

create policy members_select on public.members
  for select to authenticated using (true);

-- Own row only. Which columns may change is decided by the GRANT below.
create policy members_update_own on public.members
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

grant select on public.members to authenticated;
grant update (nickname, bio, avatar_url) on public.members to authenticated;

-- ------------------------------------------------------- pending_accounts --
drop policy if exists pending_select on public.pending_accounts;

create policy pending_select on public.pending_accounts
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

grant select on public.pending_accounts to authenticated;

-- ------------------------------------------------------------------ weeks --
drop policy if exists weeks_select on public.weeks;

create policy weeks_select on public.weeks
  for select to authenticated using (true);

grant select on public.weeks to authenticated;

-- ------------------------------------------------------------------ votes --
-- SELECT is own-rows-only. This is the single most important policy in the
-- app: `select * from votes` as a normal member must return only that
-- member's own ballots. Verified by supabase/tests/anonymity.sql.
drop policy if exists votes_select_own on public.votes;
drop policy if exists votes_insert_own on public.votes;
drop policy if exists votes_update_own on public.votes;
drop policy if exists votes_delete_own on public.votes;

create policy votes_select_own on public.votes
  for select to authenticated
  using (voter_id = public.current_member_id() or public.is_admin());

create policy votes_insert_own on public.votes
  for insert to authenticated
  with check (
    voter_id = public.current_member_id()
    and voter_id <> target_id
    and week_id = public.open_week_id()
  );

create policy votes_update_own on public.votes
  for update to authenticated
  using (voter_id = public.current_member_id() and week_id = public.open_week_id())
  with check (voter_id = public.current_member_id() and week_id = public.open_week_id());

create policy votes_delete_own on public.votes
  for delete to authenticated
  using (voter_id = public.current_member_id() and week_id = public.open_week_id());

grant select, insert, update, delete on public.votes to authenticated;

-- ------------------------------------------------- vote/score event feeds --
drop policy if exists vote_events_select  on public.vote_events;
drop policy if exists score_events_select on public.score_events;

create policy vote_events_select on public.vote_events
  for select to authenticated using (true);
create policy score_events_select on public.score_events
  for select to authenticated using (true);

grant select on public.vote_events  to authenticated;
grant select on public.score_events to authenticated;

-- ------------------------------------------------------------------ posts --
-- One-shot: no UPDATE or DELETE grant at all for normal members, so the
-- "cannot be edited or deleted by the author" rule holds even if a policy is
-- ever added by mistake.
drop policy if exists posts_select     on public.posts;
drop policy if exists posts_insert_own on public.posts;

create policy posts_select on public.posts
  for select to authenticated using (true);

create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (author_id = public.current_member_id() and week_id = public.open_week_id());

grant select, insert on public.posts to authenticated;

-- ------------------------------------------------------------- post_votes --
drop policy if exists post_votes_select_own on public.post_votes;
drop policy if exists post_votes_insert_own on public.post_votes;
drop policy if exists post_votes_update_own on public.post_votes;
drop policy if exists post_votes_delete_own on public.post_votes;

create policy post_votes_select_own on public.post_votes
  for select to authenticated
  using (voter_id = public.current_member_id() or public.is_admin());

create policy post_votes_insert_own on public.post_votes
  for insert to authenticated
  with check (
    voter_id = public.current_member_id()
    and exists (select 1 from public.posts p
                where p.id = post_id and p.week_id = public.open_week_id())
  );

create policy post_votes_update_own on public.post_votes
  for update to authenticated
  using (
    voter_id = public.current_member_id()
    and exists (select 1 from public.posts p
                where p.id = post_id and p.week_id = public.open_week_id())
  )
  with check (voter_id = public.current_member_id());

create policy post_votes_delete_own on public.post_votes
  for delete to authenticated
  using (
    voter_id = public.current_member_id()
    and exists (select 1 from public.posts p
                where p.id = post_id and p.week_id = public.open_week_id())
  );

grant select, insert, update, delete on public.post_votes to authenticated;

-- --------------------------------------------------------------- comments --
-- Deleted rows stay selectable so the UI can render „წაშლილია".
drop policy if exists comments_select     on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_update_own on public.comments;

create policy comments_select on public.comments
  for select to authenticated using (true);

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (author_id = public.current_member_id() and week_id = public.open_week_id());

-- Covers both editing and soft-deleting. Threads lock when the week closes.
create policy comments_update_own on public.comments
  for update to authenticated
  using (
    author_id = public.current_member_id()
    and week_id = public.open_week_id()
    and deleted_at is null
  )
  with check (author_id = public.current_member_id());

grant select, insert on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;

-- -------------------------------------------------------------- reactions --
-- Same anonymity contract as votes: you can read your own reactions (so the
-- UI can show which ones you've toggled on) and nobody else's. Counts come
-- from member_reaction_counts / post_reaction_counts.
drop policy if exists member_reactions_select_own on public.member_reactions;
drop policy if exists member_reactions_insert_own on public.member_reactions;
drop policy if exists member_reactions_delete_own on public.member_reactions;

create policy member_reactions_select_own on public.member_reactions
  for select to authenticated
  using (reactor_id = public.current_member_id() or public.is_admin());

create policy member_reactions_insert_own on public.member_reactions
  for insert to authenticated
  with check (reactor_id = public.current_member_id() and week_id = public.open_week_id());

create policy member_reactions_delete_own on public.member_reactions
  for delete to authenticated
  using (reactor_id = public.current_member_id() and week_id = public.open_week_id());

grant select, insert, delete on public.member_reactions to authenticated;

drop policy if exists post_reactions_select_own on public.post_reactions;
drop policy if exists post_reactions_insert_own on public.post_reactions;
drop policy if exists post_reactions_delete_own on public.post_reactions;

create policy post_reactions_select_own on public.post_reactions
  for select to authenticated
  using (reactor_id = public.current_member_id() or public.is_admin());

create policy post_reactions_insert_own on public.post_reactions
  for insert to authenticated
  with check (
    reactor_id = public.current_member_id()
    and exists (select 1 from public.posts p
                where p.id = post_id and p.week_id = public.open_week_id())
  );

create policy post_reactions_delete_own on public.post_reactions
  for delete to authenticated
  using (
    reactor_id = public.current_member_id()
    and exists (select 1 from public.posts p
                where p.id = post_id and p.week_id = public.open_week_id())
  );

grant select, insert, delete on public.post_reactions to authenticated;

-- ------------------------------------------- snapshots, badges, the past --
drop policy if exists weekly_results_select on public.weekly_results;
drop policy if exists member_badges_select  on public.member_badges;

create policy weekly_results_select on public.weekly_results
  for select to authenticated using (true);
create policy member_badges_select on public.member_badges
  for select to authenticated using (true);

grant select on public.weekly_results to authenticated;
grant select on public.member_badges  to authenticated;

-- ---------------------------------------------------------- announcements --
drop policy if exists announcements_select on public.announcements;

create policy announcements_select on public.announcements
  for select to authenticated
  using (is_active or public.is_admin());

grant select on public.announcements to authenticated;

-- --------------------------------------------------------------- audit_log --
drop policy if exists audit_log_select_admin on public.audit_log;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.is_admin());

grant select on public.audit_log to authenticated;
