-- Abuja Elite Phase 2 foundation
-- Intended display timezone: Africa/Lagos.
-- Events are stored as timestamptz and converted explicitly at display time.
-- Stories use plain text with paragraph breaks, not raw HTML.

create extension if not exists pgcrypto;

create schema if not exists app_private;

create table if not exists app_private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select exists (
    select 1
    from app_private.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_admin() to anon, authenticated;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select app_private.is_admin();
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  profile_image_path text,
  bio text,
  role text,
  category text,
  location text,
  instagram_url text,
  website_url text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_path text,
  cover_image_path text,
  description text,
  website_url text,
  instagram_url text,
  category text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  cover_image_path text,
  registration_url text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 220),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text,
  content text not null,
  cover_image_path text,
  category text,
  author_name text,
  published_at timestamptz,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  thumbnail_path text,
  caption text,
  alt_text text not null check (length(trim(alt_text)) between 1 and 300),
  category text,
  event_id uuid references public.events(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  collaboration_id uuid references public.collaborations(id) on delete set null,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  phone text,
  message text not null,
  interest text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'contacted', 'accepted', 'declined', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  subject text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_interests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  normalized_email text generated always as (lower(btrim(email))) stored,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, normalized_email)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique
    check (normalized_email = lower(btrim(normalized_email))),
    check (length(btrim(normalized_email)) between 3 and 320),
    check (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'pending'
    check (status in ('pending', 'subscribed', 'unsubscribed')),
  consent boolean not null default false,
  consent_at timestamptz,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique check (length(trim(setting_key)) between 1 and 120),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists members_public_order_idx
  on public.members (published, sort_order, created_at desc);
create index if not exists collaborations_public_order_idx
  on public.collaborations (published, sort_order, created_at desc);
create index if not exists events_public_schedule_idx
  on public.events (published, status, starts_at);
create index if not exists stories_public_publish_idx
  on public.stories (published, published_at desc);
create index if not exists gallery_public_order_idx
  on public.gallery_items (published, sort_order, created_at desc);
create index if not exists event_interests_event_idx
  on public.event_interests (event_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'members',
    'collaborations',
    'events',
    'stories',
    'gallery_items',
    'applications',
    'contact_messages',
    'event_interests',
    'newsletter_subscribers'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I',
      table_name
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end
$$;

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.collaborations enable row level security;
alter table public.events enable row level security;
alter table public.stories enable row level security;
alter table public.gallery_items enable row level security;
alter table public.applications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.event_interests enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "published members are public" on public.members;
create policy "published members are public"
on public.members for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage members" on public.members;
create policy "administrators manage members"
on public.members for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published collaborations are public" on public.collaborations;
create policy "published collaborations are public"
on public.collaborations for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage collaborations" on public.collaborations;
create policy "administrators manage collaborations"
on public.collaborations for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published events are public" on public.events;
create policy "published events are public"
on public.events for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage events" on public.events;
create policy "administrators manage events"
on public.events for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published stories are public" on public.stories;
create policy "published stories are public"
on public.stories for select
to anon, authenticated
using (
  published = true
  and published_at is not null
  and published_at <= now()
);

drop policy if exists "administrators manage stories" on public.stories;
create policy "administrators manage stories"
on public.stories for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published gallery items are public" on public.gallery_items;
create policy "published gallery items are public"
on public.gallery_items for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage gallery items" on public.gallery_items;
create policy "administrators manage gallery items"
on public.gallery_items for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "public settings are public" on public.site_settings;
create policy "public settings are public"
on public.site_settings for select
to anon, authenticated
using (is_public = true);

drop policy if exists "administrators manage site settings" on public.site_settings;
create policy "administrators manage site settings"
on public.site_settings for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review applications" on public.applications;
create policy "administrators review applications"
on public.applications for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review contact messages" on public.contact_messages;
create policy "administrators review contact messages"
on public.contact_messages for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review event interests" on public.event_interests;
create policy "administrators review event interests"
on public.event_interests for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review newsletter subscribers" on public.newsletter_subscribers;
create policy "administrators review newsletter subscribers"
on public.newsletter_subscribers for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

grant usage on schema public to anon, authenticated;
revoke all privileges on table public.members, public.collaborations,
  public.events, public.stories, public.gallery_items, public.applications,
  public.contact_messages, public.event_interests,
  public.newsletter_subscribers, public.site_settings
from public, anon, authenticated;

grant select on public.members, public.collaborations, public.events,
  public.stories, public.gallery_items, public.site_settings
to anon;
grant select, insert, update, delete on public.members, public.collaborations,
  public.events, public.stories, public.gallery_items, public.applications,
  public.contact_messages, public.event_interests,
  public.newsletter_subscribers, public.site_settings
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('member-images', 'member-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-images', 'event-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('collaboration-images', 'collaboration-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('story-images', 'story-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('gallery-images', 'gallery-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('site-assets', 'site-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "administrators read private media" on storage.objects;
create policy "administrators read private media"
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators upload private media" on storage.objects;
create policy "administrators upload private media"
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators update private media" on storage.objects;
create policy "administrators update private media"
on storage.objects for update
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
)
with check (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators delete private media" on storage.objects;
create policy "administrators delete private media"
on storage.objects for delete
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);-- Abuja Elite Phase 2 foundation
-- Intended display timezone: Africa/Lagos.
-- Events are stored as timestamptz and converted explicitly at display time.
-- Stories use plain text with paragraph breaks, not raw HTML.

create extension if not exists pgcrypto;

create schema if not exists app_private;

create table if not exists app_private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select exists (
    select 1
    from app_private.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated;
revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.is_admin() to anon, authenticated;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select app_private.is_admin();
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  profile_image_path text,
  bio text,
  role text,
  category text,
  location text,
  instagram_url text,
  website_url text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collaborations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_path text,
  cover_image_path text,
  description text,
  website_url text,
  instagram_url text,
  category text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  cover_image_path text,
  registration_url text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 220),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text,
  content text not null,
  cover_image_path text,
  category text,
  author_name text,
  published_at timestamptz,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  thumbnail_path text,
  caption text,
  alt_text text not null check (length(trim(alt_text)) between 1 and 300),
  category text,
  event_id uuid references public.events(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  collaboration_id uuid references public.collaborations(id) on delete set null,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  phone text,
  message text not null,
  interest text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'contacted', 'accepted', 'declined', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  subject text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_interests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  normalized_email text generated always as (lower(btrim(email))) stored,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, normalized_email)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique
    check (normalized_email = lower(btrim(normalized_email))),
    check (length(btrim(normalized_email)) between 3 and 320),
    check (normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'pending'
    check (status in ('pending', 'subscribed', 'unsubscribed')),
  consent boolean not null default false,
  consent_at timestamptz,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique check (length(trim(setting_key)) between 1 and 120),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists members_public_order_idx
  on public.members (published, sort_order, created_at desc);
create index if not exists collaborations_public_order_idx
  on public.collaborations (published, sort_order, created_at desc);
create index if not exists events_public_schedule_idx
  on public.events (published, status, starts_at);
create index if not exists stories_public_publish_idx
  on public.stories (published, published_at desc);
create index if not exists gallery_public_order_idx
  on public.gallery_items (published, sort_order, created_at desc);
create index if not exists event_interests_event_idx
  on public.event_interests (event_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'members',
    'collaborations',
    'events',
    'stories',
    'gallery_items',
    'applications',
    'contact_messages',
    'event_interests',
    'newsletter_subscribers'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I',
      table_name
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end
$$;

drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.members enable row level security;
alter table public.collaborations enable row level security;
alter table public.events enable row level security;
alter table public.stories enable row level security;
alter table public.gallery_items enable row level security;
alter table public.applications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.event_interests enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "published members are public" on public.members;
create policy "published members are public"
on public.members for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage members" on public.members;
create policy "administrators manage members"
on public.members for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published collaborations are public" on public.collaborations;
create policy "published collaborations are public"
on public.collaborations for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage collaborations" on public.collaborations;
create policy "administrators manage collaborations"
on public.collaborations for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published events are public" on public.events;
create policy "published events are public"
on public.events for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage events" on public.events;
create policy "administrators manage events"
on public.events for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published stories are public" on public.stories;
create policy "published stories are public"
on public.stories for select
to anon, authenticated
using (
  published = true
  and published_at is not null
  and published_at <= now()
);

drop policy if exists "administrators manage stories" on public.stories;
create policy "administrators manage stories"
on public.stories for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "published gallery items are public" on public.gallery_items;
create policy "published gallery items are public"
on public.gallery_items for select
to anon, authenticated
using (published = true);

drop policy if exists "administrators manage gallery items" on public.gallery_items;
create policy "administrators manage gallery items"
on public.gallery_items for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "public settings are public" on public.site_settings;
create policy "public settings are public"
on public.site_settings for select
to anon, authenticated
using (is_public = true);

drop policy if exists "administrators manage site settings" on public.site_settings;
create policy "administrators manage site settings"
on public.site_settings for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review applications" on public.applications;
create policy "administrators review applications"
on public.applications for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review contact messages" on public.contact_messages;
create policy "administrators review contact messages"
on public.contact_messages for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review event interests" on public.event_interests;
create policy "administrators review event interests"
on public.event_interests for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

drop policy if exists "administrators review newsletter subscribers" on public.newsletter_subscribers;
create policy "administrators review newsletter subscribers"
on public.newsletter_subscribers for all
to authenticated
using (app_private.is_admin())
with check (app_private.is_admin());

grant usage on schema public to anon, authenticated;
revoke all privileges on table public.members, public.collaborations,
  public.events, public.stories, public.gallery_items, public.applications,
  public.contact_messages, public.event_interests,
  public.newsletter_subscribers, public.site_settings
from public, anon, authenticated;

grant select on public.members, public.collaborations, public.events,
  public.stories, public.gallery_items, public.site_settings
to anon;
grant select, insert, update, delete on public.members, public.collaborations,
  public.events, public.stories, public.gallery_items, public.applications,
  public.contact_messages, public.event_interests,
  public.newsletter_subscribers, public.site_settings
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('member-images', 'member-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-images', 'event-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('collaboration-images', 'collaboration-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('story-images', 'story-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('gallery-images', 'gallery-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('site-assets', 'site-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "administrators read private media" on storage.objects;
create policy "administrators read private media"
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators upload private media" on storage.objects;
create policy "administrators upload private media"
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators update private media" on storage.objects;
create policy "administrators update private media"
on storage.objects for update
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
)
with check (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);

drop policy if exists "administrators delete private media" on storage.objects;
create policy "administrators delete private media"
on storage.objects for delete
to authenticated
using (
  bucket_id in (
    'member-images',
    'event-images',
    'collaboration-images',
    'story-images',
    'gallery-images',
    'site-assets'
  )
  and app_private.is_admin()
);