-- ============================================================================
-- Push notifications.
--
-- WHY AN OUTBOX RATHER THAN PUSHING FROM EACH TRIGGER. Six different things
-- want to notify people — a rank move, a post, a chat message, a week ending, a
-- week starting, a trivia nudge — and only two of them come from the
-- `notifications` table. Wiring each one to its own HTTP call would mean six
-- places that know a function URL and can fail independently. Everything writes
-- a row into `push_outbox` instead, and one webhook drains it.
--
-- It also means a delivery failure is inspectable afterwards: the row is still
-- there with `sent_at` null, rather than an HTTP error nobody saw.
--
-- GEORGIAN LIVES HERE, WHICH BREAKS RULE 4. Every user-facing string in this
-- app belongs in src/i18n/ka.ts, and these do not, because a push body is
-- composed by Postgres at the moment the event happens — there is no client in
-- the loop to translate anything. Keeping them in one block at the top of this
-- file is the next best thing to ka.ts; do not scatter them into the triggers.
--
-- RULE 1 IS UNCHANGED AND MATTERS MORE HERE. A push body lands on a lock
-- screen, which is the most public surface this app has. So reactions and post
-- votes say "ვიღაცამ" exactly as the bell does, and rank pushes inherit the
-- endgame blackout for free: no notification row is written in the last six
-- hours, so nothing is enqueued.
--
-- WHAT IS DELIBERATELY NOT PUSHED: a coalesced follow-up. `notify_attention()`
-- rewrites an unread row in place rather than inserting, so the trigger below
-- fires on INSERT only — you are told once that a post got reactions, not once
-- per reaction.
-- ============================================================================

begin;

