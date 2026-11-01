-- Abuja Elite Phase 3: READ-ONLY check. Run after applying the Phase 3 migration.
-- Every row should say OK.
select 'admin_set_suspended exists' as check_name,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='admin_set_suspended' and p.prosecdef)
            then 'OK' else 'PROBLEM' end as result
union all
select 'admin_membership_summary exists',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='admin_membership_summary' and p.prosecdef)
            then 'OK' else 'PROBLEM' end
union all
select 'visitors who are not logged in cannot run either function',
       case when not has_function_privilege('anon','public.admin_set_suspended(uuid,boolean)','execute')
             and not has_function_privilege('anon','public.admin_membership_summary()','execute')
            then 'OK' else 'PROBLEM' end
union all
select 'logged-in users can call them (the function itself checks for admin)',
       case when has_function_privilege('authenticated','public.admin_set_suspended(uuid,boolean)','execute')
             and has_function_privilege('authenticated','public.admin_membership_summary()','execute')
            then 'OK' else 'PROBLEM' end;
