-- Abuja Elite: lock members-only content (Phase 5)
--
-- BEFORE: published Community, Experiences, Collaborations and Stories rows
--         were readable by anyone.
-- AFTER:  only people with active access (paid month + 24h grace, or admins)
--         can read them. Visitors and unpaid accounts can only see
--         "previews": rows the admin marked Featured, with a few safe columns
--         (name/title, picture, category). No bios, descriptions, locations,
--         links or story text.
--
-- Gallery, site settings, forms and everything else stay public.
-- Repeatable. Does not touch the admin policies.

begin;

-- ---------------------------------------------------------------------------
-- Which stored pictures belong to a published row (used by the storage rule).
-- Draft pictures stay private even for members.
-- ---------------------------------------------------------------------------
create or replace function app_private.member_media_visible(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case p_bucket
    when 'member-images' then exists (
      select 1 from public.members m where m.published and m.profile_image_path = p_name)
    when 'collaboration-images' then exists (
      select 1 from public.collaborations c where c.published and (c.cover_image_path = p_name or c.logo_path = p_name))
    when 'event-images' then exists (
      select 1 from public.events e where e.published and e.cover_image_path = p_name)
    when 'story-images' then exists (
      select 1 from public.stories s
      where s.published and s.published_at is not null and s.published_at <= now() and s.cover_image_path = p_name)
    else false
  end;
$$;
revoke all on function app_private.member_media_visible(text, text) from public, anon, authenticated;
grant execute on function app_private.member_media_visible(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row rules
--   anon          -> featured + published rows only (previews)
--   authenticated -> all published rows, but only with active access
--   admins        -> everything (existing "administrators manage ..." policies)
-- ---------------------------------------------------------------------------
drop policy if exists "published members are public" on public.members;
drop policy if exists "featured members are previews" on public.members;
drop policy if exists "members read published members" on public.members;
create policy "featured members are previews" on public.members
  for select to anon using (published = true and featured = true);
create policy "members read published members" on public.members
  for select to authenticated using (published = true and app_private.has_member_access());

drop policy if exists "published collaborations are public" on public.collaborations;
drop policy if exists "featured collaborations are previews" on public.collaborations;
drop policy if exists "members read published collaborations" on public.collaborations;
create policy "featured collaborations are previews" on public.collaborations
  for select to anon using (published = true and featured = true);
create policy "members read published collaborations" on public.collaborations
  for select to authenticated using (published = true and app_private.has_member_access());

drop policy if exists "published events are public" on public.events;
drop policy if exists "featured events are previews" on public.events;
drop policy if exists "members read published events" on public.events;
create policy "featured events are previews" on public.events
  for select to anon using (published = true and featured = true);
create policy "members read published events" on public.events
  for select to authenticated using (published = true and app_private.has_member_access());

drop policy if exists "published stories are public" on public.stories;
drop policy if exists "featured stories are previews" on public.stories;
drop policy if exists "members read published stories" on public.stories;
create policy "featured stories are previews" on public.stories
  for select to anon using (
    published = true and featured = true and published_at is not null and published_at <= now());
create policy "members read published stories" on public.stories
  for select to authenticated using (
    published = true and published_at is not null and published_at <= now() and app_private.has_member_access());

-- ---------------------------------------------------------------------------
-- Column rules for visitors: previews may only ever expose these columns.
-- ---------------------------------------------------------------------------
revoke select on public.members, public.collaborations, public.events, public.stories from anon;
grant select (id, name, slug, profile_image_path, role, category, featured, published, sort_order)
  on public.members to anon;
grant select (id, name, slug, logo_path, cover_image_path, category, featured, published, sort_order)
  on public.collaborations to anon;
grant select (id, title, slug, starts_at, status, cover_image_path, featured, published)
  on public.events to anon;
grant select (id, title, slug, cover_image_path, category, featured, published, published_at)
  on public.stories to anon;

-- ---------------------------------------------------------------------------
-- Previews for everyone, including signed-in accounts that have not paid yet.
-- Only featured + published rows, only the safe columns, small limit.
-- ---------------------------------------------------------------------------
create or replace function public.get_teasers(p_kind text, p_limit integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 3), 1), 12);
  v_rows jsonb;
begin
  if p_kind = 'members' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows from (
      select id, name, slug, profile_image_path, role, category
      from public.members where published and featured order by sort_order, id limit v_limit) t;
  elsif p_kind = 'collaborations' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows from (
      select id, name, slug, logo_path, cover_image_path, category
      from public.collaborations where published and featured order by sort_order, id limit v_limit) t;
  elsif p_kind = 'events' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows from (
      select id, title, slug, starts_at, status, cover_image_path
      from public.events where published and featured order by starts_at desc, id limit v_limit) t;
  elsif p_kind = 'stories' then
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows from (
      select id, title, slug, cover_image_path, category, published_at
      from public.stories
      where published and featured and published_at is not null and published_at <= now()
      order by published_at desc, id limit v_limit) t;
  else
    return '[]'::jsonb;
  end if;
  return v_rows;
end;
$$;
revoke all on function public.get_teasers(text, integer) from public, anon, authenticated;
grant execute on function public.get_teasers(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pictures: members with active access may open pictures of PUBLISHED rows
-- (the website asks for a short-lived link). Admin rules are unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists "members read published content media" on storage.objects;
create policy "members read published content media" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('member-images', 'collaboration-images', 'event-images', 'story-images')
    and app_private.has_member_access()
    and app_private.member_media_visible(bucket_id, name)
  );

commit;
