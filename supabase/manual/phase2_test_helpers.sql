-- Abuja Elite Phase 2: helper snippets for TESTING before the admin payments
-- screen exists (that screen arrives in Phase 3).
-- Run ONE numbered block at a time in the Supabase SQL Editor.
-- Select just the block you want, then press Run.

-- ============================================================
-- 1. Set the payment details members will see (edit the values first)
-- ============================================================
update public.payment_settings
set monthly_fee_amount   = 15000,
    currency             = 'NGN',
    bank_name            = 'Your Bank Name',
    account_name         = 'Abuja Elite',
    account_number       = '0123456789',
    payment_instructions = 'Use your full name as the transfer reference.'
where id = 1;

-- ============================================================
-- 2. See every receipt that has been submitted
--    (the file itself: Storage > payment-receipts > open the member's folder)
-- ============================================================
select s.id, p.full_name, p.email, s.fee_amount, s.status, s.created_at, s.receipt_path
from public.payment_submissions s
join public.profiles p on p.user_id = s.user_id
order by s.created_at desc;

-- ============================================================
-- 3. APPROVE the oldest receipt that is waiting
--    (acts as your first admin account)
-- ============================================================
do $$
declare v_admin uuid; v_id uuid;
begin
  select user_id into v_admin from app_private.admin_users order by created_at limit 1;
  select id into v_id from public.payment_submissions where status = 'pending' order by created_at limit 1;
  if v_admin is null then raise exception 'No admin account found.'; end if;
  if v_id is null then raise exception 'No receipt is waiting for review.'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.admin_approve_payment(v_id);
end $$;

-- ============================================================
-- 4. REJECT the oldest receipt that is waiting (edit the reason first)
-- ============================================================
do $$
declare v_admin uuid; v_id uuid;
begin
  select user_id into v_admin from app_private.admin_users order by created_at limit 1;
  select id into v_id from public.payment_submissions where status = 'pending' order by created_at limit 1;
  if v_admin is null then raise exception 'No admin account found.'; end if;
  if v_id is null then raise exception 'No receipt is waiting for review.'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.admin_reject_payment(v_id, 'The receipt is blurry. Please upload a clearer photo.');
end $$;

-- ============================================================
-- 5. See every member and their access
-- ============================================================
select p.full_name, p.email, m.access_expires_at, m.suspended
from public.memberships m
join public.profiles p on p.user_id = m.user_id
order by p.created_at desc;

-- ============================================================
-- 6. TEST helpers for one account (put the test email in the quotes)
-- ============================================================
-- 6a. make it expire in 1 hour, to see the "renew early" and grace screens:
-- update public.memberships set access_expires_at = now() + interval '1 hour'
-- where user_id = (select user_id from public.profiles where email = 'test@example.com');

-- 6b. put it just past expiry (inside the 24-hour grace):
-- update public.memberships set access_expires_at = now() - interval '2 hours'
-- where user_id = (select user_id from public.profiles where email = 'test@example.com');

-- 6c. put it well past expiry (access lost):
-- update public.memberships set access_expires_at = now() - interval '3 days'
-- where user_id = (select user_id from public.profiles where email = 'test@example.com');

-- 6d. back to brand-new / pending:
-- update public.memberships set access_expires_at = null, last_approved_at = null
-- where user_id = (select user_id from public.profiles where email = 'test@example.com');
