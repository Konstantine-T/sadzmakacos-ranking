-- ============================================================================
-- rank_notices.sql — a rank notice must never name a rank you do not hold.
--
-- A rank notification is not a record of something that happened, the way a
-- reaction is. It is a claim about the present tense: "ახლა #6 ხარ". The member
-- reads it while looking at the board, so the two have to agree or the app is
-- lying to them in Georgian.
--
-- The bug this file pins down: emit_rank_notices() used to treat its 30-minute
-- cooldown as a DROP rather than a DELAY. A vote landing inside another
-- member's cooldown window wrote no notice AND left rank_notice_state pointing
-- at the rank they were last told, so the newest line in their bell went on
-- asserting a position they had already lost. Nothing re-ran until somebody
-- else happened to vote after the window expired — and if that was the last
-- vote of the week, nobody ever did.
--
-- Builds its own board inside the transaction and ends in ROLLBACK.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rank_notices.sql
-- ============================================================================

\set ON_ERROR_STOP on
begin;

-- ============================ FIXTURE =======================================
-- A board with a four-way tie, so a single downvote can move somebody several
-- rank numbers at once — the shape that made the original report legible:
-- #7 becomes #10, not #8.
--
--   net  8  7  6  5  4  3 | 2  2  2  2 | 1  1  0 …
--   rank 1  2  3  4  5  6 | 7  7  7  7 | 11 11 13 …
--                           ^ the friend
do $$
declare
  v_week    int := public.open_week_id();
  v_members int;
begin
  if v_week is null then
    raise exception 'FIXTURE: no open week';
  end if;

  select count(*) into v_members from public.members where is_active;
  if v_members < 12 then
    raise exception 'FIXTURE: needs at least 12 active members, found %', v_members;
  end if;

  delete from public.votes where week_id = v_week;
end $$;

create temp table t_board on commit drop as
select m.id as member_id,
       m.nickname,
       row_number() over (order by m.nickname) as seat
  from public.members m
 where m.is_active;

-- Seat 7 is the friend: first row of the four-way tie on net 2.
create temp table t_target on commit drop as
select b.member_id, b.nickname, b.seat,
       case b.seat
         when 1 then 8 when 2 then 7 when 3 then 6 when 4 then 5
         when 5 then 4 when 6 then 3
         when 7 then 2 when 8 then 2 when 9 then 2 when 10 then 2
         when 11 then 1 when 12 then 1
         else 0
       end as net
  from t_board b;

do $$
declare r record; v_week int := public.open_week_id(); v_voter uuid; v_cast int;
begin
  for r in select * from t_target where net <> 0 loop
    v_cast := 0;
    for v_voter in select member_id from t_board
                    where member_id <> r.member_id order by seat loop
      exit when v_cast >= abs(r.net);
      insert into public.votes (week_id, voter_id, target_id, value)
      values (v_week, v_voter, r.member_id, case when r.net > 0 then 1 else -1 end);
      v_cast := v_cast + 1;
    end loop;
  end loop;
end $$;

-- The two members who will vote during the test. Freeing their ballots here,
-- as postgres, keeps cast_vote's own bookkeeping out of the arrangement.
create temp table t_actor on commit drop as
select b.member_id, b.nickname,
       row_number() over (order by b.seat desc) as n
  from t_board b
 where b.seat > 12;

