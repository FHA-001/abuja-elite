-- Abuja Elite Phase 5: UNDO. Puts the four sections back to "everyone can read published rows".
-- WARNING: after this, Community, Experiences, Collaborations and Stories are PUBLIC again at the
-- database level. The website would still show its members-only screens, so also undo the app files.
-- It does not delete any data.
begin;
drop policy if exists "featured members are previews" on public.members;
drop policy if exists "members read published members" on public.members;
drop policy if exists "featured collaborations are previews" on public.collaborations;
drop policy if exists "members read published collaborations" on public.collaborations;
drop policy if exists "featured events are previews" on public.events;
drop policy if exists "members read published events" on public.events;
drop policy if exists "featured stories are previews" on public.stories;
drop policy if exists "members read published stories" on public.stories;
drop policy if exists "members read published content media" on storage.objects;

create policy "published members are public" on public.members for select to anon, authenticated using (published = true);
create policy "published collaborations are public" on public.collaborations for select to anon, authenticated using (published = true);
create policy "published events are public" on public.events for select to anon, authenticated using (published = true);
create policy "published stories are public" on public.stories for select to anon, authenticated
  using (published = true and published_at is not null and published_at <= now());

grant select on public.members, public.collaborations, public.events, public.stories to anon;

drop function if exists public.get_teasers(text, integer);
drop function if exists app_private.member_media_visible(text, text);
commit;
