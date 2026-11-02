-- Abuja Elite Phase 6: UNDO. Removes the directory and profile-photo rules.
-- Profiles and their text details stay. Photos already uploaded stay in storage
-- (the bucket is only removed if it is empty).
begin;
drop policy if exists "profile photos read" on storage.objects;
drop policy if exists "profile photos upload own" on storage.objects;
drop policy if exists "profile photos delete own" on storage.objects;
drop function if exists public.search_directory(text, text, text, text, integer, integer);
drop function if exists public.directory_filters();
drop function if exists app_private.profile_photo_visible(text);
drop function if exists app_private.profile_in_directory(uuid);
drop function if exists app_private.is_paying_member(uuid);
delete from storage.buckets
where id = 'profile-photos'
  and not exists (select 1 from storage.objects where bucket_id = 'profile-photos');
commit;
