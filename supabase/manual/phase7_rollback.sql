-- Abuja Elite Phase 7a: UNDO. Removes announcements and the new-members list.
-- WARNING: this deletes every announcement the admin has written.
begin;
drop function if exists public.recent_members(integer);
drop table if exists public.announcements cascade;
commit;
