-- ============================================================================
-- anonymity.sql — the verification step of §3, which the plan says not to skip.
--
-- Everything here runs inside a transaction that ends in ROLLBACK, so it is
-- safe to run against a seeded dev database. It creates two throwaway auth
-- users, links them to the first two members, and then tries — as a normal
-- signed-in member — to do all the things that must be impossible.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/anonymity.sql
-- A clean run prints only PASS lines. Any FAIL aborts.
-- ============================================================================

\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------- setup ----
insert into auth.users (id, instance_id, aud, role, email,
                        raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-a@example.com', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'test-b@example.com', '{}', '{}', now(), now());

-- Member A = a normal player. Member B = the admin.
with picked as (
  select id, row_number() over (order by nickname) rn
  from public.members where is_active
)
update public.members m
   set auth_user_id = case p.rn when 1 then '00000000-0000-4000-8000-0000000000a1'::uuid
                                else '00000000-0000-4000-8000-0000000000b2'::uuid end,
       is_admin     = (p.rn = 2)
from picked p
where p.id = m.id and p.rn in (1, 2);

delete from public.pending_accounts
 where auth_user_id in ('00000000-0000-4000-8000-0000000000a1',
                        '00000000-0000-4000-8000-0000000000b2');

-- Give A at least one ballot of their own, so "you see only your rows" is not
-- passing merely because nothing is visible at all.
do $$
declare v_a uuid; v_target uuid; v_week int;
begin
  select id into v_a from public.members
   where auth_user_id = '00000000-0000-4000-8000-0000000000a1';
  select id into v_target from public.members where id <> v_a and is_active limit 1;
  v_week := public.open_week_id();
  insert into public.votes (week_id, voter_id, target_id, value)
  values (v_week, v_a, v_target, 1)
  on conflict (week_id, voter_id, target_id) do update set value = 1;
end $$;

-- ============================ STRUCTURAL CHECK =============================
-- No view that authenticated can read may carry an identity column at all.
do $$
declare n int;
begin
  select count(*) into n
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('live_standings','week_standings','week_turnout','post_scores',
                       'member_reaction_counts','post_reaction_counts','all_time_standings')
    and column_name in ('voter_id','reactor_id','value','auth_user_id');
  if n <> 0 then
    raise exception 'FAIL: % identity column(s) exposed on a readable view', n;
  end if;
  raise notice 'PASS: no identity columns on any aggregate view';
end $$;

-- ========================= AS A NORMAL MEMBER (A) ==========================
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

do $$
declare v_me uuid; n int; foreign_rows int;
begin
  v_me := public.current_member_id();
  if v_me is null then
    raise exception 'FAIL: current_member_id() is null for a linked member';
  end if;
  if public.is_admin() then
    raise exception 'FAIL: member A reports is_admin';
  end if;
  raise notice 'PASS: member A resolves, and is not admin';

  -- 1. THE headline guarantee.
  select count(*) into n            from public.votes;
  select count(*) into foreign_rows from public.votes where voter_id <> v_me;
  if foreign_rows <> 0 then
    raise exception 'FAIL: % foreign vote rows visible to a normal member', foreign_rows;
  end if;
  if n = 0 then
    raise exception 'FAIL: member A sees zero votes — test is vacuous';
  end if;
  raise notice 'PASS: votes visible to A = % rows, all A''s own', n;

  -- 2. Same contract for post votes and reactions.
  select count(*) into foreign_rows from public.post_votes where voter_id <> v_me;
  if foreign_rows <> 0 then
    raise exception 'FAIL: % foreign post_vote rows visible', foreign_rows;
  end if;
  select count(*) into foreign_rows from public.member_reactions where reactor_id <> v_me;
  if foreign_rows <> 0 then
    raise exception 'FAIL: % foreign member_reaction rows visible', foreign_rows;
  end if;
  select count(*) into foreign_rows from public.post_reactions where reactor_id <> v_me;
  if foreign_rows <> 0 then
    raise exception 'FAIL: % foreign post_reaction rows visible', foreign_rows;
  end if;
  raise notice 'PASS: post_votes and reactions are own-rows-only';

  -- 3. But the aggregates ARE public — that is the other half of the deal.
  select count(*) into n from public.live_standings;
  if n = 0 then
    raise exception 'FAIL: live_standings is empty for a normal member';
  end if;
  select coalesce(sum(total_votes), 0) into n from public.live_standings;
  if n = 0 then
    raise exception 'FAIL: live_standings shows no votes at all';
  end if;
  raise notice 'PASS: live_standings readable, % votes counted', n;

  -- 4. The audit log is not for players.
  select count(*) into n from public.audit_log;
  if n <> 0 then
    raise exception 'FAIL: % audit_log rows visible to a normal member', n;
  end if;
  raise notice 'PASS: audit_log invisible';
end $$;

-- ---- writes that must be refused -------------------------------------------
do $$
begin
  update public.members set is_admin = true where auth_user_id = auth.uid();
  raise exception 'FAIL: a member granted themselves admin';
exception when insufficient_privilege then
  raise notice 'PASS: cannot self-promote to admin';
end $$;

do $$
declare n int;
begin
  update public.members set nickname = 'გატეხილი'
   where auth_user_id is distinct from auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: edited % other members'' rows', n;
  end if;
  raise notice 'PASS: cannot edit another member''s row';
end $$;

do $$
declare v_other uuid; v_third uuid;
begin
  select id into v_other from public.members
   where id <> public.current_member_id() and is_active limit 1;
  select id into v_third from public.members
   where id not in (public.current_member_id(), v_other) and is_active limit 1;

  insert into public.votes (week_id, voter_id, target_id, value)
  values (public.open_week_id(), v_other, v_third, 1);
  raise exception 'FAIL: voted while impersonating another member';
exception when insufficient_privilege then
  raise notice 'PASS: cannot cast a vote as somebody else';
end $$;

do $$
begin
  perform public.cast_vote(public.current_member_id(), 1);
  raise exception 'FAIL: self-vote accepted';
exception when others then
  if sqlerrm like '%no_self_vote%' then
    raise notice 'PASS: self-vote rejected';
  else
    raise exception 'FAIL: self-vote rejected for the wrong reason: %', sqlerrm;
  end if;
end $$;

do $$
begin
  perform public.admin_vote_matrix(public.open_week_id());
  raise exception 'FAIL: normal member read the vote matrix';
exception when insufficient_privilege then
  raise notice 'PASS: admin_vote_matrix refused for a normal member';
end $$;

do $$
declare v_post uuid;
begin
  select id into v_post from public.posts limit 1;
  if v_post is null then
    raise notice 'SKIP: no posts seeded, cannot test post immutability';
    return;
  end if;
  delete from public.posts where id = v_post;
  raise exception 'FAIL: a member deleted a post';
exception when insufficient_privilege then
  raise notice 'PASS: posts are one-shot — no delete privilege';
end $$;

-- =============================== AS ADMIN (B) ==============================
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}';

do $$
declare v_me uuid; n int; foreign_rows int;
begin
  v_me := public.current_member_id();
  if not public.is_admin() then
    raise exception 'FAIL: member B is not admin';
  end if;

  select count(*) into foreign_rows from public.votes where voter_id <> v_me;
  if foreign_rows = 0 then
    raise exception 'FAIL: admin cannot see other members'' votes';
  end if;
  raise notice 'PASS: admin sees % foreign vote rows', foreign_rows;

  select count(*) into n from public.admin_vote_matrix(public.open_week_id());
  if n = 0 then
    raise exception 'FAIL: admin_vote_matrix returned nothing';
  end if;
  raise notice 'PASS: admin_vote_matrix returned % rows', n;
end $$;

reset role;
rollback;

\echo '=============================================='
\echo ' anonymity.sql: all checks passed (rolled back)'
\echo '=============================================='
