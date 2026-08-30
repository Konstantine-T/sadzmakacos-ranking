-- ============================================================================
-- ტრივია — a second scoreboard, unrelated to votes.
--
-- The group wanted something to argue about that is not each other. So: ten
-- ზოგადი უნარები questions a week, answered once, graded instantly, ranked on
-- correct answers alone.
--
-- WHY THIS DOES NOT BREAK RULE 1. A leaderboard is signed by definition. That
-- is acceptable here for the same reason polls are signed: a trivia question
-- judges a QUESTION, not a person. Scoring 4/10 is a fact about you and a
-- sequence puzzle, not the group's opinion of you. Two boundaries still hold:
--
--   * scores are public, individual answers are not. `trivia_answers` is
--     select-own and the boards read aggregate views;
--   * the answer key never reaches any client.
--
-- Note what is deliberately ABSENT: `trivia_answers_select_own` carries no
-- `or public.is_admin()` clause, unlike `votes_select_own` and
-- `post_votes_select_own`. The admin plays this game. A door into everyone's
-- answers would be a cheat sheet as well as a privacy hole.
--
-- THE ANSWER KEY. `correct_index` is withheld by a COLUMN-level GRANT, the same
-- mechanism that keeps members out of `members.is_admin` — RLS cannot say "you
-- may read this row but not that column". Grading happens in answer_trivia(),
-- which returns the key only AFTER your answer is committed. Otherwise devtools
-- is a cheat sheet.
--
-- WHY TRIGGERS AND NOT close_current_week(). That function already creates the
-- next week, but this repo's convention is that a later migration REDEFINES a
-- function rather than patching it — so adding one statement would mean copying
-- ~200 lines of unrelated week-close logic, and the two copies would drift. Two
-- triggers on `weeks` touch nothing that exists and cover every path that makes
-- or closes a week: cron, forced close, bootstrap.
--
-- WHAT DID NOT CHANGE. No question needs an image (the pool was filtered to
-- text-only during extraction), so there is no image_url and storage stays out
-- of this. Nothing here reads or writes `votes`, `weekly_results`, or the home
-- board's ranking. `is_paused` is the voting panic button and does not stop
-- trivia.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- tables --
create table if not exists public.trivia_questions (
  id            uuid primary key default gen_random_uuid(),
  source        text not null unique,          -- e.g. 2015-I-Q1; makes the seed idempotent
  section       text not null,                 -- ანალოგიები, ლოგიკა, … — drives the stratified draw
  prompt        text not null,
  options       jsonb not null,
  correct_index smallint not null,
  week_id       int references public.weeks(id) on delete set null,  -- null = unused
  position      smallint,
  created_at    timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array'),
  check (jsonb_array_length(options) between 2 and 6),
  check (correct_index >= 0 and correct_index < jsonb_array_length(options)),
  check (position is null or position between 1 and 10)
);

-- Nulls are distinct under a unique index, so unused rows do not collide.
create unique index if not exists trivia_questions_week_pos
  on public.trivia_questions (week_id, position);
create index if not exists trivia_questions_unused
  on public.trivia_questions (section) where week_id is null;