-- cast_vote resolves the voter from auth.uid(), and a dev-seeded member has no
-- Google account behind it. Give the two actors one for the length of the
-- transaction — every write below then goes through the real RPC as a real
-- signed-in member rather than around it.
insert into auth.users (id, instance_id, aud, role, email,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rank-a@example.com', '{}', '{}', now(), now()),
       ('00000000-0000-4000-8000-00000000d002', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rank-b@example.com', '{}', '{}', now(), now());

delete from public.pending_accounts
 where auth_user_id in ('00000000-0000-4000-8000-00000000d001',
                        '00000000-0000-4000-8000-00000000d002');

update public.members m set auth_user_id = '00000000-0000-4000-8000-00000000d001'
 where m.id = (select member_id from t_actor where n = 1);
update public.members m set auth_user_id = '00000000-0000-4000-8000-00000000d002'
 where m.id = (select member_id from t_actor where n = 2);

do $$
declare v_week int := public.open_week_id();
begin
  delete from public.votes v
   where v.week_id = v_week
     and v.voter_id in (select member_id from t_actor where n <= 2)
     and v.target_id in (select member_id from t_target where seat in (6, 7));
end $$;

-- Everyone has already been told where they stand, half an hour ago. This is
-- the steady state the app spends the week in.
delete from public.notifications where kind = 'rank';
delete from public.rank_notice_state where week_id = public.open_week_id();

insert into public.rank_notice_state (week_id, member_id, last_rank, notified_at)
select public.open_week_id(), lr.member_id, lr.rank, now() - interval '2 hours'
  from public.live_ranks(public.open_week_id()) lr;

-- ============================ THE REPORTED BUG ==============================
-- Two votes in quick succession — the second one lands well inside the
-- cooldown the first one started.
do $$
declare
  v_week   int  := public.open_week_id();
  v_friend uuid := (select member_id from t_target where seat = 7);
  v_above  uuid := (select member_id from t_target where seat = 6);
  v_a      uuid := (select member_id from t_actor where n = 1);
  v_b      uuid := (select member_id from t_actor where n = 2);
  v_rank   int;
  v_told   int;
  v_from   int;
  v_rows   int;
  v_state  int;
begin
  -- 1. Somebody downvotes the member directly above the friend. The friend
  --    climbs without being touched, and is told so.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_a),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_above, -1);

  select n.rank_to into v_told
    from public.notifications n
   where n.kind = 'rank' and n.recipient_id = v_friend
   order by n.created_at desc, n.id desc limit 1;

  select lr.rank into v_rank from public.live_ranks(v_week) lr
   where lr.member_id = v_friend;

  if v_told is distinct from v_rank then
    raise exception 'FAIL: first notice said #% but the board says #%', v_told, v_rank;
  end if;
  raise notice 'PASS: the friend was told #%, and holds #%', v_told, v_rank;

  -- 2. Minutes later, someone downvotes the friend himself. He falls several
  --    places at once, out of the tie and past it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_b),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_friend, -1);

  select lr.rank into v_rank from public.live_ranks(v_week) lr
   where lr.member_id = v_friend;

  select n.rank_to, n.rank_from into v_told, v_from
    from public.notifications n
   where n.kind = 'rank' and n.recipient_id = v_friend
   order by n.created_at desc, n.id desc limit 1;

  -- THE ASSERTION THIS FILE EXISTS FOR.
  if v_told is distinct from v_rank then
    raise exception
      'FAIL: newest notice claims #% (from #%) but the friend actually holds #%',
      v_told, v_from, v_rank;
  end if;
  raise notice 'PASS: after a suppressed move the notice still names #%', v_rank;

  -- The collapse must survive the correction: one line in the bell, not two.
  select count(*) into v_rows
    from public.notifications n
   where n.kind = 'rank' and n.recipient_id = v_friend;
  if v_rows <> 1 then
    raise exception 'FAIL: % unread rank notices, expected exactly 1', v_rows;
  end if;
  raise notice 'PASS: a burst still collapses to one unread rank notice';

  -- And the movement it describes has to be a real one: he was #7 when the
  -- burst started and is #10 now, so that is the pair the line must show.
  if v_from is distinct from 7 then
    raise exception 'FAIL: notice reads "was #%", but the burst started at #7', v_from;
  end if;
  raise notice 'PASS: the line reads #% -> #%, which is what happened', v_from, v_told;

  -- The bookkeeping must agree, or the NEXT notice inherits the lie.
  select s.last_rank into v_state from public.rank_notice_state s
   where s.week_id = v_week and s.member_id = v_friend;
  if v_state is distinct from v_rank then
    raise exception 'FAIL: rank_notice_state says % but the friend holds %',
      v_state, v_rank;
  end if;
  raise notice 'PASS: rank_notice_state tracks what the member was actually shown';
end $$;

-- ============================ MOVED AND CAME BACK ===========================
-- A member who drifts away and returns to the rank their standing notice
-- opened at has nothing to be told. The line must not survive saying
-- "ახლა #7 ხარ (იყავი #7)".
do $$
declare
  v_week   int  := public.open_week_id();
  v_friend uuid := (select member_id from t_target where seat = 7);
  v_above  uuid := (select member_id from t_target where seat = 6);
  v_a      uuid := (select member_id from t_actor where n = 1);
  v_b      uuid := (select member_id from t_actor where n = 2);
  v_rank   int; v_rows int; v_state int;
begin
  -- Undo BOTH ballots from the previous block, restoring the board exactly as
  -- it stood when the friend's standing line opened at #7. Only then is he
  -- back at the line's own rank_from, which is what the withdrawal turns on.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_b),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_friend, null);

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_a),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_above, null);

  select lr.rank into v_rank from public.live_ranks(v_week) lr
   where lr.member_id = v_friend;
  if v_rank <> 7 then
    raise exception 'FIXTURE: expected the friend back at #7, found #%', v_rank;
  end if;

  select count(*) into v_rows from public.notifications
   where kind = 'rank' and recipient_id = v_friend;
  if v_rows <> 0 then
    raise exception
      'FAIL: % rank line(s) left standing after the week returned to #7', v_rows;
  end if;

  select s.last_rank into v_state from public.rank_notice_state s
   where s.week_id = v_week and s.member_id = v_friend;
  if v_state is distinct from 7 then
    raise exception 'FAIL: rank_notice_state says % after returning to #7', v_state;
  end if;
  raise notice 'PASS: returning to where you started withdraws the line entirely';
