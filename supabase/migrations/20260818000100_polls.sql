-- ============================================================================
-- Polls: the admin asks a question, the group answers.
--
-- ANONYMITY: poll answers are SIGNED — everyone sees who picked what. This is
-- a deliberate exception to rule 1, which keeps ranking votes and reactions
-- secret from members. A poll is a product question ("which feature next"),
-- not a judgement about a person, and knowing who wants what is the useful
-- part. Because there is no identity to protect here:
--
--   * there is no aggregate-only view — clients read the rows and count them
--     (twenty members, so this is cheaper than a view);
--   * all three tables CAN join the realtime publication, which `votes` never
--     can. Publishing `votes` would stream the WAL and undo migration 04;
--     publishing `poll_answers` reveals only what the UI already shows.
--
-- The member-facing UI shows each option's voters by name, so nobody has to
-- read this file to discover the contract is different here.
--
-- LIFECYCLE: two independent flags, modelled on `announcements.is_active`.
--   is_active + closed_at is null  → members answer
--   is_active + closed_at set      → members see the final result, read-only
--   not is_active                  → hidden from members entirely
--
-- Polls are NOT tied to a week. They outlive one, and nothing here touches
-- weeks, votes or weekly_results.
--
-- Options are immutable once the poll exists, the same one-shot contract posts
-- have: renaming an option after people have answered would silently rewrite
-- what they agreed to. Got it wrong? Close it and make another.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- tables --
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (char_length(btrim(question)) between 1 and 200),
  is_multi   boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create index if not exists polls_active on public.polls (is_active, created_at desc);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls(id) on delete cascade,
  label    text not null check (char_length(btrim(label)) between 1 and 80),
  position int  not null,
  unique (poll_id, position)
);
create index if not exists poll_options_poll on public.poll_options (poll_id, position);

-- poll_id is denormalised so "my answers to this poll" needs no join to
-- poll_options, and so RLS can gate on the parent without one either.
create table if not exists public.poll_answers (
  poll_id    uuid not null references public.polls(id) on delete cascade,
  option_id  uuid not null references public.poll_options(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, member_id)
);
create index if not exists poll_answers_poll on public.poll_answers (poll_id, member_id);

-- ------------------------------------------------------------------- rls --
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_answers enable row level security;

drop policy if exists polls_select        on public.polls;
drop policy if exists poll_options_select on public.poll_options;
drop policy if exists poll_answers_select on public.poll_answers;

-- Members see active polls only. Hidden ones are admin-visible through
-- admin_list_polls(), because there are deliberately no admin RLS policies.
create policy polls_select on public.polls
  for select to authenticated using (is_active);

create policy poll_options_select on public.poll_options
  for select to authenticated using (
    exists (select 1 from public.polls p where p.id = poll_id and p.is_active)
  );

-- `using (true)` on the parent's behalf: every member may read every answer,
-- names included. That is the point of a signed poll.
create policy poll_answers_select on public.poll_answers
  for select to authenticated using (
    exists (select 1 from public.polls p where p.id = poll_id and p.is_active)
  );

-- No insert/update/delete policy anywhere: every write goes through an RPC.
grant select on public.polls        to authenticated;
grant select on public.poll_options to authenticated;
grant select on public.poll_answers to authenticated;

