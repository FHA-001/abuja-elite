-- Abuja Elite: event sign-up, free and paid (Phase 7b)
-- Repeatable. Adds:
--   events.price_amount          0 = free event, anything above 0 = paid event (naira)
--   event_registrations          who signed up for which event, and their status
--   register_for_event()         free events: one tap
--   submit_event_payment()       paid events: member uploads a bank-transfer receipt
--   cancel_event_registration()  member cancels (paid + approved needs the admin)
--   admin_review_event_signup()  admin approves or rejects a paid sign-up
-- Also: admin_membership_summary() now counts waiting event sign-ups, and a member may keep
-- up to 30 receipt files (membership + events) instead of 10.

begin;

alter table public.events
  add column if not exists price_amount numeric(12, 2) not null default 0 check (price_amount >= 0);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('going', 'pending', 'approved', 'rejected', 'cancelled')),
  receipt_path text check (
    receipt_path is null
    or (length(receipt_path) <= 200 and receipt_path like (user_id::text || '/%')
        and receipt_path ~* '\.(pdf|jpe?g|png|webp)$')
  ),
  member_note text check (member_note is null or length(member_note) <= 500),
  fee_amount numeric(12, 2) not null default 0,
  admin_comment text check (admin_comment is null or length(admin_comment) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists event_registrations_review_idx on public.event_registrations (status, created_at desc);
create index if not exists event_registrations_user_idx on public.event_registrations (user_id);

drop trigger if exists set_updated_at on public.event_registrations;
create trigger set_updated_at before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;
drop policy if exists "members read own event registrations" on public.event_registrations;
create policy "members read own event registrations" on public.event_registrations
  for select to authenticated using (user_id = auth.uid() or app_private.is_admin());
revoke all privileges on table public.event_registrations from public, anon, authenticated;
grant select on public.event_registrations to authenticated;
-- All writes go through the functions below.

-- ---------------------------------------------------------------------------
-- Free events: one tap
-- ---------------------------------------------------------------------------
create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_uid uuid := auth.uid();
  ev public.events;
  v_status text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not app_private.has_member_access() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into ev from public.events where id = p_event_id and published;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status <> 'scheduled' then raise exception 'event_cancelled'; end if;
  if coalesce(ev.ends_at, ev.starts_at) < now() then raise exception 'event_over'; end if;
  if ev.price_amount > 0 then raise exception 'payment_required'; end if;

  insert into public.event_registrations (event_id, user_id, status, fee_amount)
  values (p_event_id, v_uid, 'going', 0)
  on conflict (event_id, user_id) do update
    set status = case when public.event_registrations.status = 'approved' then 'approved' else 'going' end,
        admin_comment = null
  returning status into v_status;
  return jsonb_build_object('event_id', p_event_id, 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Paid events: receipt for a bank transfer
-- ---------------------------------------------------------------------------
create or replace function public.submit_event_payment(p_event_id uuid, p_receipt_path text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_uid uuid := auth.uid();
  ev public.events;
  v_existing text;
  v_name text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not app_private.has_member_access() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_receipt_path is null or length(p_receipt_path) > 200
     or p_receipt_path not like (v_uid::text || '/%')
     or p_receipt_path !~* '^[0-9a-f-]{36}/[A-Za-z0-9._-]+\.(pdf|jpe?g|png|webp)$' then
    raise exception 'invalid_receipt_path';
  end if;
  if p_note is not null and length(p_note) > 500 then raise exception 'note_too_long'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'payment-receipts' and o.name = p_receipt_path) then
    raise exception 'receipt_not_uploaded';
  end if;

  select * into ev from public.events where id = p_event_id and published;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status <> 'scheduled' then raise exception 'event_cancelled'; end if;
  if coalesce(ev.ends_at, ev.starts_at) < now() then raise exception 'event_over'; end if;
  if ev.price_amount <= 0 then raise exception 'event_is_free'; end if;

  select status into v_existing from public.event_registrations
  where event_id = p_event_id and user_id = v_uid for update;
  if v_existing = 'pending' then raise exception 'already_pending'; end if;
  if v_existing = 'approved' then raise exception 'already_registered'; end if;

  insert into public.event_registrations (event_id, user_id, status, receipt_path, member_note, fee_amount)
  values (p_event_id, v_uid, 'pending', p_receipt_path, nullif(btrim(p_note), ''), ev.price_amount)
  on conflict (event_id, user_id) do update
    set status = 'pending', receipt_path = excluded.receipt_path, member_note = excluded.member_note,
        fee_amount = excluded.fee_amount, admin_comment = null, reviewed_by = null, reviewed_at = null;

  select full_name into v_name from public.profiles where user_id = v_uid;
  insert into public.notifications (user_id, kind, title, body, link)
  select a.user_id, 'event_payment_submitted', 'New event payment to review',
         coalesce(v_name, 'A member') || ' paid for ' || ev.title || '.', '/admin'
  from app_private.admin_users a;

  return jsonb_build_object('event_id', p_event_id, 'status', 'pending');
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel
-- ---------------------------------------------------------------------------
create or replace function public.cancel_event_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select status into v_status from public.event_registrations
  where event_id = p_event_id and user_id = v_uid for update;
  if not found then raise exception 'not_registered'; end if;
  if v_status = 'approved' then raise exception 'contact_admin'; end if;
  if v_status in ('going', 'pending') then
    update public.event_registrations set status = 'cancelled' where event_id = p_event_id and user_id = v_uid;
  end if;
  return jsonb_build_object('event_id', p_event_id, 'status', 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: approve or reject a paid sign-up
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_event_signup(p_registration_id uuid, p_approve boolean, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  r public.event_registrations;
  v_title text;
  v_slug text;
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if not app_private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.event_registrations where id = p_registration_id for update;
  if not found then raise exception 'signup_not_found'; end if;
  if r.status <> 'pending' then raise exception 'signup_already_reviewed'; end if;
  select title, slug into v_title, v_slug from public.events where id = r.event_id;

  if p_approve then
    update public.event_registrations
    set status = 'approved', admin_comment = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = r.id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'event_payment_approved', 'You are registered',
            'Your payment for ' || v_title || ' was approved. See you there.', '/experiences/' || v_slug);
  else
    if length(v_comment) < 3 or length(v_comment) > 1000 then raise exception 'comment_required'; end if;
    update public.event_registrations
    set status = 'rejected', admin_comment = v_comment, reviewed_by = auth.uid(), reviewed_at = now()
    where id = r.id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (r.user_id, 'event_payment_rejected', 'Event payment not approved',
            v_title || ': ' || v_comment, '/experiences/' || v_slug);
  end if;
  return jsonb_build_object('registration_id', r.id, 'status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Summary now also counts waiting event sign-ups (same function, one more key)
-- ---------------------------------------------------------------------------
create or replace function public.admin_membership_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_now timestamptz := now();
  v_grace interval := app_private.grace_period();
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'waiting_receipts', (select count(*) from public.payment_submissions where status = 'pending'),
      'waiting_event_signups', (select count(*) from public.event_registrations where status = 'pending'),
      'not_paid_yet', count(*) filter (where not m.suspended and m.access_expires_at is null),
      'active', count(*) filter (where not m.suspended and m.access_expires_at is not null and v_now <= m.access_expires_at),
      'expiring_soon', count(*) filter (where not m.suspended and m.access_expires_at is not null
                                         and v_now <= m.access_expires_at and m.access_expires_at <= v_now + interval '7 days'),
      'grace', count(*) filter (where not m.suspended and m.access_expires_at is not null
                                 and v_now > m.access_expires_at and v_now <= m.access_expires_at + v_grace),
      'expired', count(*) filter (where not m.suspended and m.access_expires_at is not null
                                   and v_now > m.access_expires_at + v_grace),
      'suspended', count(*) filter (where m.suspended),
      'admin_ids', (select coalesce(jsonb_agg(a.user_id), '[]'::jsonb) from app_private.admin_users a)
    )
    from public.memberships m
    where m.user_id not in (select user_id from app_private.admin_users)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A member may keep up to 30 receipt files (membership payments + event payments)
-- ---------------------------------------------------------------------------
drop policy if exists "receipts upload own folder" on storage.objects;
create policy "receipts upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'payment-receipts' and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 30
  );

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke all on function public.register_for_event(uuid) from public, anon, authenticated;
revoke all on function public.submit_event_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_event_registration(uuid) from public, anon, authenticated;
revoke all on function public.admin_review_event_signup(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_membership_summary() from public, anon, authenticated;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.submit_event_payment(uuid, text, text) to authenticated;
grant execute on function public.cancel_event_registration(uuid) to authenticated;
grant execute on function public.admin_review_event_signup(uuid, boolean, text) to authenticated;
grant execute on function public.admin_membership_summary() to authenticated;

commit;
