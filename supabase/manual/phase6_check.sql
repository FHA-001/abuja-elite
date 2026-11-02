-- Abuja Elite Phase 6: READ-ONLY check. Run after applying the Phase 6 migration.
-- Every row should say OK.
select 'profile photo bucket is private, 5MB, images only' as check_name,
       case when exists (select 1 from storage.buckets where id='profile-photos' and public=false
                         and file_size_limit=5242880 and not ('application/pdf' = any(allowed_mime_types)))
            then 'OK' else 'PROBLEM' end as result
union all
select 'directory search exists',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='search_directory' and p.prosecdef) then 'OK' else 'PROBLEM' end
union all
select 'directory filters exist',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname='directory_filters' and p.prosecdef) then 'OK' else 'PROBLEM' end
union all
select 'visitors cannot use the directory',
       case when not has_function_privilege('anon','public.search_directory(text,text,text,text,integer,integer)','execute')
             and not has_function_privilege('anon','public.directory_filters()','execute') then 'OK' else 'PROBLEM' end
union all
select 'logged-in users can call it (the function itself checks for paid access)',
       case when has_function_privilege('authenticated','public.search_directory(text,text,text,text,integer,integer)','execute') then 'OK' else 'PROBLEM' end
union all
select 'photo rules exist (read, upload, delete)',
       case when (select count(*) from pg_policies where schemaname='storage'
                  and policyname in ('profile photos read','profile photos upload own','profile photos delete own')) = 3
            then 'OK' else 'PROBLEM' end
union all
select 'members still cannot read other profiles directly',
       case when not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles'
                             and cmd='SELECT' and 'authenticated' = any(roles) and qual not like '%user_id = auth.uid()%')
            then 'OK' else 'PROBLEM' end;
