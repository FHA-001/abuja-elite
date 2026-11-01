-- Abuja Elite Phase 1: UNDO. Removes everything the Phase 1 migration created.
-- It does not touch any older table, policy or bucket.
-- WARNING: this deletes all member profiles, memberships, payment records and
-- notifications. Only use it before real members exist, or after a backup.
-- The "payment-receipts" bucket is only removed if it is empty. If it still holds
-- files, the bucket is left in place (no harm) and you can delete it later in the
-- dashboard under Storage.
begin;
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "receipts read own or admin" on storage.objects;
drop policy if exists "receipts upload own folder" on storage.objects;
drop policy if exists "receipts delete admin only" on storage.objects;
drop function if exists public.admin_approve_payment(uuid);
drop function if exists public.admin_reject_payment(uuid, text);
drop function if exists public.submit_payment(text, text);
drop function if exists public.get_my_membership();
drop table if exists public.notifications cascade;
drop table if exists public.payment_submissions cascade;
drop table if exists public.payment_settings cascade;
drop table if exists public.memberships cascade;
drop table if exists public.profiles cascade;
drop function if exists app_private.has_member_access();
drop function if exists app_private.handle_new_user();
drop function if exists app_private.touch_payment_settings();
drop function if exists app_private.grace_period();
delete from storage.buckets
where id = 'payment-receipts'
  and not exists (select 1 from storage.objects where bucket_id = 'payment-receipts');
commit;
