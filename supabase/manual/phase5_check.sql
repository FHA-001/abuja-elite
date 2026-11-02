-- Abuja Elite Phase 5: READ-ONLY check. Run after applying the Phase 5 migration.
-- Every row should say OK.
select 'visitors cannot read member bios' as check_name,
       case when not has_column_privilege('anon','public.members','bio','select') then 'OK' else 'PROBLEM' end as result
union all
select 'visitors cannot read event descriptions',
       case when not has_column_privilege('anon','public.events','description','select') then 'OK' else 'PROBLEM' end
union all
select 'visitors cannot read story text',
       case when not has_column_privilege('anon','public.stories','content','select') then 'OK' else 'PROBLEM' end
union all
select 'visitors cannot read collaboration descriptions',
       case when not has_column_privilege('anon','public.collaborations','description','select') then 'OK' else 'PROBLEM' end
union all
select 'visitors can still read the safe preview columns',
       case when has_column_privilege('anon','public.members','name','select')
             and has_column_privilege('anon','public.events','title','select') then 'OK' else 'PROBLEM' end
union all
select 'the old "everyone can read" rules are gone',
       case when not exists (select 1 from pg_policies where schemaname='public'
                             and policyname in ('published members are public','published events are public',
                                                'published stories are public','published collaborations are public'))
            then 'OK' else 'PROBLEM' end
union all
select 'member-only rules exist on all 4 tables',
       case when (select count(*) from pg_policies where schemaname='public'
                  and policyname in ('members read published members','members read published events',
                                     'members read published stories','members read published collaborations')) = 4
            then 'OK' else 'PROBLEM' end
union all
select 'preview function exists and visitors can call it',
       case when has_function_privilege('anon','public.get_teasers(text,integer)','execute') then 'OK' else 'PROBLEM' end
union all
select 'member picture rule exists',
       case when exists (select 1 from pg_policies where schemaname='storage' and policyname='members read published content media')
            then 'OK' else 'PROBLEM' end
union all
select 'gallery is still public',
       case when exists (select 1 from pg_policies where schemaname='public' and tablename='gallery_items' and policyname='published gallery items are public')
            then 'OK' else 'PROBLEM' end;
