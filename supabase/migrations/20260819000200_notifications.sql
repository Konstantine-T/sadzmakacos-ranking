-- ============================================================================
-- In-app notifications and unread badges.
--
-- Three events earn a notification: a new post, your own rank moving, and
-- attention landing on you (a reaction, or a vote on your post). There is no
-- push and no email — those remain non-goals. This is a bell, a sheet, and a
-- count on a nav label, nothing more.
--
-- ANONYMITY (rule 1). A notification is an obvious place to leak identity, so
-- the boundary is a CHECK constraint rather than a convention:
--
--     check (actor_id is null or kind = 'post')
--
-- Post authorship is public — posts are signed and PostCard already shows the
-- author — so a 'post' row may name who wrote it. A reaction or a vote row
-- CANNOT PHYSICALLY STORE who did it. The database refuses the insert. This is
-- deliberate: the frontend copy says "ვიღაცამ", and if someone later edits that
-- copy to name a name, there is no name in the row to reach for.
--
-- No `or public.is_admin()` appears in any policy here, for the same reason it
-- was stripped from votes_select_own: an admin door is a door.
--
-- TIMING SIDE-CHANNEL, considered and accepted: a reaction notification tells
-- you the moment someone reacted. That timing is already public — score_events
-- fires on the same insert and every client refetches the aggregate counts
-- immediately (migration 07). The notification therefore reveals nothing the
-- realtime layer does not already broadcast.
--
-- ONE ROW PER EVENT, not per recipient. A new post writes ONE row with a null
-- recipient (broadcast), not twenty. Per-member state is two small cursor
-- tables instead.
-- ============================================================================

begin;

-- ============================ TABLES ========================================

create table if not exists public.notifications (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('post', 'rank', 'reaction', 'post_vote')),

  -- null = broadcast to the whole group. Set = only this member sees it.
  recipient_id uuid references public.members(id) on delete cascade,

  -- Rule 1 lives on the next two lines. See the header.
  actor_id     uuid references public.members(id) on delete set null,
  constraint notifications_actor_only_for_signed_events
    check (actor_id is null or kind = 'post'),

  week_id      int  references public.weeks(id) on delete cascade,
  post_id      uuid references public.posts(id) on delete cascade,

  -- Which emoji, when a reaction row stands alone. Nulled once a row coalesces,
  -- because "5 reactions" is no longer about one emoji.
  emoji        text,

  -- Where you were and where you are now, for 'rank'. rank_from is null on the
  -- first notice of a week.
  rank_from    smallint,
  rank_to      smallint,

  -- How many events this row has absorbed. See notify_attention() below.
  tally        int not null default 1 check (tally > 0),

  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_kind_created
  on public.notifications (kind, created_at desc);
