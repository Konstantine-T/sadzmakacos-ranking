-- ============================================================================
-- 09 · scheduled jobs
--
-- Tbilisi is UTC+4 all year (no DST), so Monday 00:00 Tbilisi is always
-- Sunday 20:00 UTC. No timezone maths at runtime, ever.
--
-- If this file raises a NOTICE about pg_cron, enable the extension in
-- Supabase → Database → Extensions and re-run it. Everything else in the app
-- works without it; you just have to close weeks by hand from /admin/week.
-- ============================================================================

do $do$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available: %. Enable it in the Supabase dashboard.', sqlerrm;
    return;
  end;

  -- Close the week: Sunday 20:00 UTC == Monday 00:00 Asia/Tbilisi.
  if exists (select 1 from cron.job where jobname = 'close-week') then
    perform cron.unschedule('close-week');
  end if;
  perform cron.schedule('close-week', '0 20 * * 0',
                        $c$ select public.close_current_week(); $c$);

  -- Keep the realtime fan-out tables from growing without bound (§5).
  if exists (select 1 from cron.job where jobname = 'prune-events') then
    perform cron.unschedule('prune-events');
  end if;
  perform cron.schedule('prune-events', '0 3 * * *',
    $c$
      delete from public.vote_events  where created_at < now() - interval '7 days';
      delete from public.score_events where created_at < now() - interval '7 days';
    $c$);
end
$do$;
