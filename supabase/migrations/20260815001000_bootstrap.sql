-- ============================================================================
-- 10 · bootstrap
--
-- Week 1 is the only week ever created by hand. The site goes live mid-week,
-- so week 1 skips the immediate Monday and runs to Mon 24 Aug 2026 00:00
-- Tbilisi (§1.1). Every week after this one is created by close_current_week().
-- ============================================================================

insert into public.weeks (starts_at, ends_at, status)
select now(), timestamptz '2026-08-24 00:00+04', 'open'
where not exists (select 1 from public.weeks);