-- Supports the coalescing lookup in notify_attention().
create index if not exists notifications_coalesce
  on public.notifications (recipient_id, kind, post_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Read state: ONE CURSOR PER KIND, not a read flag per row.
--
-- This is what makes the bell and the პოსტები chip agree. They are not two
-- counters — the chip is the 'post' slice of the same query the bell sums.
-- Opening the posts tab advances one cursor and both numbers fall together.
--
-- Four rows per member. Eighty rows for the whole group, permanently.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_reads (
  member_id uuid not null references public.members(id) on delete cascade,
  kind      text not null check (kind in ('post', 'rank', 'reaction', 'post_vote')),
  read_at   timestamptz not null default now(),
  primary key (member_id, kind)
);

-- ---------------------------------------------------------------------------
-- Rank notice bookkeeping. Internal — no grants, nobody selects this.
--
-- `last_rank` is the rank the member was last TOLD about, not their current
-- rank. That distinction is the whole collapse mechanism: a flurry of votes
-- inside the cooldown leaves this row untouched, so when the window expires we
-- compare against what they last heard and emit ONE notice, not one per vote.
-- ---------------------------------------------------------------------------
create table if not exists public.rank_notice_state (
  week_id     int  not null references public.weeks(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  last_rank   smallint not null,
  notified_at timestamptz not null default now(),
  primary key (week_id, member_id)
);

-- ============================ RLS ===========================================

alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;
alter table public.rank_notice_state  enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    -- Pending accounts hold the `authenticated` role but have no member row.
    public.current_member_id() is not null
    -- Broadcast, or addressed to me.
    and (recipient_id is null or recipient_id = public.current_member_id())
    -- Never tell me about my own action. This is why the posts trigger can
    -- write one broadcast row instead of nineteen addressed ones.
    and (actor_id is null or actor_id <> public.current_member_id())
  );

drop policy if exists notification_reads_select_own on public.notification_reads;
create policy notification_reads_select_own on public.notification_reads
  for select to authenticated
  using (member_id = public.current_member_id());

-- rank_notice_state gets RLS enabled and NO policy at all: deny by default.

-- Read-only to members. Every write goes through a security definer function,
-- exactly as with every other privileged write in this schema.
grant select on public.notifications      to authenticated;
grant select on public.notification_reads to authenticated;

revoke all on public.notifications      from anon;
revoke all on public.notification_reads from anon;
revoke all on public.rank_notice_state  from anon, authenticated;

-- ============================ RANKING =======================================
-- ---------------------------------------------------------------------------
-- !! THE RANKING RULE NOW LIVES IN FOUR PLACES, NOT THREE. !!
--
-- src/lib/ranking.ts, close_current_week(), admin_update_result(), and here.
-- Change one, change all four. CLAUDE.md has been updated to say four.
--
-- This exists because live_standings deliberately carries no rank — the live
-- board ranks on the client. A notification that says "ახლა #4 ხარ" must agree
-- with the board the member is staring at while they read it, so this is the
-- same rule, not a similar one: competition ranking on `net` ALONE, ties share
-- a rank, the next rank skips past them. 1, 2, 3, 3, 3, 3, 7.
--
-- total_votes and nickname are absent on purpose. They order rows INSIDE a
-- shared rank and can never move the rank number, so they cannot change what
-- this function returns.
-- ---------------------------------------------------------------------------
create or replace function public.live_ranks(p_week int)
returns table (member_id uuid, rank int)
language sql stable security definer set search_path = public as $$
  select ls.member_id, (rank() over (order by ls.net desc))::int
    from public.live_standings ls
   where ls.week_id = p_week
$$;

-- ============================ WRITERS =======================================

-- ---------------------------------------------------------------------------
-- Attention events coalesce instead of stacking.
--
-- A popular post can draw 19 votes and 19 reactions. Written naively that is
-- 38 rows burying everything else in the sheet. Instead, an event folds into
-- the most recent UNREAD row for the same (recipient, kind, post): tally goes
-- 1 → 2 → 3 and the timestamp refreshes. Once you have read it, the next event
-- starts a fresh row, so a genuinely new burst still surfaces.
-- ---------------------------------------------------------------------------
create or replace function public.notify_attention(
  p_kind      text,
  p_recipient uuid,
  p_week      int,
  p_post      uuid,
  p_emoji     text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_recipient is null then return; end if;

  update public.notifications n
     set tally      = n.tally + 1,
         emoji      = null,   -- no longer about a single emoji
         created_at = now()
   where n.id = (
     select n2.id
       from public.notifications n2
       left join public.notification_reads r
              on r.member_id = n2.recipient_id and r.kind = n2.kind
      where n2.kind         = p_kind
        and n2.recipient_id = p_recipient
        and n2.post_id is not distinct from p_post
        and (r.read_at is null or n2.created_at > r.read_at)
      order by n2.created_at desc
      limit 1
   )
  returning n.id into v_id;

  if v_id is null then
    insert into public.notifications (kind, recipient_id, week_id, post_id, emoji)
    values (p_kind, p_recipient, p_week, p_post, p_emoji);
  end if;
end $$;

-- -------------------------------------------------------------- new post ---
create or replace function public.notify_new_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- One broadcast row. The author is excluded by the RLS policy, not here.
  insert into public.notifications (kind, actor_id, week_id, post_id)
  values ('post', new.author_id, new.week_id, new.id);
  return null;
end $$;

drop trigger if exists posts_notify on public.posts;
create trigger posts_notify
after insert on public.posts
for each row execute function public.notify_new_post();

-- ------------------------------------------------------- member reaction ---
create or replace function public.notify_member_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reactor_id = new.member_id then return null; end if;   -- reacting to yourself
  perform public.notify_attention('reaction', new.member_id, new.week_id, null, new.emoji);
  return null;
end $$;

drop trigger if exists member_reactions_notify on public.member_reactions;
create trigger member_reactions_notify
after insert on public.member_reactions
for each row execute function public.notify_member_reaction();

-- --------------------------------------------------------- post reaction ---
create or replace function public.notify_post_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_week int;
begin
  select p.author_id, p.week_id into v_author, v_week
    from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.reactor_id then return null; end if;
  perform public.notify_attention('reaction', v_author, v_week, new.post_id, new.emoji);
  return null;
end $$;

drop trigger if exists post_reactions_notify on public.post_reactions;
create trigger post_reactions_notify
after insert on public.post_reactions
for each row execute function public.notify_post_reaction();

-- ------------------------------------------------------------- post vote ---
-- INSERT only. Changing an existing ballot (-1 → +1) must not re-notify.
create or replace function public.notify_post_vote() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_week int;
begin
  select p.author_id, p.week_id into v_author, v_week
    from public.posts p where p.id = new.post_id;
  -- Self-voting on your own post is allowed (§1.4) but is not news.
  if v_author is null or v_author = new.voter_id then return null; end if;
  perform public.notify_attention('post_vote', v_author, v_week, new.post_id, null);
  return null;
end $$;

drop trigger if exists post_votes_notify on public.post_votes;
create trigger post_votes_notify
after insert on public.post_votes
for each row execute function public.notify_post_vote();

-- ============================ RANK NOTICES ==================================
-- ---------------------------------------------------------------------------
-- Called from cast_vote, once per ballot.
--
-- Two guards keep this from being unusable:
--
--  1. BASELINE SEEDING. Everyone starts a week tied at #1, so the first ballot
--     splits the entire board at once. Without a silent baseline that single
--     vote would notify all twenty members. New members are seeded quietly and
--     only hear about their SECOND state.
--
--  2. COOLDOWN. A member hears at most once per 30 minutes, and only if their
--     rank differs from what they were last told. Eight votes in twenty
--     minutes produce one notice naming the final position, not eight.
--
-- Written as a single statement so `moved` is evaluated exactly once: the
-- notification and the state update always agree about what changed.
-- ---------------------------------------------------------------------------
create or replace function public.emit_rank_notices(p_week int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.rank_notice_state (week_id, member_id, last_rank)
  select p_week, lr.member_id, lr.rank
    from public.live_ranks(p_week) lr
  on conflict (week_id, member_id) do nothing;

  with moved as (
    select lr.member_id, lr.rank as new_rank, s.last_rank
      from public.live_ranks(p_week) lr
      join public.rank_notice_state s
        on s.week_id = p_week and s.member_id = lr.member_id
     where lr.rank <> s.last_rank
       and s.notified_at < now() - interval '30 minutes'
  ), ins as (
    insert into public.notifications (kind, recipient_id, week_id, rank_from, rank_to)
    select 'rank', m.member_id, p_week, m.last_rank, m.new_rank from moved m
    returning 1
  )
  update public.rank_notice_state s
     set last_rank = m.new_rank, notified_at = now()
    from moved m
   where s.week_id = p_week and s.member_id = m.member_id;
end $$;

-- ---------------------------------------------------------------------------
-- cast_vote, unchanged except for the final line.
--
-- Redefined here rather than edited in 20260815000500_rpc.sql, which is
-- already applied. The week is still resolved server-side — a client-supplied
-- week_id is never trusted (§8.3).
-- ---------------------------------------------------------------------------
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

  -- New. Reads aggregates only; never touches voter identity.
  perform public.emit_rank_notices(v_week);
end $$;

-- ============================ READ / MARK READ ==============================

-- Both counters in one query. The bell is the sum, the პოსტები chip is the
-- 'post' row. They cannot disagree because they are the same rows.
--
-- SECURITY DEFINER bypasses RLS, so the visibility predicate from
-- notifications_select is repeated here verbatim. Keep them in step.
create or replace function public.unread_counts()
returns table (kind text, unread int)
language sql stable security definer set search_path = public as $$
  select n.kind, count(*)::int
    from public.notifications n
    left join public.notification_reads r
           on r.member_id = public.current_member_id() and r.kind = n.kind
   where public.current_member_id() is not null
     and (n.recipient_id is null or n.recipient_id = public.current_member_id())
     and (n.actor_id is null or n.actor_id <> public.current_member_id())
     and (r.read_at is null or n.created_at > r.read_at)
   group by n.kind
$$;

-- p_kind null marks everything read (opening the bell). Passing 'post' marks
-- just that stream (opening the posts tab), which is what makes the bell count
-- fall at the same time.
create or replace function public.mark_notifications_read(p_kind text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_kinds  text[];
begin
  if p_kind is null then
    v_kinds := array['post', 'rank', 'reaction', 'post_vote'];
  elsif p_kind in ('post', 'rank', 'reaction', 'post_vote') then
    v_kinds := array[p_kind];
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;

  insert into public.notification_reads (member_id, kind, read_at)
  select v_member, k, now() from unnest(v_kinds) as k
  on conflict (member_id, kind) do update set read_at = excluded.read_at;
end $$;

-- ============================ GRANTS ========================================

grant execute on function public.unread_counts()                to authenticated;
grant execute on function public.mark_notifications_read(text)  to authenticated;

-- Internal only. CREATE FUNCTION grants EXECUTE to PUBLIC by default, so these
-- have to be taken back explicitly — they are called by triggers and by
-- cast_vote, never by a client.
revoke execute on function public.live_ranks(int)                          from public, anon, authenticated;
revoke execute on function public.emit_rank_notices(int)                   from public, anon, authenticated;
revoke execute on function public.notify_attention(text, uuid, int, uuid, text) from public, anon, authenticated;

commit;

-- ============================ REALTIME ======================================
-- `notifications` is deliberately NOT added to supabase_realtime, for the same
-- reason `votes` is not: publishing a per-member table streams its WAL to every
-- subscriber. It needs no subscription anyway — every writer above already sits
-- downstream of a signal the client watches (posts, vote_events, score_events),
-- so useRealtime.ts just adds notification queries to the invalidation it is
-- already doing, and inherits the existing 400ms debounce for free.

-- ============================ RETENTION =====================================
-- Optional, and harmless if pg_cron is not installed — the table simply grows,
-- slowly. Twenty people generate on the order of a hundred rows a week.
do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed — notifications will not be pruned automatically.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'prune-notifications') then
    perform cron.unschedule('prune-notifications');
  end if;

  perform cron.schedule('prune-notifications', '15 3 * * *',
    $c$
      delete from public.notifications where created_at < now() - interval '30 days';
      delete from public.rank_notice_state s
       using public.weeks w
       where w.id = s.week_id and w.status = 'closed'
         and w.ends_at < now() - interval '30 days';
    $c$);
end
$do$;
