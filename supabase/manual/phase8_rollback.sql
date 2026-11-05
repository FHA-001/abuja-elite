-- Abuja Elite Phase 7b: UNDO. Removes event sign-up.
-- WARNING: this deletes every event sign-up and every ticket price you have set.
-- Membership, payments, profiles and announcements are not touched.
begin;
drop function if exists public.register_for_event(uuid);
drop function if exists public.submit_event_payment(uuid, text, text);
drop function if exists public.cancel_event_registration(uuid);
drop function if exists public.admin_review_event_signup(uuid, boolean, text);
drop table if exists public.event_registrations cascade;
alter table public.events drop column if exists price_amount;

-- back to the earlier summary (without the event sign-ups count)
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

-- back to the earlier limit of 10 receipt files per member
drop policy if exists "receipts upload own folder" on storage.objects;
create policy "receipts upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) = 1
    and (select count(*) from storage.objects o
         where o.bucket_id = 'payment-receipts' and (storage.foldername(o.name))[1] = auth.uid()::text) < 10
  );
commit;
