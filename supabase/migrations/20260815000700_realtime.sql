-- ============================================================================
-- 07 · realtime fan-out
--
-- Members cannot SELECT each other's votes, so they will never receive
-- Realtime events from `votes`. That is the point, and it is exactly why
-- vote_events (and score_events) exist: identity-free pings that say
-- "something about this target changed, refetch the aggregate".
-- ============================================================================

create or replace function public.emit_vote_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.vote_events (week_id, target_id)
  values (coalesce(new.week_id, old.week_id),
          coalesce(new.target_id, old.target_id));
  return null;
end $$;

drop trigger if exists votes_emit on public.votes;
create trigger votes_emit
after insert or update or delete on public.votes
for each row execute function public.emit_vote_event();

-- ---------------------------------------------------------- post votes ----
create or replace function public.emit_post_vote_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_post uuid := coalesce(new.post_id, old.post_id);
begin
  insert into public.score_events (kind, week_id, target_id)
  select 'post_vote', p.week_id, p.id from public.posts p where p.id = v_post;
  return null;
end $$;

drop trigger if exists post_votes_emit on public.post_votes;
create trigger post_votes_emit
after insert or update or delete on public.post_votes
for each row execute function public.emit_post_vote_event();

-- ----------------------------------------------------------- reactions ----
create or replace function public.emit_member_reaction_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.score_events (kind, week_id, target_id)
  values ('member_reaction',
          coalesce(new.week_id, old.week_id),
          coalesce(new.member_id, old.member_id));
  return null;
end $$;

drop trigger if exists member_reactions_emit on public.member_reactions;
create trigger member_reactions_emit
after insert or delete on public.member_reactions
for each row execute function public.emit_member_reaction_event();

create or replace function public.emit_post_reaction_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_post uuid := coalesce(new.post_id, old.post_id);
begin
  insert into public.score_events (kind, week_id, target_id)
  select 'post_reaction', p.week_id, p.id from public.posts p where p.id = v_post;
  return null;
end $$;

drop trigger if exists post_reactions_emit on public.post_reactions;
create trigger post_reactions_emit
after insert or delete on public.post_reactions
for each row execute function public.emit_post_reaction_event();

-- ------------------------------------------------------- publication ------
-- `votes` is deliberately NOT published. Publishing it would hand the WAL
-- stream to every subscriber and undo migration 04 in one line.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'vote_events', 'score_events', 'posts', 'comments', 'weeks', 'announcements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
