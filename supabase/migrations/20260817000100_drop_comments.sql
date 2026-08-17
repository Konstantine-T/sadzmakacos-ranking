-- ============================================================================
-- Drop the comments feature.
--
-- One thread per week turned out to be surplus: posts already carry everything
-- the group says out loud, and each one has its own votes and reactions. The
-- table, its two RPCs, its policies and its realtime feed all go.
--
-- Order matters. `drop table` would take the policies, index, trigger and
-- grants with it automatically, but admin_dashboard() references
-- public.comments inside a plpgsql body — which Postgres does not resolve until
-- the function runs. If the table went first, the admin dashboard would start
-- failing at runtime with "relation public.comments does not exist". So the
-- function is redefined BEFORE the table disappears.
--
-- Historical audit_log rows with action 'comment_deleted' are left alone. They
-- are the record of admin actions that really happened, and rule 3's respect
-- for the past applies to the log as much as to weekly_results.
-- ============================================================================

begin;

-- ------------------------------------------------------------- realtime ----
-- Explicit, though `drop table` would also detach it. Guarded so this migration
-- stays re-runnable.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'comments'
  ) then
    alter publication supabase_realtime drop table public.comments;
  end if;
end $$;

-- ----------------------------------------------------------------- rpcs ----
drop function if exists public.create_comment(text);
drop function if exists public.admin_delete_comment(uuid);

-- ------------------------------------------------------ admin_dashboard ----
-- Identical to the previous definition minus the 'comments' count. Redefined
-- here rather than patched, because a plpgsql body is replaced whole.
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
    'pending',        (select count(*) from public.pending_accounts),
    'unlinked',       (select count(*) from public.members
                        where auth_user_id is null and is_active)
  ) into v_out;

  return v_out;
end $$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- ---------------------------------------------------------------- table ----
-- Takes comments_week, comments_touch, the three RLS policies and the
-- column-level grants with it.
drop table if exists public.comments;

commit;
