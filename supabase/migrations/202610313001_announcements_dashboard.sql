-- Abuja Elite: announcements + member dashboard data (Phase 7a)
-- Additive and repeatable.
--
--   announcements      the admin posts; paid members read them on their dashboard
--   recent_members()   the newest people in the community (no contact details)

begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 3000),
  pinned boolean not null default false,
  published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_feed_idx
  on public.announcements (pinned desc, published_at desc) where published;

drop trigger if exists set_updated_at on public.announcements;
create trigger set_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "administrators manage announcements" on public.announcements;
create policy "administrators manage announcements" on public.announcements
  for all to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

-- Paid members (and admins) read published announcements. Nobody else.
drop policy if exists "members read announcements" on public.announcements;
create policy "members read announcements" on public.announcements
  for select to authenticated
  using (published and published_at <= now() and app_private.has_member_access());

revoke all privileges on table public.announcements from public, anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;

-- ---------------------------------------------------------------------------
-- Newest people in the community, for the dashboard. Names and photos only.
-- ---------------------------------------------------------------------------
create or replace function public.recent_members(p_limit integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 12);
begin
  if not app_private.has_member_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.joined desc, t.user_id)
    from (
      select p.user_id, p.full_name, p.photo_path, p.profession, p.business_name, p.location, p.created_at as joined
      from public.profiles p
      where app_private.profile_in_directory(p.user_id)
      order by p.created_at desc, p.user_id
      limit v_limit
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.recent_members(integer) from public, anon, authenticated;
grant execute on function public.recent_members(integer) to authenticated;

commit;
