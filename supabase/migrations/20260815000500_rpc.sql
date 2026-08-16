-- ============================================================================
-- 05 · RPCs
--
-- Member-facing RPCs exist where the server must own a value the client must
-- not be trusted with (which week is open) or where the operation is a toggle
-- that would otherwise take three round trips.
--
-- Admin RPCs exist so that no privileged write can happen without an audit_log
-- row. There is deliberately no admin RLS policy for INSERT/UPDATE/DELETE
-- anywhere — the only way in is through these functions.
-- ============================================================================

-- ---------------------------------------------------------------- guards ---
create or replace function public.require_member() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_member uuid := public.current_member_id();
begin
  if v_member is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return v_member;
end $$;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_member uuid;
begin
  select m.id into v_member from public.members m
   where m.auth_user_id = auth.uid() and m.is_admin;
  if v_member is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_member;
end $$;

-- The open week, refusing to hand it back if the admin has pulled the brake.
create or replace function public.require_votable_week() returns int
language plpgsql stable security definer set search_path = public as $$
declare v_week int; v_paused boolean;
begin
  select w.id, w.is_paused into v_week, v_paused
    from public.weeks w where w.status = 'open';
  if v_week is null then
    raise exception 'no_open_week' using errcode = '22023';
  end if;
  if v_paused then
    raise exception 'week_paused' using errcode = '22023';
  end if;
  return v_week;
end $$;

-- ============================== MEMBER RPCs ================================

