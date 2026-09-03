-- ============================================================================
-- ჩატი — one room, everybody in it.
--
-- WHY THIS EXISTS DESPITE THE NON-GOAL. CLAUDE.md lists "comments of any kind"
-- as dropped, on the reasoning that posts carry the conversation. A chat is not
-- comments — nothing here threads onto a post, and a post stays what it always
-- was: one statement a week, per member, that the group votes on. But it does
-- overtake posts as the place talking happens, and that was a deliberate change
-- of mind rather than an oversight. The non-goals list is updated in the same
-- commit.
--
-- SIGNED, LIKE POLLS. Every message carries its author and everybody sees it.
-- That does not touch rule 1: a message is something you chose to say, not the
-- group's verdict on you. `messages` therefore joins the realtime publication
-- whole, with no identity-free event table standing in front of it, for exactly
-- the reason `poll_answers` does.
--
-- REACTIONS STAY ANONYMOUS. This is the one place the chat deliberately departs
-- from Messenger. A 🖕 on your message is the same shape as a 🖕 on your post,
-- and post_reactions is select-own precisely so a reaction cannot be pinned to
-- a person. Making chat reactions signed would mean the same emoji is
-- accountable in one surface and not the other, which is how a social contract
-- erodes. Members see counts; identity is admin-readable only, matching
-- post_reactions exactly.
--
-- NO EDITING, EVER. Editing your own post is already a non-goal, and a message
-- you can silently rewrite after an argument is worse than one you cannot. The
-- admin can soft-delete for moderation — the same power admin_delete_post
-- gives, through the same audited RPC route.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- tables --
create table if not exists public.messages (
  id         bigint primary key generated always as identity,
  author_id  uuid not null references public.members(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  -- Soft delete: the row survives so the audit trail and reaction rows stay
  -- meaningful, and the UI renders a tombstone rather than silently reflowing
  -- the conversation around a hole.
  deleted_at timestamptz
);
create index if not exists messages_created on public.messages (created_at desc);

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  reactor_id uuid   not null references public.members(id) on delete cascade,
  emoji      text   not null check (emoji in ('🔥','😂','💀','👑','😭','💩','🖕','🫂')),
  created_at timestamptz not null default now(),
  primary key (message_id, reactor_id, emoji)
);
create index if not exists message_reactions_message on public.message_reactions (message_id);

