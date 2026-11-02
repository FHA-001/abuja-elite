-- Abuja Elite: member profiles photos + directory (Phase 6)
-- Additive and repeatable.
--
-- Adds:
--   * a private "profile-photos" storage bucket (members manage their own photo)
--   * search_directory()    paid members search other paid members
--   * directory_filters()   the industries, locations and skills to filter by
--
-- Rules:
--   * Only members with active access (or admins) can use the directory.
--   * Only members who are currently paid up, switched "listed" on, and have a
--     profession or business filled in appear in it.
--   * Phone, WhatsApp and email are shown ONLY if that member chose to share them.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function app_private.is_paying_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = p_user
      and not m.suspended
      and m.access_expires_at is not null
      and m.access_expires_at + app_private.grace_period() > now()
  );
$$;

-- A profile appears in the directory when it is listed, has a profession or business,
-- and its owner is currently paid up.
create or replace function app_private.profile_in_directory(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = p_user
      and p.listed
      and (coalesce(btrim(p.profession), '') <> '' or coalesce(btrim(p.business_name), '') <> '')
  ) and app_private.is_paying_member(p_user);
$$;

create or replace function app_private.profile_photo_visible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select exists (
    select 1 from public.profiles p
    where p.photo_path = p_name and app_private.profile_in_directory(p.user_id)
  );
$$;

revoke all on function app_private.is_paying_member(uuid) from public, anon, authenticated;
revoke all on function app_private.profile_in_directory(uuid) from public, anon, authenticated;
revoke all on function app_private.profile_photo_visible(text) from public, anon, authenticated;
grant execute on function app_private.profile_photo_visible(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Directory search
-- ---------------------------------------------------------------------------
create or replace function public.search_directory(
  p_query text default null,
  p_industry text default null,
  p_location text default null,
  p_skill text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_like text := null;
begin
  if not app_private.has_member_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_query is not null and btrim(p_query) <> '' then
    v_like := '%' || replace(replace(replace(left(btrim(p_query), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return (
    with matches as (
      select p.*
      from public.profiles p
      where app_private.profile_in_directory(p.user_id)
        and (v_like is null
             or p.full_name ilike v_like or p.business_name ilike v_like or p.profession ilike v_like
             or p.industry ilike v_like or p.location ilike v_like or p.bio ilike v_like
             or exists (select 1 from unnest(p.skills) s where s ilike v_like))
        and (nullif(btrim(p_industry), '') is null or lower(p.industry) = lower(btrim(p_industry)))
        and (nullif(btrim(p_location), '') is null or lower(p.location) = lower(btrim(p_location)))
        and (nullif(btrim(p_skill), '') is null
             or exists (select 1 from unnest(p.skills) s where lower(s) = lower(btrim(p_skill))))
    ),
    page as (
      select m.user_id, m.full_name, m.photo_path, m.business_name, m.profession, m.industry, m.location,
             m.bio, m.skills, m.linkedin_url, m.instagram_url, m.website_url,
             case when m.show_email then m.email end as email,
             case when m.show_phone then m.phone end as phone,
             case when m.show_whatsapp then m.whatsapp end as whatsapp
      from matches m
      order by m.full_name, m.user_id
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from matches),
      'rows', coalesce((select jsonb_agg(to_jsonb(page) order by page.full_name, page.user_id) from page), '[]'::jsonb)
    )
  );
end;
$$;

-- The values members can filter by (only from profiles that are in the directory).
create or replace function public.directory_filters()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not app_private.has_member_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    with eligible as (
      select p.* from public.profiles p where app_private.profile_in_directory(p.user_id)
    )
    select jsonb_build_object(
      'industries', (select coalesce(jsonb_agg(v order by v), '[]'::jsonb) from (
          select distinct btrim(industry) as v from eligible where coalesce(btrim(industry), '') <> '') x),
      'locations', (select coalesce(jsonb_agg(v order by v), '[]'::jsonb) from (
          select distinct btrim(location) as v from eligible where coalesce(btrim(location), '') <> '') x),
      'skills', (select coalesce(jsonb_agg(v order by n desc, v), '[]'::jsonb) from (
          select lower(btrim(s)) as v, count(*) as n
          from eligible, unnest(skills) s where btrim(s) <> '' group by 1 order by n desc, v limit 60) x)
    )
  );
end;
$$;

revoke all on function public.search_directory(text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.directory_filters() from public, anon, authenticated;
grant execute on function public.search_directory(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.directory_filters() to authenticated;

-- ---------------------------------------------------------------------------
-- Profile photos (private bucket)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- See: your own photo, any photo while you are a paid member and its owner is in the directory, admins see all.
drop policy if exists "profile photos read" on storage.objects;
create policy "profile photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or app_private.is_admin()
      or (app_private.has_member_access() and app_private.profile_photo_visible(name))
    )
  );

-- Upload into your own folder only, one level deep, at most 5 files at a time.
drop policy if exists "profile photos upload own" on storage.objects;
create policy "profile photos upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'profile-photos' and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 5
  );

-- Remove your own old photos (admins can remove any).
drop policy if exists "profile photos delete own" on storage.objects;
create policy "profile photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or app_private.is_admin())
  );

commit;
