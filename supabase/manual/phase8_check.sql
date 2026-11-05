-- Abuja Elite Phase 7b: READ-ONLY check. Run after applying the Phase 7b migration.
-- Every row should say OK.
select 'events have a ticket price column' as check_name,
       case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='price_amount') then 'OK' else 'PROBLEM' end as result
union all
select 'visitors cannot read ticket prices',
       case when not has_column_privilege('anon','public.events','price_amount','select') then 'OK' else 'PROBLEM' end
union all
select 'sign-ups table exists with row security',
       case when exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='event_registrations' and c.relrowsecurity) then 'OK' else 'PROBLEM' end
union all
select 'members cannot write sign-ups directly',
       case when not exists (select 1 from information_schema.role_table_grants where grantee in ('authenticated','anon') and table_schema='public' and table_name='event_registrations' and privilege_type in ('INSERT','UPDATE','DELETE')) then 'OK' else 'PROBLEM' end
union all
select 'sign-up functions exist',
       case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('register_for_event','submit_event_payment','cancel_event_registration','admin_review_event_signup')) = 4 then 'OK' else 'PROBLEM' end
union all
select 'visitors cannot call the sign-up functions',
       case when not has_function_privilege('anon','public.register_for_event(uuid)','execute') and not has_function_privilege('anon','public.admin_review_event_signup(uuid,boolean,text)','execute') then 'OK' else 'PROBLEM' end
union all
select 'admin summary counts event sign-ups',
       case when pg_get_functiondef('public.admin_membership_summary()'::regprocedure) like '%waiting_event_signups%' then 'OK' else 'PROBLEM' end;
