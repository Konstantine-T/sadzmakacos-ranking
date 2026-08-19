-- ============================================================================
-- A rank notice must never name a rank you do not hold.
--
-- THE BUG. emit_rank_notices() (20260819000200_notifications.sql) treated its
-- 30-minute cooldown as a DROP rather than a DELAY:
--
--     where lr.rank <> s.last_rank
--       and s.notified_at < now() - interval '30 minutes'
--
-- A vote landing inside that window wrote no notice AND left last_rank
-- pointing at the rank the member was last told. The line already sitting in
-- their bell went on asserting a position they had lost, and nothing re-ran
-- until somebody else happened to vote after the window expired — if that was
-- the last vote of the week, nobody ever did.
--
-- Reported from the group: a member on #7 was downvoted to #10 while his bell
-- kept reading "ახლა #6 ხარ (იყავი #7)". Both numbers had been true; neither
-- was true any more. supabase/tests/rank_notices.sql pins the case down.
--
-- Every other notification kind is an EVENT — somebody reacted, somebody
-- posted — and an event stays true forever. A rank notice is the one line in
-- the app written in the present tense, and the member reads it while looking
-- at the board. So it cannot be left standing once it stops being true.
--
-- THE FIX. Stop suppressing the second move and rewrite the first line
-- instead. This is not a new idea in this schema — notify_attention() already
-- folds repeat reactions into the most recent UNREAD row rather than stacking
-- them. Rank notices now do the same thing, with one difference: a reaction
-- row counts up (tally 1 → 2 → 3) because each reaction is its own event,
-- while a rank row moves its DESTINATION (rank_to 6 → 10) because there is
-- only ever one fact to state.
--
--   standing unread line?  ->  rewrite rank_to, keep rank_from and created_at
--   no line?               ->  open one
--   rewritten back to its own rank_from?  ->  delete it, that is not news
--
-- The cooldown then has nothing left to do, so it is gone. It existed to stop
-- eight votes producing eight notices; coalescing gives that for free, and a
-- member can now never hold more than one unread rank line at a time. Because
-- nothing is dropped any more, no flush job is needed to catch what a cooldown
-- swallowed.
--
-- created_at is deliberately NOT refreshed on a rewrite. The line is a
-- correction to something the member has not read yet, not a new event, so it
-- keeps its place in the feed instead of jumping to the top and re-lighting a
-- bell that is already lit. (notify_attention does refresh it — there, a fresh
-- burst of reactions genuinely is new news.)
--
-- Unchanged: the baseline seeding, so the opening ballot of a week still
-- notifies nobody; live_ranks(), so the four copies of the ranking rule still
-- agree; and the anonymity contract — this function reads aggregates only and
-- never touches voter identity.
-- ============================================================================

begin;

create or replace function public.emit_rank_notices(p_week int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_seeded int;
begin
  -- BASELINE SEEDING, verbatim from migration 20260819000200.
  --
  -- Everyone starts a week tied at #1, so the first ballot splits the entire
  -- board at once; without a silent baseline that single vote would notify all
  -- twenty members. New members are seeded quietly and only hear about their
  -- SECOND state.
  --
  -- It also has to stay the FIRST statement for a second reason. ON CONFLICT
  -- makes it wait on any concurrent transaction still holding these rows, so
  -- two members voting at the same moment are serialised here, before either
  -- reads a rank. Without that barrier the second voter would compute the
  -- board from a snapshot that predates the first voter's ballot and announce
  -- a position nobody ever held.
  insert into public.rank_notice_state (week_id, member_id, last_rank)
  select p_week, lr.member_id, lr.rank
    from public.live_ranks(p_week) lr
  on conflict (week_id, member_id) do nothing;

  -- A rank line from a week that has ended is the same lie in slower motion:
  -- "ახლა #6 ხარ" about a board nobody can see any more, and tapping it lands
  -- on the new week where everyone is tied at #1. Every other kind survives a
  -- week close intact, because a reaction that happened stays happened.
  --
  -- Seeding only touches rows on the first ballot of a week (and when a member
  -- is activated mid-week), so this runs about once a week rather than once a
  -- vote. `is distinct from` rather than `<>` so a row with no week at all —
  -- which nothing writes, but which would be just as meaningless — goes too.
  get diagnostics v_seeded = row_count;
  if v_seeded > 0 then
    delete from public.notifications
     where kind = 'rank' and week_id is distinct from p_week;
  end if;

  -- One statement, so `moved` is evaluated exactly once and the four writes
  -- below cannot disagree about what changed. The three notification branches
  -- are disjoint by construction — a member is in exactly one of them — which
  -- is what makes it safe for them to touch the same table.
  with moved as (
    select lr.member_id,
           lr.rank    as new_rank,
           s.last_rank
      from public.live_ranks(p_week) lr
      join public.rank_notice_state s
        on s.week_id = p_week and s.member_id = lr.member_id
     where lr.rank <> s.last_rank
  ),

  -- The line already in the member's bell that they have not read yet, if any.
  -- Same visibility test as unread_counts() and notify_attention(): a row is
  -- unread when it postdates the cursor for its kind.
  standing as (
    select m.member_id, m.new_rank, n.id as notice_id, n.rank_from
      from moved m
      join lateral (
        select n2.id, n2.rank_from
          from public.notifications n2
          left join public.notification_reads r
                 on r.member_id = n2.recipient_id and r.kind = n2.kind
         where n2.kind         = 'rank'
           and n2.recipient_id = m.member_id
           and n2.week_id      = p_week
           and (r.read_at is null or n2.created_at > r.read_at)
         order by n2.created_at desc, n2.id desc
         limit 1
      ) n on true
  ),

  -- 1. Correct the standing line in place. rank_from is left alone: it is
  --    where the member was when this line opened, which is still the honest
  --    start of the move they are being told about.
  corrected as (
    update public.notifications n
       set rank_to = s.new_rank
      from standing s
     where n.id = s.notice_id
       and s.rank_from is distinct from s.new_rank
    returning 1
  ),

  -- 2. Drifted out and came back. "ახლა #7 ხარ (იყავი #7)" is not news, and
  --    leaving it would light the bell for a week that did not move.
  withdrawn as (
    delete from public.notifications n
     using standing s
     where n.id = s.notice_id
       and s.rank_from is not distinct from s.new_rank
    returning 1
  ),

  -- 3. Nothing standing — either they have never moved this week or they have
  --    read the last line. Either way this is genuinely new, so it opens a row
  --    of its own and lights the bell.
  opened as (
    insert into public.notifications (kind, recipient_id, week_id, rank_from, rank_to)
    select 'rank', m.member_id, p_week, m.last_rank, m.new_rank
      from moved m
     where not exists (select 1 from standing s where s.member_id = m.member_id)
    returning 1
  )

  -- 4. Record what the member has now been shown. This runs for every moved
  --    member including the withdrawn ones, so last_rank always equals the
  --    number currently in front of them — leave it behind and the NEXT notice
  --    inherits the stale value as its "იყავი #…".
  update public.rank_notice_state s
     set last_rank = m.new_rank, notified_at = now()
    from moved m
   where s.week_id = p_week and s.member_id = m.member_id;
end $$;

-- Internal only, as before: called by cast_vote, never by a client. CREATE OR
-- REPLACE keeps the existing ACL, but the revoke is repeated so this file is
-- correct run on its own.
revoke execute on function public.emit_rank_notices(int) from public, anon, authenticated;

commit;
