-- Abuja Elite Phase 1: READ-ONLY check. Run after applying the migration.
-- Every row should say OK.
select 'tables exist' as check_name,
       case when (select count(*) from information_schema.tables
                  where table_schema='public'
                    and table_name in ('profiles','memberships','payment_settings','payment_submissions','notifications')) = 5
            then 'OK' else 'PROBLEM' end as result
union all
select 'row security on for all 5 tables',
       case when (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname in ('profiles','memberships','payment_settings','payment_submissions','notifications')
                    and c.relrowsecurity) = 5 then 'OK' else 'PROBLEM' end
union all
select 'sign-up trigger installed',
       case when exists (select 1 from pg_trigger where tgname='on_auth_user_created' and not tgisinternal)
            then 'OK' else 'PROBLEM' end
union all
select 'receipts bucket is private, 10MB, pdf+images',
       case when exists (select 1 from storage.buckets where id='payment-receipts' and public=false
                         and file_size_limit=10485760 and 'application/pdf' = any(allowed_mime_types))
            then 'OK' else 'PROBLEM' end
union all
select 'payment settings row exists',
       case when exists (select 1 from public.payment_settings where id=1) then 'OK' else 'PROBLEM' end
union all
select 'all existing accounts have a profile and membership row',
       case when not exists (select 1 from auth.users u
                             where not exists (select 1 from public.profiles p where p.user_id=u.id)
                                or not exists (select 1 from public.memberships m where m.user_id=u.id))
            then 'OK' else 'PROBLEM' end
union all
select 'anonymous visitors have NO access to the new tables',
       case when not exists (select 1 from information_schema.role_table_grants
                             where grantee='anon' and table_schema='public'
                               and table_name in ('profiles','memberships','payment_settings','payment_submissions','notifications'))
            then 'OK' else 'PROBLEM' end
union all
select 'members cannot write memberships or payments directly',
       case when not exists (select 1 from information_schema.role_table_grants
                             where grantee='authenticated' and table_schema='public'
                               and table_name in ('memberships','payment_submissions')
                               and privilege_type in ('INSERT','UPDATE','DELETE'))
            then 'OK' else 'PROBLEM' end;
