-- ============================================================================
-- 02 · helper functions + auth onboarding trigger
-- ============================================================================

-- The member row for the logged-in user. SECURITY DEFINER so that RLS policies
-- can call it without recursing into members' own policies.
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from public.members m
  where m.auth_user_id = auth.uid() and m.is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.is_admin from public.members m where m.auth_user_id = auth.uid()),
    false
  )
$$;

-- The single open week, or null.
create or replace function public.open_week_id() returns int
language sql stable security definer set search_path = public as $$
  select w.id from public.weeks w where w.status = 'open' limit 1
$$;

-- Monday 00:00 Asia/Tbilisi strictly after `from_ts`.
-- date_trunc('week', ...) lands on Monday 00:00 of that week.
create or replace function public.next_week_boundary(from_ts timestamptz)
returns timestamptz language sql immutable as $$
  select (
    date_trunc('week', (from_ts at time zone 'Asia/Tbilisi') + interval '7 days')
  ) at time zone 'Asia/Tbilisi'
$$;

-- Everything the frontend needs about "who am I", in one round trip.
create or replace function public.me()
returns table (
  member_id  uuid,
  nickname   text,
  bio        text,
  avatar_url text,
  is_admin   boolean,
  is_active  boolean,
  pending    boolean
)
language sql stable security definer set search_path = public as $$
  select m.id, m.nickname, m.bio, m.avatar_url, m.is_admin, m.is_active,
         false as pending
  from public.members m
  where m.auth_user_id = auth.uid()
  union all
  select null::uuid, null, null, null, false, false, true
  where auth.uid() is not null
    and not exists (select 1 from public.members m2 where m2.auth_user_id = auth.uid())
$$;

-- ============ AUTH ONBOARDING ============
-- Every Google sign-in lands in pending_accounts until the admin links it.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where auth_user_id = new.id) then
    insert into public.pending_accounts (auth_user_id, email, google_name, google_avatar)
    values (new.id,
            coalesce(new.email, ''),
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'avatar_url')
    on conflict (auth_user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Keep updated_at honest.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists votes_touch on public.votes;
create trigger votes_touch before update on public.votes
for each row execute function public.touch_updated_at();

drop trigger if exists post_votes_touch on public.post_votes;
create trigger post_votes_touch before update on public.post_votes
for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before update on public.comments
for each row execute function public.touch_updated_at();
