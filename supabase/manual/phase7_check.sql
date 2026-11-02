-- Abuja Elite Phase 7a: READ-ONLY check. Run after applying the Phase 7a migration.
-- Every row should say OK.
select 'announcements table exists with row security' as check_name,
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                         where n.nspname='public' and c.relname='announcements' and c.relrowsecurity) then 'OK' else 'PROBLEM' end as result
union all
select 'visitors have no access to announcements',
       case when not exists (select 1 from information_schema.role_table_grants
                             where grantee='anon' and table_schema='public' and table_name='announcements') then 'OK' else 'PROBLEM' end
union all
select 'members-only read rule exists',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='members read announcements') then 'OK' else 'PROBLEM' end
union all
select 'admin rule exists',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='announcements' and policyname='administrators manage announcements') then 'OK' else 'PROBLEM' end
union all
select 'new-members list exists and visitors cannot call it',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='recent_members' and p.prosecdef)
             and not has_function_privilege('anon','public.recent_members(integer)','execute') then 'OK' else 'PROBLEM' end;
