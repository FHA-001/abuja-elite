-- Abuja Elite Phase 8: UNDO. Removes the reminder function and its log.
-- Notifications already sent stay. If you scheduled it, also run:
--   select cron.unschedule('abuja-elite-renewal-reminders');
begin;
drop function if exists public.admin_run_reminders();
drop function if exists app_private.send_membership_reminders();
drop table if exists app_private.reminder_log;
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime drop table public.notifications;
  end if;
end $$;
commit;