end $$;

-- ============================ READ, THEN MOVED ==============================
-- Once the member has read the line, the next move is genuinely new and earns
-- a row of its own rather than silently rewriting something they have already
-- seen. Asserted on the rows themselves rather than on the unread predicate:
-- created_at defaults to now(), which is frozen for the whole transaction, so
-- inside one test nothing can ever sort as later than a cursor set with now().
do $$
declare
  v_week   int  := public.open_week_id();
  v_friend uuid := (select member_id from t_target where seat = 7);
  v_a      uuid := (select member_id from t_actor where n = 1);
  v_rank   int; v_told int; v_from int; v_rows int;
begin
  -- Open a line: the friend drops out of the tie again.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_a),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_friend, -1);

  select count(*) into v_rows from public.notifications
   where kind = 'rank' and recipient_id = v_friend;
  if v_rows <> 1 then
    raise exception 'FAIL: expected one standing line to read, found %', v_rows;
  end if;

  -- He opens the bell. read_at = now() = the row's created_at, and the
  -- unread test is strictly greater, so the line now counts as read.
  insert into public.notification_reads (member_id, kind, read_at)
  values (v_friend, 'rank', now())
  on conflict (member_id, kind) do update set read_at = excluded.read_at;

  -- And then he moves again.
  perform public.cast_vote(v_friend, null);

  select lr.rank into v_rank from public.live_ranks(v_week) lr
   where lr.member_id = v_friend;

  select count(*) into v_rows from public.notifications
   where kind = 'rank' and recipient_id = v_friend;

  select n.rank_to, n.rank_from into v_told, v_from
    from public.notifications n
   where n.kind = 'rank' and n.recipient_id = v_friend
   order by n.id desc limit 1;

  if v_rows <> 2 then
    raise exception
      'FAIL: % rank rows — a read line must be left alone, not rewritten', v_rows;
  end if;
  if v_told is distinct from v_rank then
    raise exception 'FAIL: fresh notice says #% but the board says #%', v_told, v_rank;
  end if;
  raise notice 'PASS: a move after reading opens a new line, #% -> #%', v_from, v_told;
end $$;

-- ============================ BASELINE SILENCE ==============================
-- Everyone starts a week tied at #1, so the first ballot splits the whole
-- board at once. Members are seeded quietly and only hear about their SECOND
-- state — otherwise one vote notifies twenty people.
do $$
declare
  v_week int := public.open_week_id();
  v_a    uuid := (select member_id from t_actor where n = 1);
  v_t    uuid := (select member_id from t_target where seat = 3);
  v_rows int;
begin
  delete from public.votes where week_id = v_week;
  delete from public.notifications where kind = 'rank';
  delete from public.rank_notice_state where week_id = v_week;

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_a),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_t, 1);

  select count(*) into v_rows from public.notifications where kind = 'rank';
  if v_rows <> 0 then
    raise exception 'FAIL: the first vote of the week wrote % rank notices', v_rows;
  end if;
  raise notice 'PASS: the opening ballot of a week notifies nobody';
end $$;

-- ============================ LAST WEEK'S LINE ==============================
-- "ახლა #6 ხარ" is written in the present tense. Once the week it described
-- has ended it is no longer about anything, and tapping it lands on a board
-- where everyone is tied at #1.
do $$
declare
  v_week int  := public.open_week_id();
  v_a    uuid := (select member_id from t_actor where n = 1);
  v_t    uuid := (select member_id from t_target where seat = 4);
  v_old  int; v_rows int; v_kept int;
begin
  delete from public.votes where week_id = v_week;
  delete from public.notifications;
  delete from public.rank_notice_state where week_id = v_week;

  -- A leftover from a week that has since closed, plus an event-shaped row
  -- from the same week, which must NOT be swept up with it.
  insert into public.weeks (starts_at, ends_at, status, closed_at)
  values (now() - interval '14 days', now() - interval '7 days', 'closed', now())
  returning id into v_old;

  insert into public.notifications (kind, recipient_id, week_id, rank_from, rank_to)
  values ('rank', v_t, v_old, 4, 2);
  insert into public.notifications (kind, recipient_id, week_id, emoji)
  values ('reaction', v_t, v_old, '🔥');

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select auth_user_id from public.members where id = v_a),
                      'role', 'authenticated')::text, true);
  perform public.cast_vote(v_t, 1);

  select count(*) into v_rows from public.notifications
   where kind = 'rank' and week_id = v_old;
  select count(*) into v_kept from public.notifications
   where kind = 'reaction' and week_id = v_old;

  if v_rows <> 0 then
    raise exception 'FAIL: % rank line(s) survived from a closed week', v_rows;
  end if;
  if v_kept <> 1 then
    raise exception 'FAIL: a reaction from a closed week was swept up too';
  end if;
  raise notice 'PASS: a closed week takes its rank lines with it, and only those';
end $$;

rollback;