-- One cursor per member. Counting unread from a timestamp keeps this table at
-- twenty rows forever, rather than a read receipt per member per message.
create table if not exists public.chat_reads (
  member_id    uuid primary key references public.members(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- views --
-- The anonymity boundary for chat reactions: counts cross it, reactor_id does
-- not. Owned by postgres, security_invoker = off, exactly like the others.
drop view if exists public.message_reaction_counts cascade;
create view public.message_reaction_counts as
select
  r.message_id,
  r.emoji,
  (count(*))::int as count
from public.message_reactions r
group by r.message_id, r.emoji;

alter view public.message_reaction_counts set (security_invoker = off);

-- ------------------------------------------------------------------- rls --
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.chat_reads        enable row level security;

drop policy if exists messages_select               on public.messages;
drop policy if exists message_reactions_select_own  on public.message_reactions;
drop policy if exists chat_reads_select_own         on public.chat_reads;

-- Every member reads every message. That is what a group room is.
create policy messages_select on public.messages
  for select to authenticated using (true);

-- Counts are public through the view; the rows themselves are yours alone.
-- `or public.is_admin()` matches post_reactions — moderation needs to see who.
create policy message_reactions_select_own on public.message_reactions
  for select to authenticated
  using (reactor_id = public.current_member_id() or public.is_admin());

create policy chat_reads_select_own on public.chat_reads
  for select to authenticated using (member_id = public.current_member_id());

-- ---------------------------------------------------------------- grants --
revoke all on public.messages          from anon, authenticated;
revoke all on public.message_reactions from anon, authenticated;
revoke all on public.chat_reads        from anon, authenticated;
revoke all on public.message_reaction_counts from anon;

grant select on public.messages                to authenticated;
grant select on public.message_reactions       to authenticated;
grant select on public.chat_reads              to authenticated;
grant select on public.message_reaction_counts to authenticated;

-- --------------------------------------------------------------- events --
-- Reactions are anonymous, so their table cannot be published. This carries the
-- ping instead, exactly as vote_events does for votes.
create table if not exists public.chat_events (
  id         bigint primary key generated always as identity,
  kind       text not null check (kind in ('reaction')),
  created_at timestamptz not null default now()
);
create index if not exists chat_events_created on public.chat_events (created_at);

alter table public.chat_events enable row level security;
drop policy if exists chat_events_select on public.chat_events;
create policy chat_events_select on public.chat_events
  for select to authenticated using (true);

revoke all on public.chat_events from anon, authenticated;
grant select on public.chat_events to authenticated;

-- ------------------------------------------------------------ member rpc --
create or replace function public.send_message(p_body text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_body   text := btrim(p_body);
  v_id     bigint;
begin
  if char_length(v_body) = 0 then
    raise exception 'empty_body' using errcode = '22023';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'too_long' using errcode = '22023';
  end if;

  insert into public.messages (author_id, body)
  values (v_member, v_body)
  returning id into v_id;

  return v_id;
end $$;

-- Mirrors toggle_post_reaction: a second call with the same emoji removes it.
create or replace function public.toggle_message_reaction(p_message_id bigint, p_emoji text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := public.require_member();
  v_author uuid;
begin
  select author_id into v_author
    from public.messages
   where id = p_message_id and deleted_at is null;
  if not found then
    raise exception 'no_such_message' using errcode = '22023';
  end if;

  delete from public.message_reactions
   where message_id = p_message_id and reactor_id = v_member and emoji = p_emoji;

  if not found then
    insert into public.message_reactions (message_id, reactor_id, emoji)
    values (p_message_id, v_member, p_emoji)
    on conflict do nothing;
  end if;

  -- Identity-free ping so other clients refetch the counts. The reaction rows
  -- themselves are never published, for the same reason `votes` is not.
  insert into public.chat_events (kind) values ('reaction');
end $$;

create or replace function public.mark_chat_read()
returns void
language plpgsql security definer set search_path = public as $$
declare v_member uuid := public.require_member();
begin
  insert into public.chat_reads (member_id, last_read_at)
  values (v_member, now())
  on conflict (member_id) do update set last_read_at = now();
end $$;

-- How many messages have arrived since you last looked. Drives the nav badge.
create or replace function public.chat_unread()
returns int
language sql stable security definer set search_path = public as $$
  select (count(*))::int
    from public.messages m
   where m.deleted_at is null
     and m.author_id <> public.current_member_id()
     and m.created_at > coalesce(
           (select c.last_read_at from public.chat_reads c
             where c.member_id = public.current_member_id()),
           '-infinity'::timestamptz);
$$;

-- ------------------------------------------------------------- admin rpc --
create or replace function public.admin_delete_message(p_message_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare v_admin uuid := public.require_admin();
begin
  update public.messages set deleted_at = now()
   where id = p_message_id and deleted_at is null;

  insert into public.audit_log (actor_id, action, detail)
  values (v_admin, 'message_deleted', jsonb_build_object('message_id', p_message_id));
end $$;

-- ----------------------------------------------------------------- grants --
revoke all    on function public.send_message(text)                  from public, anon;
revoke all    on function public.toggle_message_reaction(bigint,text) from public, anon;
revoke all    on function public.mark_chat_read()                    from public, anon;
revoke all    on function public.chat_unread()                       from public, anon;
revoke all    on function public.admin_delete_message(bigint)        from public, anon;

grant execute on function public.send_message(text)                   to authenticated;
grant execute on function public.toggle_message_reaction(bigint,text) to authenticated;
grant execute on function public.mark_chat_read()                     to authenticated;
grant execute on function public.chat_unread()                        to authenticated;
grant execute on function public.admin_delete_message(bigint)         to authenticated;

-- ------------------------------------------------------------ publication --
-- `messages` is published whole: it is signed by design, and the body is what
-- every client is about to render anyway. `message_reactions` is NOT, because
-- it carries reactor identity — chat_events stands in for it.
do $$
declare t text;
begin
  foreach t in array array['messages', 'chat_events'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------ cron --
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
      delete from public.chat_events   where created_at < now() - interval '7 days';
    $c$);
exception when others then
  raise notice 'pg_cron not available: %. Prune job unchanged.', sqlerrm;
end
$do$;

commit;