-- The primary key IS the "you cannot change your answer" rule.
create table if not exists public.trivia_answers (
  question_id  uuid not null references public.trivia_questions(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  week_id      int  not null references public.weeks(id) on delete cascade,
  choice_index smallint not null,
  is_correct   boolean not null,   -- denormalised so no aggregate touches correct_index
  created_at   timestamptz not null default now(),
  primary key (question_id, member_id)
);
create index if not exists trivia_answers_week_member
  on public.trivia_answers (week_id, member_id);

-- Rule 3: closed weeks are snapshots, never recomputed.
create table if not exists public.trivia_results (
  week_id   int not null references public.weeks(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  correct   int not null,
  answered  int not null,
  rank      int not null,
  primary key (week_id, member_id)
);
create index if not exists trivia_results_member on public.trivia_results (member_id);

-- Identity-free realtime ping, exactly like vote_events. `trivia_answers`
-- itself is never published: it is select-own, and streaming it would hand
-- every subscriber the per-question answers this migration keeps private.
create table if not exists public.trivia_events (
  id         bigint primary key generated always as identity,
  week_id    int not null,
  created_at timestamptz not null default now()
);
create index if not exists trivia_events_created on public.trivia_events (created_at);

-- ----------------------------------------------------------------- views --
-- Owned by postgres, security_invoker = off: a table owner is exempt from that
-- table's RLS, so these read every answer while their callers cannot. The only
-- thing crossing the boundary is a COUNT.
drop view if exists public.trivia_week_scores cascade;
create view public.trivia_week_scores as
select
  a.week_id,
  a.member_id,
  m.nickname,
  m.avatar_url,
  (count(*) filter (where a.is_correct))::int as correct,
  (count(*))::int                             as answered
from public.trivia_answers a
join public.members m on m.id = a.member_id
group by a.week_id, a.member_id, m.nickname, m.avatar_url;

alter view public.trivia_week_scores set (security_invoker = off);

drop view if exists public.trivia_totals cascade;
create view public.trivia_totals as
select
  m.id as member_id,
  m.nickname,
  m.avatar_url,
  (count(*) filter (where a.is_correct))::int as total_correct,
  (count(a.question_id))::int                 as total_answered,
  (count(distinct a.week_id))::int            as tests_taken
from public.members m
left join public.trivia_answers a on a.member_id = m.id
where m.is_active
group by m.id, m.nickname, m.avatar_url;

alter view public.trivia_totals set (security_invoker = off);

-- ------------------------------------------------------------------- rls --
alter table public.trivia_questions enable row level security;
alter table public.trivia_answers   enable row level security;
alter table public.trivia_results   enable row level security;
alter table public.trivia_events    enable row level security;

drop policy if exists trivia_questions_select   on public.trivia_questions;
drop policy if exists trivia_answers_select_own on public.trivia_answers;
drop policy if exists trivia_results_select     on public.trivia_results;
drop policy if exists trivia_events_select      on public.trivia_events;

-- Only questions belonging to a week that has already started. A future week's
-- ten are invisible even without their answers.
create policy trivia_questions_select on public.trivia_questions
  for select to authenticated using (
    week_id is not null and exists (
      select 1 from public.weeks w where w.id = week_id and w.starts_at <= now()
    )
  );

-- No `or public.is_admin()`. See the header.
create policy trivia_answers_select_own on public.trivia_answers
  for select to authenticated using (member_id = public.current_member_id());

create policy trivia_results_select on public.trivia_results
  for select to authenticated using (true);

create policy trivia_events_select on public.trivia_events
  for select to authenticated using (true);

-- ---------------------------------------------------------------- grants --
-- Migration 03 revoked everything from anon/authenticated; new tables need
-- their grants spelled out. THE COLUMN LIST IS THE ANTI-CHEAT BOUNDARY:
-- correct_index is not in it.
revoke all on public.trivia_questions from anon, authenticated;
revoke all on public.trivia_answers   from anon, authenticated;
revoke all on public.trivia_results   from anon, authenticated;
revoke all on public.trivia_events    from anon, authenticated;

grant select (id, week_id, position, section, prompt, options)
  on public.trivia_questions to authenticated;
grant select on public.trivia_answers     to authenticated;
grant select on public.trivia_results     to authenticated;
grant select on public.trivia_events      to authenticated;
grant select on public.trivia_week_scores to authenticated;
grant select on public.trivia_totals      to authenticated;

-- ------------------------------------------------------------ member rpc --
-- Server-side grading. Returns the key only after the answer is committed, so
-- the response cannot be read ahead. A repeat call violates the primary key.
create or replace function public.answer_trivia(p_question_id uuid, p_choice_index int)
returns table (correct_index smallint, is_correct boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_member  uuid := public.require_member();
  v_week    int;
  v_correct smallint;
  v_len     int;
begin
  select q.week_id, q.correct_index, jsonb_array_length(q.options)
    into v_week, v_correct, v_len
    from public.trivia_questions q
   where q.id = p_question_id;

  if not found then
    raise exception 'no_such_question' using errcode = '22023';
  end if;

  -- The open week is resolved HERE, never sent by a client (same rule as
  -- cast_vote). Answering last week's test is not a thing.
  if v_week is distinct from public.open_week_id() then
    raise exception 'week_closed' using errcode = '22023';
  end if;

  if p_choice_index < 0 or p_choice_index >= v_len then
    raise exception 'bad_choice' using errcode = '22023';
  end if;

  insert into public.trivia_answers (question_id, member_id, week_id, choice_index, is_correct)
  values (p_question_id, v_member, v_week, p_choice_index, p_choice_index = v_correct);

  insert into public.trivia_events (week_id) values (v_week);

  return query select v_correct, (p_choice_index = v_correct);
end $$;

-- --------------------------------------------------------- week lifecycle --
-- Draw p_count questions for a week, stratified by section.
--
-- A purely random ten would be eight maths questions often enough to matter —
-- the pool is 35% ამოცანები — and would stop feeling like a ზოგადი უნარები
-- test. So: floor each section's proportional share first, then top up at
-- random. Returns how many were actually claimed, which is less than p_count
-- once the pool runs low, and 0 when it is dry.
create or replace function public.claim_trivia_questions(p_week int, p_count int default 10)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_taken int := 0;
  v_more  int := 0;
begin
  select count(*) into v_total from public.trivia_questions where week_id is null;
  if v_total = 0 then return 0; end if;

  -- 1. proportional share per section, floored
  with pool as (
    select id, section,
           row_number() over (partition by section order by random()) as rn
      from public.trivia_questions
     where week_id is null
  ),
  quota as (
    select section, floor(count(*)::numeric * p_count / v_total)::int as n
      from public.trivia_questions
     where week_id is null
     group by section
  ),
  picked as (
    select p.id from pool p join quota q on q.section = p.section and p.rn <= q.n
  )
  update public.trivia_questions t
     set week_id = p_week
    from picked
   where t.id = picked.id;
  get diagnostics v_taken = row_count;

  -- 2. rounding always leaves a shortfall; fill it at random
  if v_taken < p_count then
    with fill as (
      select id from public.trivia_questions
       where week_id is null
       order by random()
       limit (p_count - v_taken)
    )
    update public.trivia_questions t
       set week_id = p_week
      from fill
     where t.id = fill.id;
    get diagnostics v_more = row_count;
    v_taken := v_taken + v_more;
  end if;

  -- 3. lay them out 1..n in random order
  update public.trivia_questions t
     set position = s.rn
    from (
      select id, row_number() over (order by random()) as rn
        from public.trivia_questions
       where week_id = p_week
    ) s
   where t.id = s.id;

  return v_taken;
end $$;

create or replace function public.trg_week_claim_trivia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.claim_trivia_questions(new.id, 10);
  return new;
end $$;

drop trigger if exists weeks_claim_trivia on public.weeks;
create trigger weeks_claim_trivia
after insert on public.weeks
for each row execute function public.trg_week_claim_trivia();

-- Freeze on close. Competition ranking on `correct` ALONE — ties share a rank
-- and the next rank skips. This must stay behaviourally identical to
-- src/lib/triviaRanking.ts.
create or replace function public.trg_week_freeze_trivia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trivia_results (week_id, member_id, correct, answered, rank)
  select s.week_id, s.member_id, s.correct, s.answered,
         rank() over (order by s.correct desc)
    from public.trivia_week_scores s
   where s.week_id = new.id
  on conflict (week_id, member_id) do update
     set correct  = excluded.correct,
         answered = excluded.answered,
         rank     = excluded.rank;
  return new;
end $$;

drop trigger if exists weeks_freeze_trivia on public.weeks;
create trigger weeks_freeze_trivia
after update on public.weeks
for each row when (old.status = 'open' and new.status = 'closed')
execute function public.trg_week_freeze_trivia();

-- ------------------------------------------------------------ admin count --
-- The only existing function this feature touches. The pool running dry should
-- be visible before it happens; there is deliberately no admin screen that can
-- PREVIEW a week's questions, because the admin plays.
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
                        where auth_user_id is null and is_active),
    'trivia_unused',  (select count(*) from public.trivia_questions where week_id is null)
  ) into v_out;

  return v_out;
end $$;

-- ----------------------------------------------------------------- grants --
revoke all on function public.answer_trivia(uuid, int)            from public, anon;
grant execute on function public.answer_trivia(uuid, int)         to authenticated;
revoke all on function public.admin_dashboard()                   from public, anon;
grant execute on function public.admin_dashboard()                to authenticated;

-- Nobody calls these from a client. The claim function in particular would
-- otherwise let a member burn the pool.
revoke execute on function public.claim_trivia_questions(int, int) from public, anon, authenticated;
revoke execute on function public.trg_week_claim_trivia()          from public, anon, authenticated;
revoke execute on function public.trg_week_freeze_trivia()         from public, anon, authenticated;

-- ------------------------------------------------------------ publication --
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'trivia_events'
  ) then
    execute 'alter publication supabase_realtime add table public.trivia_events';
  end if;
end $$;

-- ------------------------------------------------------------------ cron --
-- Keep the fan-out table bounded, alongside vote_events and score_events.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'prune-events') then
    perform cron.unschedule('prune-events');
  end if;
  perform cron.schedule('prune-events', '0 3 * * *',
    $c$
      delete from public.vote_events   where created_at < now() - interval '7 days';
      delete from public.score_events  where created_at < now() - interval '7 days';
      delete from public.trivia_events where created_at < now() - interval '7 days';
    $c$);
exception when others then
  raise notice 'pg_cron not available: %. Prune job unchanged.', sqlerrm;
end
$do$;

-- Give the CURRENT open week its ten. The insert trigger only fires for weeks
-- created from now on, and the week that is open right now already exists.
do $$
declare v_week int := public.open_week_id();
begin
  -- Guarded so the migration stays re-runnable: claiming twice would hand the
  -- open week twenty questions and trip the `position between 1 and 10` check.
  if v_week is not null
     and not exists (select 1 from public.trivia_questions where week_id = v_week)
  then
    perform public.claim_trivia_questions(v_week, 10);
  end if;
end $$;

commit;
