-- Abuja Elite: membership foundation (Phase 1 of the membership build)
--
-- ADDITIVE ONLY. This does not change any existing table, policy, bucket or
-- function. It can be run more than once safely.
--
-- What this creates:
--   profiles, memberships, payment_settings, payment_submissions, notifications
--   a private "payment-receipts" storage bucket (PDF + images)
--   functions: has_member_access, get_my_membership, submit_payment,
--              admin_approve_payment, admin_reject_payment
--   a trigger that creates a profile + pending membership for each new sign-up
--
-- Rules baked in:
--   * New accounts are "pending" until an admin approves a payment.
--   * Approval gives access for one month. If the member renews before their
--     old expiry (or within the 24h grace) the new month starts from the old
--     expiry; otherwise it starts from the approval time.
--   * Access = expiry + 24 hours grace. Enforced in the database.
--   * Members can never change their own membership, payments or status.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- Constants and helpers
-- ---------------------------------------------------------------------------
create or replace function app_private.grace_period()
returns interval
language sql
immutable
set search_path = pg_catalog
as $$ select interval '24 hours' $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 160),
  email text not null default '' check (length(email) <= 320),
  phone text check (phone is null or length(phone) <= 40),
  whatsapp text check (whatsapp is null or length(whatsapp) <= 40),
  photo_path text check (
    photo_path is null
    or (length(photo_path) <= 300 and photo_path like (user_id::text || '/%'))
  ),
  business_name text check (business_name is null or length(business_name) <= 160),
  profession text check (profession is null or length(profession) <= 160),
  industry text check (industry is null or length(industry) <= 160),
  location text check (location is null or length(location) <= 160),
  bio text check (bio is null or length(bio) <= 2000),
  skills text[] not null default '{}' check (coalesce(array_length(skills, 1), 0) <= 20),
  linkedin_url text check (linkedin_url is null or (length(linkedin_url) <= 300 and linkedin_url ~* '^https?://')),
  instagram_url text check (instagram_url is null or (length(instagram_url) <= 300 and instagram_url ~* '^https?://')),
  website_url text check (website_url is null or (length(website_url) <= 300 and website_url ~* '^https?://')),
  show_email boolean not null default false,
  show_phone boolean not null default false,
  show_whatsapp boolean not null default false,
  listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_expires_at timestamptz,
  last_approved_at timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  id smallint primary key default 1 check (id = 1),
  monthly_fee_amount numeric(12, 2) not null default 0 check (monthly_fee_amount >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  bank_name text check (bank_name is null or length(bank_name) <= 160),
  account_name text check (account_name is null or length(account_name) <= 160),
  account_number text check (account_number is null or length(account_number) <= 40),
  payment_instructions text check (payment_instructions is null or length(payment_instructions) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_path text not null check (
    length(receipt_path) <= 200
    and receipt_path like (user_id::text || '/%')
    and receipt_path ~* '\.(pdf|jpe?g|png|webp)$'
  ),
  member_note text check (member_note is null or length(member_note) <= 500),
  fee_amount numeric(12, 2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_comment text check (admin_comment is null or length(admin_comment) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A member can have only one receipt waiting for review at a time.
create unique index if not exists payment_submissions_one_pending_idx
  on public.payment_submissions (user_id) where status = 'pending';
create index if not exists payment_submissions_review_idx
  on public.payment_submissions (status, created_at desc);
create index if not exists payment_submissions_user_idx
  on public.payment_submissions (user_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 60),
  title text not null check (length(title) between 1 and 200),
  body text check (body is null or length(body) <= 1500),
  link text check (link is null or length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- updated_at triggers (reuses the function the project already has)
do $$
declare t text;
begin
  foreach t in array array['profiles', 'memberships', 'payment_submissions'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function app_private.touch_payment_settings()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists touch_payment_settings on public.payment_settings;
create trigger touch_payment_settings
  before update on public.payment_settings
  for each row execute function app_private.touch_payment_settings();

-- ---------------------------------------------------------------------------
-- Access functions
-- ---------------------------------------------------------------------------

-- True for admins, and for members whose paid month (plus 24h grace) has not run out.
create or replace function app_private.has_member_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    app_private.is_admin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and not m.suspended
        and m.access_expires_at is not null
        and m.access_expires_at + app_private.grace_period() > now()
    );
$$;

-- What the app asks to decide which screen to show.
create or replace function public.get_my_membership()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  m public.memberships;
  v_state text;
  v_admin boolean := app_private.is_admin();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into m from public.memberships where user_id = auth.uid();
  if not found or m.access_expires_at is null then
    v_state := 'pending';
  elsif m.suspended then
    v_state := 'suspended';
  elsif now() <= m.access_expires_at then
    v_state := 'active';
  elsif now() <= m.access_expires_at + app_private.grace_period() then
    v_state := 'grace';
  else
    v_state := 'expired';
  end if;
  if found and m.suspended then
    v_state := 'suspended';
  end if;
  return jsonb_build_object(
    'state', v_state,
    'has_access', v_admin or v_state in ('active', 'grace'),
    'is_admin', v_admin,
    'access_expires_at', m.access_expires_at,
    'grace_ends_at', case when m.access_expires_at is null then null
                          else m.access_expires_at + app_private.grace_period() end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: every new account gets a profile and a pending membership
-- ---------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Member'
  )), 160);
  insert into public.profiles (user_id, full_name, email)
  values (new.id, v_name, left(coalesce(new.email, ''), 320))
  on conflict (user_id) do nothing;
  insert into public.memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Give existing accounts (for example the current admin) a profile and membership row.
insert into public.profiles (user_id, full_name, email)
select u.id,
       left(btrim(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                           nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Member')), 160),
       left(coalesce(u.email, ''), 320)
from auth.users u
on conflict (user_id) do nothing;
insert into public.memberships (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Member action: submit a payment receipt
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment(p_receipt_path text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_fee numeric(12, 2);
  v_currency text;
  v_name text;
  v_recent integer;
  v_suspended boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_receipt_path is null
     or length(p_receipt_path) > 200
     or p_receipt_path not like (v_uid::text || '/%')
     or p_receipt_path !~* '^[0-9a-f-]{36}/[A-Za-z0-9._-]+\.(pdf|jpe?g|png|webp)$' then
    raise exception 'invalid_receipt_path';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'note_too_long';
  end if;
  -- The file must really have been uploaded to the private receipts bucket.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'payment-receipts' and o.name = p_receipt_path
  ) then
    raise exception 'receipt_not_uploaded';
  end if;
  select suspended into v_suspended from public.memberships where user_id = v_uid;
  if coalesce(v_suspended, false) then
    raise exception 'account_suspended';
  end if;
  select count(*) into v_recent
  from public.payment_submissions
  where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    raise exception 'too_many_submissions';
  end if;

  select monthly_fee_amount, currency into v_fee, v_currency from public.payment_settings where id = 1;
  begin
    insert into public.payment_submissions (user_id, receipt_path, member_note, fee_amount, currency)
    values (v_uid, p_receipt_path, nullif(btrim(p_note), ''), coalesce(v_fee, 0), coalesce(v_currency, 'NGN'))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'pending_submission_exists';
  end;

  select full_name into v_name from public.profiles where user_id = v_uid;
  insert into public.notifications (user_id, kind, title, body, link)
  select a.user_id, 'payment_submitted', 'New payment receipt to review',
         coalesce(v_name, 'A member') || ' submitted a receipt.', '/admin'
  from app_private.admin_users a;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin actions: approve / reject
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_payment(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  s public.payment_submissions;
  v_old timestamptz;
  v_start timestamptz;
  v_new timestamptz;
  v_now timestamptz := now();
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.payment_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found';
  end if;
  if s.status <> 'pending' then
    raise exception 'submission_already_reviewed';
  end if;

  select access_expires_at into v_old from public.memberships where user_id = s.user_id for update;
  -- Renewing before the old expiry (or inside the 24h grace): continue from the old expiry.
  -- Otherwise (first payment, or lapsed): start from now.
  if v_old is not null and v_old + app_private.grace_period() > v_now then
    v_start := v_old;
  else
    v_start := v_now;
  end if;
  v_new := ((v_start at time zone 'Africa/Lagos') + interval '1 month') at time zone 'Africa/Lagos';

  update public.payment_submissions
  set status = 'approved', admin_comment = null, reviewed_by = auth.uid(), reviewed_at = v_now,
      period_start = v_start, period_end = v_new
  where id = s.id;

  insert into public.memberships (user_id, access_expires_at, last_approved_at)
  values (s.user_id, v_new, v_now)
  on conflict (user_id) do update
    set access_expires_at = excluded.access_expires_at,
        last_approved_at = excluded.last_approved_at;

  insert into public.notifications (user_id, kind, title, body, link)
  values (s.user_id, 'payment_approved', 'Payment approved',
          'Your membership is active until ' || to_char(v_new at time zone 'Africa/Lagos', 'DD Mon YYYY') || '.',
          '/dashboard');

  return jsonb_build_object('user_id', s.user_id, 'period_start', v_start, 'access_expires_at', v_new);
end;
$$;

create or replace function public.admin_reject_payment(p_submission_id uuid, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  s public.payment_submissions;
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(v_comment) < 3 or length(v_comment) > 1000 then
    raise exception 'comment_required';
  end if;
  select * into s from public.payment_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found';
  end if;
  if s.status <> 'pending' then
    raise exception 'submission_already_reviewed';
  end if;

  update public.payment_submissions
  set status = 'rejected', admin_comment = v_comment, reviewed_by = auth.uid(), reviewed_at = now()
  where id = s.id;

  insert into public.notifications (user_id, kind, title, body, link)
  values (s.user_id, 'payment_rejected', 'Payment not approved', 'Reason: ' || v_comment, '/dashboard');

  return jsonb_build_object('user_id', s.user_id, 'status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
revoke all on function app_private.grace_period() from public, anon, authenticated;
revoke all on function app_private.touch_payment_settings() from public, anon, authenticated;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;
revoke all on function app_private.has_member_access() from public, anon, authenticated;
grant execute on function app_private.has_member_access() to anon, authenticated;
grant execute on function app_private.grace_period() to anon, authenticated;

revoke all on function public.get_my_membership() from public, anon, authenticated;
revoke all on function public.submit_payment(text, text) from public, anon, authenticated;
revoke all on function public.admin_approve_payment(uuid) from public, anon, authenticated;
revoke all on function public.admin_reject_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.get_my_membership() to authenticated;
grant execute on function public.submit_payment(text, text) to authenticated;
grant execute on function public.admin_approve_payment(uuid) to authenticated;
grant execute on function public.admin_reject_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid() or app_private.is_admin());

drop policy if exists "members update own profile" on public.profiles;
create policy "members update own profile" on public.profiles
  for update to authenticated
  using (user_id = auth.uid() or app_private.is_admin())
  with check (user_id = auth.uid() or app_private.is_admin());

drop policy if exists "members read own membership" on public.memberships;
create policy "members read own membership" on public.memberships
  for select to authenticated using (user_id = auth.uid() or app_private.is_admin());

-- Any signed-in user (including pending ones) may read the bank details they need to pay.
drop policy if exists "signed-in users read payment settings" on public.payment_settings;
create policy "signed-in users read payment settings" on public.payment_settings
  for select to authenticated using (true);

drop policy if exists "administrators update payment settings" on public.payment_settings;
create policy "administrators update payment settings" on public.payment_settings
  for update to authenticated
  using (app_private.is_admin()) with check (app_private.is_admin());

drop policy if exists "members read own payments" on public.payment_submissions;
create policy "members read own payments" on public.payment_submissions
  for select to authenticated using (user_id = auth.uid() or app_private.is_admin());

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges: nothing by default, then only what each role needs
-- ---------------------------------------------------------------------------
revoke all privileges on table public.profiles, public.memberships, public.payment_settings,
  public.payment_submissions, public.notifications from public, anon, authenticated;

grant select on public.profiles, public.memberships, public.payment_settings,
  public.payment_submissions, public.notifications to authenticated;

-- Members can edit only their own descriptive fields, never ids, email or status.
grant update (full_name, phone, whatsapp, photo_path, business_name, profession, industry,
  location, bio, skills, linkedin_url, instagram_url, website_url,
  show_email, show_phone, show_whatsapp, listed)
  on public.profiles to authenticated;

grant update (monthly_fee_amount, currency, bank_name, account_name, account_number,
  payment_instructions) on public.payment_settings to authenticated;

grant update (read_at) on public.notifications to authenticated;

-- Writes to memberships and payment_submissions happen ONLY through the
-- functions above. Nobody gets insert/update/delete on them directly.

-- ---------------------------------------------------------------------------
-- Private storage for payment receipts (PDF + images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts read own or admin" on storage.objects;
create policy "receipts read own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or app_private.is_admin())
  );

-- Upload only into your own folder, one level deep, max 10 files in total.
drop policy if exists "receipts upload own folder" on storage.objects;
create policy "receipts upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'payment-receipts'
        and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 10
  );

drop policy if exists "receipts delete admin only" on storage.objects;
create policy "receipts delete admin only" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payment-receipts' and app_private.is_admin());

commit;
