-- Abuja Elite Phase 3: UNDO. Removes only the two admin functions added in Phase 3.
-- Safe to run: it does not delete any member, payment or other data.
-- (After this the admin Payments / Member accounts screens will show errors until you run the migration again.)
begin;
drop function if exists public.admin_set_suspended(uuid, boolean);
drop function if exists public.admin_membership_summary();
commit;