-- -------------------------------------------------------------- member rpc --
-- Replaces your whole answer set for one poll, atomically.
--
-- This is server-side because "at most one option, unless a flag on the parent
-- row says otherwise" is not expressible as a constraint, and a client-side
-- delete-then-insert can half-fail and leave you with no answer at all.
-- An empty array clears your answer, mirroring cast_vote(null).
create or replace function public.answer_poll(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_multi  boolean;
  v_count  int := coalesce(array_length(p_option_ids, 1), 0);
begin
  select p.is_multi into v_multi
    from public.polls p
   where p.id = p_poll_id and p.is_active and p.closed_at is null;
  if not found then
    raise exception 'poll_closed' using errcode = '22023';
  end if;

  if not v_multi and v_count > 1 then
    raise exception 'single_choice_only' using errcode = '22023';
  end if;

  -- Every option must belong to THIS poll — otherwise a crafted call could
  -- stuff an answer into an unrelated poll.
  if exists (
    select 1 from unnest(p_option_ids) as oid
     where not exists (
       select 1 from public.poll_options o
        where o.id = oid and o.poll_id = p_poll_id)
  ) then
    raise exception 'bad_option' using errcode = '22023';
  end if;

  delete from public.poll_answers
   where poll_id = p_poll_id and member_id = v_member;

  if v_count > 0 then
    insert into public.poll_answers (poll_id, option_id, member_id)
    select p_poll_id, oid, v_member
      from unnest(p_option_ids) as oid
    on conflict do nothing;
  end if;
end $$;

-- --------------------------------------------------------------- admin rpc --
create or replace function public.admin_create_poll(
  p_question text, p_options text[], p_is_multi boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := public.require_admin();
  v_id    uuid;
  v_clean text[];
begin
  -- Blank lines are how a textarea says "nothing here"; drop them and keep
  -- the author's order as the option order.
  select array_agg(btrim(t.o) order by t.ord)
    into v_clean
    from unnest(p_options) with ordinality as t(o, ord)
   where btrim(t.o) <> '';

  if v_clean is null or array_length(v_clean, 1) < 2 then
    raise exception 'too_few_options' using errcode = '22023';
  end if;
  if array_length(v_clean, 1) > 10 then
    raise exception 'too_many_options' using errcode = '22023';
  end if;

  insert into public.polls (question, is_multi)
  values (btrim(p_question), coalesce(p_is_multi, false))
  returning id into v_id;

  insert into public.poll_options (poll_id, label, position)
  select v_id, t.o, t.ord from unnest(v_clean) with ordinality as t(o, ord);

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'poll_created', jsonb_build_object(
    'poll_id', v_id, 'question', btrim(p_question),
    'is_multi', coalesce(p_is_multi, false), 'options', to_jsonb(v_clean)));

  return v_id;
end $$;

-- Null arguments mean "leave unchanged", like admin_set_week.
-- p_closed true closes it (keeping the original close time if already closed),
-- false reopens it for answers.
create or replace function public.admin_set_poll(
  p_poll_id uuid,
  p_is_active boolean default null,
  p_closed boolean default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin();
begin
  update public.polls set
    is_active = coalesce(p_is_active, is_active),
    closed_at = case
                  when p_closed is null then closed_at
                  when p_closed        then coalesce(closed_at, now())
                  else null
                end
   where id = p_poll_id;

  if not found then
    raise exception 'unknown_poll' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'poll_updated', jsonb_build_object(
    'poll_id', p_poll_id, 'is_active', p_is_active, 'closed', p_closed));
end $$;

-- Deletes the options and answers with it. The question and the final tally go
-- into the audit log first, so the record survives the row.
create or replace function public.admin_delete_poll(p_poll_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_admin(); v_detail jsonb;
begin
  select jsonb_build_object(
           'poll_id', p.id, 'question', p.question,
           'results', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'label', o.label,
                      'count', (select count(*) from public.poll_answers a
                                 where a.option_id = o.id)
                    ) order by o.position), '[]'::jsonb)
             from public.poll_options o where o.poll_id = p.id))
    into v_detail
    from public.polls p where p.id = p_poll_id;

  if v_detail is null then
    raise exception 'unknown_poll' using errcode = '22023';
  end if;

  delete from public.polls where id = p_poll_id;

  insert into public.audit_log (actor_id, action, detail)
  values (v_actor, 'poll_deleted', v_detail);
end $$;

-- Everything, including hidden polls, with counts. Admin only by construction:
-- the RLS policies above cannot see an inactive poll, so this RPC is the only
-- door to one.
create or replace function public.admin_list_polls()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();

  return coalesce((
    -- `payload`, not `row`: ROW is a Postgres keyword and a poor column alias.
    select jsonb_agg(t.payload order by t.created_at desc)
    from (
      select p.created_at,
             jsonb_build_object(
               'id', p.id,
               'question', p.question,
               'is_multi', p.is_multi,
               'is_active', p.is_active,
               'created_at', p.created_at,
               'closed_at', p.closed_at,
               'answered_by', (select count(distinct a.member_id)
                                 from public.poll_answers a where a.poll_id = p.id),
               'options', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'id', o.id, 'label', o.label, 'position', o.position,
                          'count', (select count(*) from public.poll_answers a
                                     where a.option_id = o.id)
                        ) order by o.position), '[]'::jsonb)
                 from public.poll_options o where o.poll_id = p.id)
             ) as payload
      from public.polls p
    ) t
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------- privileges --
revoke all on function public.answer_poll(uuid, uuid[])                from public, anon;
revoke all on function public.admin_create_poll(text, text[], boolean) from public, anon;
revoke all on function public.admin_set_poll(uuid, boolean, boolean)   from public, anon;
revoke all on function public.admin_delete_poll(uuid)                  from public, anon;
revoke all on function public.admin_list_polls()                       from public, anon;

grant execute on function public.answer_poll(uuid, uuid[])                to authenticated;
grant execute on function public.admin_create_poll(text, text[], boolean) to authenticated;
grant execute on function public.admin_set_poll(uuid, boolean, boolean)   to authenticated;
grant execute on function public.admin_delete_poll(uuid)                  to authenticated;
grant execute on function public.admin_list_polls()                       to authenticated;

-- -------------------------------------------------------------- realtime --
-- Safe here in a way `votes` never is: these rows carry no secret.
do $$
declare t text;
begin
  foreach t in array array['polls', 'poll_options', 'poll_answers'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
