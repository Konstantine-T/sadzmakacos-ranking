-- ============================================================================
-- local_shim.sql — DEV TOOLING, never run against Supabase.
--
-- Recreates just enough of a Supabase database (the auth and storage schemas,
-- the anon/authenticated roles, auth.uid()) that the real migrations, seed.sql
-- and anonymity.sql can all be executed against a plain Postgres container.
--
--   docker run -d --name ranki-pg -e POSTGRES_PASSWORD=postgres \
--     -p 55432:5432 postgres:15
--
-- Then run, in order: this file, every migration, seed.sql, anonymity.sql.
--
-- Supabase already provides everything below, which is why running this there
-- would be at best redundant and at worst destructive.
-- ============================================================================

-- ---------------------------------------------------------------- roles ----
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------- auth ----
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  instance_id        uuid,
  aud                text,
  role               text,
  email              text,
  encrypted_password text,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Byte-for-byte the behaviour the real one has: read `sub` out of the request
-- claims that PostgREST sets per statement.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- -------------------------------------------------------------- storage ----
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz default now()
);

alter table storage.objects enable row level security;

-- The real implementation: everything before the last '/' in the object name.
create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end $$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant all on storage.objects to authenticated;

\echo 'local shim ready — now run the migrations in order'
