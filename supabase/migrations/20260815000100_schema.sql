-- ============================================================================
-- საძმაკაცოს რანკი — 01 · schema
-- Single group. No group_id anywhere — the schema is deliberately hard-coded
-- to one friend circle.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============ MEMBERS ============
-- The ~20 rankable people. Created by admin BEFORE anyone signs in.
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null unique check (char_length(nickname) between 2 and 24),
  bio           text check (char_length(bio) <= 160),
  avatar_url    text,
  is_active     boolean not null default true,
  is_admin      boolean not null default false,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Exactly one admin, ever.
create unique index if not exists members_single_admin
  on public.members (is_admin) where is_admin;

-- ============ PENDING ACCOUNTS ============
-- Every Google sign-in lands here until admin links it to a member.
create table if not exists public.pending_accounts (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  google_name   text,
  google_avatar text,
  created_at    timestamptz not null default now()
);

-- ============ WEEKS ============
create table if not exists public.weeks (
  id          int primary key generated always as identity,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open','closed')),
  closed_at   timestamptz,
  is_paused   boolean not null default false,  -- admin panic button (§11)
  check (ends_at > starts_at)
);

-- Exactly one open week at a time.
create unique index if not exists weeks_one_open
  on public.weeks (status) where status = 'open';
create index if not exists weeks_starts_at on public.weeks (starts_at desc);

-- ============ VOTES (secret) ============
-- RLS restricts SELECT to the voter's own rows. Aggregates reach clients only
-- through the views in migration 03.
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  week_id     int not null references public.weeks(id) on delete cascade,
  voter_id    uuid not null references public.members(id) on delete cascade,
  target_id   uuid not null references public.members(id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (week_id, voter_id, target_id),
  check (voter_id <> target_id)
);
create index if not exists votes_week_target on public.votes (week_id, target_id);
create index if not exists votes_week_voter  on public.votes (week_id, voter_id);

-- ============ VOTE EVENTS (public, identity-free) ============
-- Realtime fan-out channel. Contains NO voter identity — that is the entire
-- reason this table exists (users cannot subscribe to `votes`, by design).
create table if not exists public.vote_events (
  id         bigint primary key generated always as identity,
  week_id    int not null,
  target_id  uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists vote_events_created on public.vote_events (created_at);

-- ============ SCORE EVENTS (public, identity-free) ============
-- Same trick for post votes and reactions, whose raw tables are also
-- select-own-only.
create table if not exists public.score_events (
  id         bigint primary key generated always as identity,
  kind       text not null check (kind in ('post_vote','post_reaction','member_reaction')),
  week_id    int,
  target_id  uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists score_events_created on public.score_events (created_at);

-- ============ POSTS ============
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  week_id    int not null references public.weeks(id) on delete cascade,
  author_id  uuid not null references public.members(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 150),
  created_at timestamptz not null default now(),
  unique (week_id, author_id)
);
create index if not exists posts_week on public.posts (week_id, created_at desc);

create table if not exists public.post_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  voter_id   uuid not null references public.members(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  updated_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);
-- NOTE: self-voting on your own post is intentionally allowed (§1.4).

-- ============ COMMENTS ============
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  week_id    int not null references public.weeks(id) on delete cascade,
  author_id  uuid not null references public.members(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists comments_week on public.comments (week_id, created_at);

-- ============ REACTIONS ============
create table if not exists public.member_reactions (
  week_id    int not null references public.weeks(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  reactor_id uuid not null references public.members(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥','😂','💀','👑','😭')),
  created_at timestamptz not null default now(),
  primary key (week_id, member_id, reactor_id, emoji)
);

create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  reactor_id uuid not null references public.members(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥','😂','💀','👑','😭')),
  created_at timestamptz not null default now(),
  primary key (post_id, reactor_id, emoji)
);

-- ============ SNAPSHOTS ============
-- Past weeks are immutable: always read from here, never recomputed from votes.
create table if not exists public.weekly_results (
  week_id     int not null references public.weeks(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  up          int not null,
  down        int not null,
  net         int not null,
  total_votes int not null,
  rank        int not null,
  prev_rank   int,
  movement    int,          -- prev_rank - rank; null when NEW
  edited      boolean not null default false,
  primary key (week_id, member_id)
);
create index if not exists weekly_results_member on public.weekly_results (member_id);

create table if not exists public.member_badges (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  badge_key  text not null,
  week_id    int references public.weeks(id) on delete cascade,
  awarded_at timestamptz not null default now()
);
-- coalesce() rather than a plain UNIQUE so that NULL week_id (all-time badges)
-- still dedupes — NULLs are distinct under a normal unique constraint.
create unique index if not exists member_badges_uniq
  on public.member_badges (member_id, badge_key, coalesce(week_id, -1));
create index if not exists member_badges_member on public.member_badges (member_id);

-- ============ ADMIN ============
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null check (char_length(body) <= 280),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id         bigint primary key generated always as identity,
  actor_id   uuid references public.members(id) on delete set null,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created on public.audit_log (created_at desc);
