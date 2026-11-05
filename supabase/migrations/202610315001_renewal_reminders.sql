-- Abuja Elite: renewal reminders (Phase 8)
-- Repeatable. Adds:
--   app_private.send_membership_reminders()  creates in-app notifications for members whose
--                                            membership is ending / ended. Each reminder is sent once
--                                            per membership period (re-running is harmless).
--   public.admin_run_reminders()             lets an admin run it from the admin screen
--   live notifications                       the notifications table is added to Realtime (if present)
--
-- Reminder moments (each once per membership period):
--   7 days left   -> "renew_7d"
--   2 days left   -> "renew_2d"
--   ended         -> "grace"   (24-hour grace period running)
--   access closed -> "closed"  (only within 3 days after the grace period ends)

begin;

create table if not exists app_private.reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  period_end timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, period_end)
);
revoke all on table app_private.reminder_log from public, anon, authenticated;

create or replace function app_private.send_membership_reminders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  r record;
  v_now timestamptz := now();
  v_grace interval := app_private.grace_period();
  v_kind text;
  v_title text;
  v_body text;
  v_date text;
  v_inserted integer;
  v_sent integer := 0;
begin
  for r in
    select m.user_id, m.access_expires_at as ends
    from public.memberships m
    where m.access_expires_at is not null
      and not m.suspended
      and m.user_id not in (select user_id from app_private.admin_users)
      and v_now <= m.access_expires_at + v_grace + interval '3 days'
      and v_now >= m.access_expires_at - interval '7 days'
  loop
    v_date := to_char(r.ends at time zone 'Africa/Lagos', 'DD Mon YYYY');
    v_kind := null;
    if v_now <= r.ends then
      if r.ends - v_now <= interval '2 days' then
        v_kind := 'renew_2d';
        v_title := 'Your membership ends very soon';
        v_body := 'Your access ends on ' || v_date || '. Renew now to keep it without a break.';
      else
        v_kind := 'renew_7d';
        v_title := 'Your membership ends in a week';
        v_body := 'Your access ends on ' || v_date || '. You can renew from your account page.';
      end if;
    elsif v_now <= r.ends + v_grace then
      v_kind := 'grace';
      v_title := 'Your membership has ended';
      v_body := 'You are in a 24-hour grace period. Renew now to keep your access.';
    else
      v_kind := 'closed';
      v_title := 'Your access has closed';
      v_body := 'Your membership ended on ' || v_date || '. Renew to open the members-only pages again.';
    end if;

    insert into app_private.reminder_log (user_id, kind, period_end)
    values (r.user_id, v_kind, r.ends)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then
      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, v_kind, v_title, v_body, '/account');
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end;
$$;
-- The scheduler (and admins, through the wrapper below) are the only callers.
revoke all on function app_private.send_membership_reminders() from public, anon, authenticated;

create or replace function public.admin_run_reminders()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object('sent', app_private.send_membership_reminders());
end;
$$;
revoke all on function public.admin_run_reminders() from public, anon, authenticated;
grant execute on function public.admin_run_reminders() to authenticated;

-- New notifications appear instantly in the app (Supabase Realtime), when it is available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
