-- Abuja Elite Phase 8: READ-ONLY check. Every row should say OK.
select 'reminder function exists' as check_name,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname='send_membership_reminders') then 'OK' else 'PROBLEM' end as result
union all
select 'members and visitors cannot run it directly',
       case when not has_function_privilege('authenticated','app_private.send_membership_reminders()','execute')
             and not has_function_privilege('anon','app_private.send_membership_reminders()','execute') then 'OK' else 'PROBLEM' end
union all
select 'admin button function exists and visitors cannot call it',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_run_reminders')
             and not has_function_privilege('anon','public.admin_run_reminders()','execute') then 'OK' else 'PROBLEM' end
union all
select 'reminder log exists and is hidden from members',
       case when exists (select 1 from information_schema.tables where table_schema='app_private' and table_name='reminder_log')
             and not has_table_privilege('authenticated','app_private.reminder_log','select') then 'OK' else 'PROBLEM' end
union all
select 'notifications are live (Realtime) - or Realtime is not on this project',
       case when not exists (select 1 from pg_publication where pubname='supabase_realtime')
              or exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='notifications') then 'OK' else 'PROBLEM' end;
