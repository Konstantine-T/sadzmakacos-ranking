-- ============================================================================
-- Widen the fixed reaction set from five to eight.
--
--   🔥 😂 💀 👑 😭  +  💩 🖕 🫂
--
-- The set is a CHECK constraint, not an enum and not a lookup table, so adding
-- to it is a constraint swap. The frontend's REACTIONS array in
-- src/theme/tokens.ts is the display order and MUST list the same eight — a
-- member tapping an emoji this constraint rejects gets a failed RPC, not a
-- graceful fallback.
--
-- Existing rows revalidate cleanly: the set only grows, so every stored emoji
-- is still a member of it. No reaction data is touched.
--
-- NOTE ON 🫂: Emoji 13.0 (2020). Renders on iOS 14.2+ and Android 11+; older
-- devices in the group will show a tofu box. 💩 and 🖕 are universal.
-- ============================================================================

begin;

-- The original checks in 20260815000100_schema.sql were declared inline on the
-- column, so Postgres generated their names. Drop by lookup rather than
-- trusting `<table>_<column>_check` to have been what it picked.
do $$
declare c record;
begin
  for c in
    select rel.relname as tbl, con.conname as name
      from pg_constraint con
      join pg_class     rel on rel.oid = con.conrelid
      join pg_namespace ns  on ns.oid  = rel.relnamespace
     where ns.nspname   = 'public'
       and rel.relname in ('member_reactions', 'post_reactions')
       and con.contype  = 'c'
       and pg_get_constraintdef(con.oid) like '%emoji%'
  loop
    execute format('alter table public.%I drop constraint %I', c.tbl, c.name);
    raise notice 'dropped % on %', c.name, c.tbl;
  end loop;
end $$;

alter table public.member_reactions
  add constraint member_reactions_emoji_check
  check (emoji in ('🔥','😂','💀','👑','😭','💩','🖕','🫂'));

alter table public.post_reactions
  add constraint post_reactions_emoji_check
  check (emoji in ('🔥','😂','💀','👑','😭','💩','🖕','🫂'));

commit;
