-- Abuja Elite: admin tools for membership (Phase 3)
-- Additive and repeatable. Adds two admin-only functions:
--   admin_set_suspended      suspend or restore one member's access
--   admin_membership_summary counts for the admin overview and sidebar badge,
--                            plus the ids of admin accounts so the list can label them

begin;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.memberships set suspended = p_suspended where user_id = p_user_id;
  if not found then
    raise exception 'member_not_found';
  end if;
  return jsonb_build_object('user_id', p_user_id, 'suspended', p_suspended);
end;
$$;

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

revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_membership_summary() from public, anon, authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_membership_summary() to authenticated;

commit;
