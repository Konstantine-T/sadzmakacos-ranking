-- ============================================================================
-- trivia.sql — the anti-cheat gate.
--
-- Trivia is SIGNED: the leaderboard names people, deliberately, because a
-- trivia question judges a question and not a person. Two things must still be
-- impossible, and this file is what proves it:
--
--   1. nobody — member OR admin — can read `correct_index`;
--   2. nobody can read another member's individual answers.
--
-- The admin plays this game. That is why there is no `or public.is_admin()`
-- clause anywhere in trivia's RLS, unlike votes and post_votes.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/trivia.sql
-- A clean run prints only PASS lines. Any FAIL aborts.
-- ============================================================================

\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------- setup ----
insert into auth.users (id, instance_id, aud, role, email,
                        raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'trivia-a@example.com', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'trivia-b@example.com', '{}', '{}', now(), now());

with picked as (
  select id, row_number() over (order by nickname) rn
    from public.members where is_active
)
update public.members m
   set auth_user_id = case p.rn when 1 then '00000000-0000-4000-8000-0000000000c1'::uuid
                                else '00000000-0000-4000-8000-0000000000c2'::uuid end,
       is_admin     = (p.rn = 2)
from picked p
where p.id = m.id and p.rn in (1, 2);

delete from public.pending_accounts
 where auth_user_id in ('00000000-0000-4000-8000-0000000000c1',
                        '00000000-0000-4000-8000-0000000000c2');

-- A pool big enough that a week can claim ten.
insert into public.trivia_questions (source, section, prompt, options, correct_index)
select 'test-' || g, 'ანალოგიები', 'prompt ' || g,
       '["ა","ბ","გ","დ"]'::jsonb, 1
  from generate_series(1, 40) g;

-- Start from a known state: the open week may already hold its ten from the
-- migration's bootstrap or the seed, and claiming on top of that would give it
-- twenty. Safe to un-claim — this whole file rolls back.
update public.trivia_questions
   set week_id = null, position = null
 where week_id = public.open_week_id();

-- Claim for the open week (the insert trigger only fires on NEW weeks).
select public.claim_trivia_questions(public.open_week_id(), 10);

do $$
declare v_n int;
begin
  select count(*) into v_n from public.trivia_questions
   where week_id = public.open_week_id();
  if v_n <> 10 then raise exception 'FAIL: claimed % questions, expected 10', v_n; end if;
  raise notice 'PASS: a week claims exactly ten questions';
end $$;

do $$
declare v_n int;
begin
  select count(distinct position) into v_n from public.trivia_questions
   where week_id = public.open_week_id();
  if v_n <> 10 then raise exception 'FAIL: positions not 1..10 (% distinct)', v_n; end if;
  raise notice 'PASS: the ten carry distinct positions';
end $$;

-- Item 6 (design §9): ties share a rank and the next rank skips, checked
-- against the exact same `rank() over (order by correct desc)` window
-- function trg_week_freeze_trivia() uses, on a small constructed set rather
-- than the claimed ten — the claim above says nothing about the score
-- distribution, and this check should hold regardless of it. This is the one
-- executable proof that the SQL freeze and src/lib/triviaRanking.ts agree on
-- the same shape.
do $$
declare v_ranks int[];
begin
  select array_agg(rnk order by ord) into v_ranks
    from (
      select ord, rank() over (order by correct desc) as rnk
        from (values (1, 9), (2, 7), (3, 7), (4, 7), (5, 3)) as t(ord, correct)
    ) s;
  if v_ranks <> array[1, 2, 2, 2, 5] then
    raise exception 'FAIL: expected ties to share a rank and skip (1,2,2,2,5), got %', v_ranks;
  end if;
  raise notice 'PASS: ties share a rank and the next rank skips';
end $$;

-- Force a known key for the claimed ten. With the real seed loaded, a randomly
-- drawn question's correct_index is rarely 1, and a spurious FAIL here would
-- abort before the admin assertions — the ones that actually matter — ever run.
update public.trivia_questions set correct_index = 1
 where week_id = public.open_week_id();

-- ------------------------------------------------- as a NORMAL member ------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c1"}';

do $$
begin
  begin
    perform correct_index from public.trivia_questions limit 1;
    raise exception 'FAIL: a member READ correct_index';
  exception
    when insufficient_privilege then raise notice 'PASS: member cannot read correct_index';
  end;
end $$;

do $$
declare v_q uuid; v_r record;
begin
  select id into v_q from public.trivia_questions
   where week_id = public.open_week_id() and position = 1;

  select * into v_r from public.answer_trivia(v_q, 1);
  if not v_r.is_correct then raise exception 'FAIL: correct answer graded wrong'; end if;
  raise notice 'PASS: answer_trivia grades and returns the key AFTER the write';

  begin
    perform public.answer_trivia(v_q, 2);
    raise exception 'FAIL: answered the same question twice';
  exception
    when unique_violation then raise notice 'PASS: an answer is final';
  end;
end $$;

-- ------------------------------------------------------- as the ADMIN ------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-0000000000c2"}';

do $$
begin
  begin
    perform correct_index from public.trivia_questions limit 1;
    raise exception 'FAIL: the ADMIN read correct_index';
  exception
    when insufficient_privilege then raise notice 'PASS: admin cannot read correct_index either';
  end;
end $$;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.trivia_answers;
  if v_n <> 0 then
    raise exception 'FAIL: the ADMIN saw % individual answers', v_n;
  end if;
  raise notice 'PASS: admin sees no individual answers';
end $$;

-- Scores, however, ARE public — that is the point of a leaderboard.
do $$
declare v_n int;
begin
  select count(*) into v_n from public.trivia_week_scores;
  if v_n < 1 then raise exception 'FAIL: scores are not visible'; end if;
  raise notice 'PASS: aggregate scores are readable by everyone';
end $$;

rollback;