-- ---------------------------------------------------------- subscriptions --
-- One row per DEVICE, not per member: a phone and a laptop are two
-- subscriptions, and the endpoint is what the push service issues.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  member_id  uuid not null references public.members(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member
  on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;

-- You can see your own devices and nobody else's. Writes go through the RPCs.
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (member_id = public.current_member_id());

revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

-- ----------------------------------------------------------------- outbox --
create table if not exists public.push_outbox (
  id           bigint primary key generated always as identity,
  -- null = everybody. Set = only this member.
  recipient_id uuid references public.members(id) on delete cascade,
  -- Never notify someone about their own action.
  exclude_id   uuid references public.members(id) on delete set null,
  kind         text not null,
  title        text not null,
  body         text not null,
  url          text not null default '/',
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists push_outbox_unsent
  on public.push_outbox (created_at) where sent_at is null;

-- No client touches this, in either direction. The Edge Function reads it with
-- the service role; members have no business seeing what is queued for others.
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- ------------------------------------------------------------ member rpcs --
create or replace function public.save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_member uuid := public.require_member();
begin
  insert into public.push_subscriptions (endpoint, member_id, p256dh, auth, user_agent)
  values (p_endpoint, v_member, p_p256dh, p_auth, p_user_agent)
  -- A browser can hand the same endpoint to a different account after a
  -- sign-out, so the owner is reassigned rather than the insert failing.
  on conflict (endpoint) do update
     set member_id  = excluded.member_id,
         p256dh     = excluded.p256dh,
         auth       = excluded.auth,
         user_agent = excluded.user_agent;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions
   where endpoint = p_endpoint and member_id = public.require_member();
end $$;

revoke all    on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
revoke all    on function public.delete_push_subscription(text)                 from public, anon;
grant execute on function public.delete_push_subscription(text)                 to authenticated;

-- ---------------------------------------------------------------- enqueue --
create or replace function public.push_enqueue(
  p_recipient uuid,
  p_exclude   uuid,
  p_kind      text,
  p_title     text,
  p_body      text,
  p_url       text default '/'
) returns void
language sql security definer set search_path = public as $$
  insert into public.push_outbox (recipient_id, exclude_id, kind, title, body, url)
  values (p_recipient, p_exclude, p_kind, p_title, p_body, p_url);
$$;

revoke execute on function public.push_enqueue(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;

-- ================================ triggers ================================

-- 1 · rank, post, reaction — everything the bell already computes.
--     post_vote is handled separately below, because the direction the member
--     asked for is not stored on the notification row.
create or replace function public.push_from_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_body  text;
  v_url   text := '/';
  v_actor text;
begin
  if new.kind = 'rank' then
    v_title := 'ცვლილება რანკში!';
    v_body  := case
      when new.rank_from is null then 'ახლა #' || new.rank_to || ' ხარ'
      else 'ახლა #' || new.rank_to || ' ხარ (იყავი #' || new.rank_from || ')'
    end;

  elsif new.kind = 'post' then
    select m.nickname into v_actor from public.members m where m.id = new.actor_id;
    v_title := 'ახალი პოსტი';
    v_body  := coalesce(v_actor, 'ვიღაცამ') || ': ' ||
               coalesce((select left(p.body, 80) from public.posts p where p.id = new.post_id), '');
    v_url   := '/posts';

  elsif new.kind = 'reaction' then
    v_title := 'ვიღაცამ შენზე რეაქცია გამოხატა ბრო';
    v_body  := 'ვიღაცამ ' || coalesce(new.emoji, '') || ' დაგირეაქთა';
    v_url   := case when new.post_id is null then '/' else '/posts' end;

  else
    return null;
  end if;

  perform public.push_enqueue(new.recipient_id, null, new.kind, v_title, v_body, v_url);
  return null;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
after insert on public.notifications
for each row execute function public.push_from_notification();

-- 2 · a vote on your post, WITH its direction.
--     The bell deliberately omits which way it went; this says so, because the
--     up/down totals on a post are already public through `post_scores`. It
--     still never names who.
create or replace function public.push_post_vote() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select p.author_id into v_author from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.voter_id then
    return null; -- voting on your own post is allowed, and is not news
  end if;

  perform public.push_enqueue(
    v_author, null, 'post_vote',
    'შენს პოსტს ხმა მისცეს!',
    'შენს პოსტს ' || case when new.value = 1 then 'upvote' else 'downvote' end || ' დაუწერეს',
    '/posts');
  return null;
end $$;

drop trigger if exists post_votes_push on public.post_votes;
create trigger post_votes_push
after insert or update on public.post_votes
for each row execute function public.push_post_vote();

-- 3 · chat. Everyone but the sender.
--     Whether this is actually SHOWN is decided in the service worker: a push
--     that arrives while the app is open and focused is dropped there. The
--     server cannot know that, and should not try to guess.
create or replace function public.push_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select m.nickname into v_name from public.members m where m.id = new.author_id;
  perform public.push_enqueue(
    null, new.author_id, 'chat',
    'ჩათში მოიწერეს — ' || coalesce(v_name, ''),
    left(new.body, 120),
    '/chat');
  return null;
end $$;

drop trigger if exists messages_push on public.messages;
create trigger messages_push
after insert on public.messages
for each row execute function public.push_message();

-- 4 · a week closed, and 5 · a week opened.
--     Both hang off `weeks` so every path that ends or starts one is covered —
--     the cron close, a forced close from /admin/week, the bootstrap.
create or replace function public.push_week_closed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_enqueue(
    null, null, 'week_closed',
    'კვირა დასრულდა',
    'ნახე საბოლოო შედეგები',
    -- The week that just ended, not the new one.
    '/weeks/' || new.id);
  return null;
end $$;

drop trigger if exists weeks_push_closed on public.weeks;
create trigger weeks_push_closed
after update on public.weeks
for each row when (old.status = 'open' and new.status = 'closed')
execute function public.push_week_closed();

create or replace function public.push_week_opened() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_enqueue(
    null, null, 'week_opened',
    'ტრივია განახლდა!',
    'უნარების ტესტის ახალი 10 კითხვა გელოდება!',
    '/trivia');
  return null;
end $$;

drop trigger if exists weeks_push_opened on public.weeks;
create trigger weeks_push_opened
after insert on public.weeks
for each row execute function public.push_week_opened();

-- 6 · the Friday nudge, to whoever has not answered a single question.
--     Once a week, and only to people it is actually true of — a reminder that
--     reaches someone who already played is how people turn notifications off.
create or replace function public.push_trivia_nudge() returns void
language plpgsql security definer set search_path = public as $$
declare v_week int := public.open_week_id();
begin
  if v_week is null then return; end if;

  perform public.push_enqueue(
    m.id, null, 'trivia_nudge',
    'არ გინდა ტვინის გავარჯიშება?!',
    'უნარების ტესტი არ გაგიხსნია, ალესე ტვინი!',
    '/trivia/skills')
  from public.members m
  where m.is_active
    and not exists (
      select 1 from public.trivia_answers a
       where a.member_id = m.id and a.week_id = v_week);
end $$;

revoke execute on function public.push_trivia_nudge() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from cron.job where jobname = 'trivia-nudge') then
    perform cron.unschedule('trivia-nudge');
  end if;
  -- Friday 16:00 UTC = 20:00 Asia/Tbilisi, which is a Friday evening rather
  -- than the middle of a working day.
  perform cron.schedule('trivia-nudge', '0 16 * * 5',
                        $c$ select public.push_trivia_nudge(); $c$);
exception when others then
  raise notice 'pg_cron not available: %. The nudge will not fire.', sqlerrm;
end
$do$;

-- Keep the outbox from growing without bound, next to the other prune jobs.
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'prune-push-outbox') then
    perform cron.unschedule('prune-push-outbox');
  end if;
  perform cron.schedule('prune-push-outbox', '30 3 * * *',
    $c$ delete from public.push_outbox where created_at < now() - interval '7 days'; $c$);
exception when others then
  raise notice 'pg_cron not available: %.', sqlerrm;
end
$do$;

commit;