-- One vote per member per other member per week. p_value: 1, -1, or null/0 to
-- clear. The week is resolved server-side — a client-supplied week_id is never
-- trusted (§8.3).
create or replace function public.cast_vote(p_target_id uuid, p_value int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
begin
  if p_target_id = v_member then
    raise exception 'no_self_vote' using errcode = '22023';
  end if;
  if not exists (select 1 from public.members m
                  where m.id = p_target_id and m.is_active) then
    raise exception 'unknown_target' using errcode = '22023';
  end if;

  if p_value is null or p_value = 0 then
    delete from public.votes
     where week_id = v_week and voter_id = v_member and target_id = p_target_id;
  elsif p_value in (-1, 1) then
    insert into public.votes (week_id, voter_id, target_id, value)
    values (v_week, v_member, p_target_id, p_value::smallint)
    on conflict (week_id, voter_id, target_id)
    do update set value = excluded.value, updated_at = now();
  else
    raise exception 'bad_value' using errcode = '22023';
  end if;
end $$;

-- Post votes. Self-voting on your own post is intentionally allowed (§1.4).
create or replace function public.vote_post(p_post_id uuid, p_value int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
begin
  if not exists (select 1 from public.posts p
                  where p.id = p_post_id and p.week_id = v_week) then
    raise exception 'post_not_votable' using errcode = '22023';
  end if;

  if p_value is null or p_value = 0 then
    delete from public.post_votes where post_id = p_post_id and voter_id = v_member;
  elsif p_value in (-1, 1) then
    insert into public.post_votes (post_id, voter_id, value)
    values (p_post_id, v_member, p_value::smallint)
    on conflict (post_id, voter_id)
    do update set value = excluded.value, updated_at = now();
  else
    raise exception 'bad_value' using errcode = '22023';
  end if;
end $$;

-- Returns true if the reaction is now ON, false if it was toggled off.
create or replace function public.toggle_member_reaction(p_member_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
  v_hit    int;
begin
  delete from public.member_reactions
   where week_id = v_week and member_id = p_member_id
     and reactor_id = v_member and emoji = p_emoji;
  get diagnostics v_hit = row_count;
  if v_hit > 0 then
    return false;
  end if;

  insert into public.member_reactions (week_id, member_id, reactor_id, emoji)
  values (v_week, p_member_id, v_member, p_emoji);
  return true;
end $$;

create or replace function public.toggle_post_reaction(p_post_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
  v_hit    int;
begin
  if not exists (select 1 from public.posts p
                  where p.id = p_post_id and p.week_id = v_week) then
    raise exception 'post_not_reactable' using errcode = '22023';
  end if;

  delete from public.post_reactions
   where post_id = p_post_id and reactor_id = v_member and emoji = p_emoji;
  get diagnostics v_hit = row_count;
  if v_hit > 0 then
    return false;
  end if;

  insert into public.post_reactions (post_id, reactor_id, emoji)
  values (p_post_id, v_member, p_emoji);
  return true;
end $$;

-- One post per member per week, one-shot. The confirm dialog lives in the UI;
-- the guarantee lives here.
create or replace function public.create_post(p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
  v_id     uuid;
begin
  if char_length(btrim(p_body)) = 0 then
    raise exception 'empty_body' using errcode = '22023';
  end if;
  if exists (select 1 from public.posts p
              where p.week_id = v_week and p.author_id = v_member) then
    raise exception 'already_posted' using errcode = '23505';
  end if;

  insert into public.posts (week_id, author_id, body)
  values (v_week, v_member, btrim(p_body))
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.create_comment(p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_week   int  := public.require_votable_week();
  v_id     uuid;
begin
  if char_length(btrim(p_body)) = 0 then
    raise exception 'empty_body' using errcode = '22023';
  end if;

  insert into public.comments (week_id, author_id, body)
  values (v_week, v_member, btrim(p_body))
  returning id into v_id;

  return v_id;
end $$;

-- ============================== ADMIN RPCs =================================

create or replace function public.admin_link_account(p_auth_user_id uuid, p_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  if exists (select 1 from public.members m
              where m.id = p_member_id and m.auth_user_id is not null) then
    raise exception 'member_already_linked' using errcode = '23505';
  end if;

  update public.members set auth_user_id = p_auth_user_id where id = p_member_id;
  if not found then
    raise exception 'unknown_member' using errcode = '22023';
  end if;

  delete from public.pending_accounts where auth_user_id = p_auth_user_id;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'account_linked',
          jsonb_build_object('auth_user_id', p_auth_user_id, 'member_id', p_member_id));
end $$;

create or replace function public.admin_reject_account(p_auth_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  delete from public.pending_accounts where auth_user_id = p_auth_user_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'account_rejected', jsonb_build_object('auth_user_id', p_auth_user_id));
end $$;

create or replace function public.admin_create_member(
  p_nickname text, p_bio text default null, p_avatar_url text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_id uuid;
begin
  insert into public.members (nickname, bio, avatar_url)
  values (btrim(p_nickname), p_bio, p_avatar_url)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'member_created',
          jsonb_build_object('member_id', v_id, 'nickname', p_nickname));
  return v_id;
end $$;

-- Null arguments mean "leave unchanged".
create or replace function public.admin_update_member(
  p_member_id uuid,
  p_nickname text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_is_active boolean default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  update public.members set
    nickname   = coalesce(btrim(p_nickname), nickname),
    bio        = coalesce(p_bio, bio),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    is_active  = coalesce(p_is_active, is_active)
  where id = p_member_id;
  if not found then
    raise exception 'unknown_member' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'member_updated', jsonb_build_object(
    'member_id', p_member_id, 'nickname', p_nickname,
    'bio', p_bio, 'avatar_url', p_avatar_url, 'is_active', p_is_active));
end $$;

-- Unlink a Google account from a member without destroying their history.
create or replace function public.admin_unlink_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  update public.members set auth_user_id = null where id = p_member_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'member_unlinked', jsonb_build_object('member_id', p_member_id));
end $$;

create or replace function public.admin_delete_post(p_post_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_body text; v_author uuid;
begin
  select body, author_id into v_body, v_author from public.posts where id = p_post_id;
  delete from public.posts where id = p_post_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'post_deleted',
          jsonb_build_object('post_id', p_post_id, 'author_id', v_author, 'body', v_body));
end $$;

create or replace function public.admin_delete_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_body text;
begin
  select body into v_body from public.comments where id = p_comment_id;
  update public.comments set deleted_at = now() where id = p_comment_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'comment_deleted',
          jsonb_build_object('comment_id', p_comment_id, 'body', v_body));
end $$;

create or replace function public.admin_void_vote(
  p_week_id int, p_voter_id uuid, p_target_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  delete from public.votes
   where week_id = p_week_id and voter_id = p_voter_id and target_id = p_target_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'vote_voided', jsonb_build_object(
    'week_id', p_week_id, 'voter_id', p_voter_id, 'target_id', p_target_id));
end $$;

create or replace function public.admin_set_week(
  p_week_id int,
  p_ends_at timestamptz default null,
  p_is_paused boolean default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  update public.weeks set
    ends_at   = coalesce(p_ends_at, ends_at),
    is_paused = coalesce(p_is_paused, is_paused)
  where id = p_week_id;
  if not found then
    raise exception 'unknown_week' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'week_updated', jsonb_build_object(
    'week_id', p_week_id, 'ends_at', p_ends_at, 'is_paused', p_is_paused));
end $$;

-- Edit a frozen result, then re-rank that whole week so the standings stay
-- internally consistent. The row is flagged `edited` and the change is logged.
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
           rank() over (order by net desc, total_votes desc) as r
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

create or replace function public.admin_create_announcement(p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_id uuid;
begin
  insert into public.announcements (body) values (btrim(p_body)) returning id into v_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'announcement_created', jsonb_build_object('id', v_id, 'body', p_body));
  return v_id;
end $$;

create or replace function public.admin_set_announcement(p_id uuid, p_is_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  update public.announcements set is_active = p_is_active where id = p_id;
  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'announcement_toggled',
          jsonb_build_object('id', p_id, 'is_active', p_is_active));
end $$;

-- The 20×20 grid: exactly who voted for whom. Admin only, by construction —
-- there is no view equivalent, so this data has one single door.
create or replace function public.admin_vote_matrix(p_week_id int)
returns table (voter_id uuid, voter_nickname text, target_id uuid, target_nickname text, value int)
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select v.voter_id, vm.nickname, v.target_id, tm.nickname, v.value::int
    from public.votes v
    join public.members vm on vm.id = v.voter_id
    join public.members tm on tm.id = v.target_id
    where v.week_id = p_week_id
    order by vm.nickname, tm.nickname;
end $$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_week int; v_out jsonb;
begin
  perform public.require_admin();
  select id into v_week from public.weeks where status = 'open';

  select jsonb_build_object(
    'week_id',        v_week,
    'ends_at',        (select ends_at from public.weeks where id = v_week),
    'is_paused',      (select is_paused from public.weeks where id = v_week),
    'voters',         (select count(distinct voter_id) from public.votes where week_id = v_week),
    'total_members',  (select count(*) from public.members where is_active),
    'votes_cast',     (select count(*) from public.votes where week_id = v_week),
    'posts',          (select count(*) from public.posts where week_id = v_week),
    'comments',       (select count(*) from public.comments
                        where week_id = v_week and deleted_at is null),
    'pending',        (select count(*) from public.pending_accounts),
    'unlinked',       (select count(*) from public.members
                        where auth_user_id is null and is_active)
  ) into v_out;

  return v_out;
end $$;

-- ------------------------------------------------------------- privileges --
revoke all on function public.cast_vote(uuid, int)                       from public, anon;
revoke all on function public.vote_post(uuid, int)                       from public, anon;
revoke all on function public.toggle_member_reaction(uuid, text)         from public, anon;
revoke all on function public.toggle_post_reaction(uuid, text)           from public, anon;
revoke all on function public.create_post(text)                          from public, anon;
revoke all on function public.create_comment(text)                       from public, anon;
revoke all on function public.admin_link_account(uuid, uuid)             from public, anon;
revoke all on function public.admin_reject_account(uuid)                 from public, anon;
revoke all on function public.admin_create_member(text, text, text)      from public, anon;
revoke all on function public.admin_update_member(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.admin_unlink_member(uuid)                  from public, anon;
revoke all on function public.admin_delete_post(uuid)                    from public, anon;
revoke all on function public.admin_delete_comment(uuid)                 from public, anon;
revoke all on function public.admin_void_vote(int, uuid, uuid)           from public, anon;
revoke all on function public.admin_set_week(int, timestamptz, boolean)  from public, anon;
revoke all on function public.admin_update_result(int, uuid, int, int)   from public, anon;
revoke all on function public.admin_create_announcement(text)            from public, anon;
revoke all on function public.admin_set_announcement(uuid, boolean)      from public, anon;
revoke all on function public.admin_vote_matrix(int)                     from public, anon;
revoke all on function public.admin_dashboard()                          from public, anon;
revoke all on function public.me()                                       from public, anon;

grant execute on function public.cast_vote(uuid, int)                       to authenticated;
grant execute on function public.vote_post(uuid, int)                       to authenticated;
grant execute on function public.toggle_member_reaction(uuid, text)         to authenticated;
grant execute on function public.toggle_post_reaction(uuid, text)           to authenticated;
grant execute on function public.create_post(text)                          to authenticated;
grant execute on function public.create_comment(text)                       to authenticated;
grant execute on function public.admin_link_account(uuid, uuid)             to authenticated;
grant execute on function public.admin_reject_account(uuid)                 to authenticated;
grant execute on function public.admin_create_member(text, text, text)      to authenticated;
grant execute on function public.admin_update_member(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_unlink_member(uuid)                  to authenticated;
grant execute on function public.admin_delete_post(uuid)                    to authenticated;
grant execute on function public.admin_delete_comment(uuid)                 to authenticated;
grant execute on function public.admin_void_vote(int, uuid, uuid)           to authenticated;
grant execute on function public.admin_set_week(int, timestamptz, boolean)  to authenticated;
grant execute on function public.admin_update_result(int, uuid, int, int)   to authenticated;
grant execute on function public.admin_create_announcement(text)            to authenticated;
grant execute on function public.admin_set_announcement(uuid, boolean)      to authenticated;
grant execute on function public.admin_vote_matrix(int)                     to authenticated;
grant execute on function public.admin_dashboard()                          to authenticated;
grant execute on function public.me()                                       to authenticated;
