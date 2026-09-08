-- Run this file read-only in the intended Supabase project's SQL editor after
-- applying supabase/migrations/202609050001_phase_2_foundation.sql.
--
-- These catalog/privilege checks do not prove behavior by themselves. Run the
-- rollback-isolated behavioral procedure in
-- supabase/verification/phase-2-behavioral-tests.sql separately.

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
)
select
  expected.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  case
    when c.oid is null then 'MISSING'
    when not c.relrowsecurity then 'RLS_DISABLED'
    else 'OK'
  end as status
from expected
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name;

with expected(bucket_id, expected_size, expected_mime_types) as (
  values
    ('member-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('collaboration-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('story-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('gallery-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('site-assets', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
)
select
  expected.bucket_id,
  (b.id is not null) as bucket_exists,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  case
    when b.id is null then 'MISSING'
    when b.public is distinct from false
      or b.file_size_limit is distinct from expected.expected_size
      or cardinality(coalesce(b.allowed_mime_types, '{}'::text[]))
         <> cardinality(expected.expected_mime_types)
      or not (
        coalesce(b.allowed_mime_types, '{}'::text[])
        @> expected.expected_mime_types
      )
      then 'INCORRECT_SETTINGS'
    else 'OK'
  end as status
from expected
left join storage.buckets b
  on b.id = expected.bucket_id
order by expected.bucket_id;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
),
roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select
  expected.table_name,
  roles.role_name,
  privileges.privilege_type,
  case
    when c.oid is null then false
    else has_table_privilege(
      roles.role_name,
      c.oid,
      privileges.privilege_type
    )
  end as privilege_granted
from expected
cross join roles
cross join privileges
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name, roles.role_name, privileges.privilege_type;

with roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  roles.role_name,
  privileges.privilege_type,
  has_table_privilege(
    roles.role_name,
    'app_private.admin_users'::regclass,
    privileges.privilege_type
  ) as direct_privilege_granted
from roles
cross join privileges
order by roles.role_name, privileges.privilege_type;

select
  n.nspname as schema_name,
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as configuration,
  p.proacl as access_control_list,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'app_private' and p.proname = 'is_admin')
   or (n.nspname = 'public' and p.proname = 'is_current_user_admin')
order by n.nspname, p.oid::regprocedure::text;

-- SQL Editor identity is not a signed-in website session. In the SQL Editor,
-- auth.uid() is normally null, so this result should not be used as the
-- allowlisted administrator test. Use the behavioral procedure for that.
select
  current_user,
  auth.uid() as auth_uid,
  public.is_current_user_admin() as current_user_is_admin;-- Run this file read-only in the intended Supabase project's SQL editor after
-- applying supabase/migrations/202609050001_phase_2_foundation.sql.
--
-- These catalog/privilege checks do not prove behavior by themselves. Run the
-- rollback-isolated behavioral procedure in
-- supabase/verification/phase-2-behavioral-tests.sql separately.

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
)
select
  expected.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  case
    when c.oid is null then 'MISSING'
    when not c.relrowsecurity then 'RLS_DISABLED'
    else 'OK'
  end as status
from expected
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name;

with expected(bucket_id, expected_size, expected_mime_types) as (
  values
    ('member-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('collaboration-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('story-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('gallery-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('site-assets', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
)
select
  expected.bucket_id,
  (b.id is not null) as bucket_exists,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  case
    when b.id is null then 'MISSING'
    when b.public is distinct from false
      or b.file_size_limit is distinct from expected.expected_size
      or cardinality(coalesce(b.allowed_mime_types, '{}'::text[]))
         <> cardinality(expected.expected_mime_types)
      or not (
        coalesce(b.allowed_mime_types, '{}'::text[])
        @> expected.expected_mime_types
      )
      then 'INCORRECT_SETTINGS'
    else 'OK'
  end as status
from expected
left join storage.buckets b
  on b.id = expected.bucket_id
order by expected.bucket_id;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
),
roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select
  expected.table_name,
  roles.role_name,
  privileges.privilege_type,
  case
    when c.oid is null then false
    else has_table_privilege(
      roles.role_name,
      c.oid,
      privileges.privilege_type
    )
  end as privilege_granted
from expected
cross join roles
cross join privileges
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name, roles.role_name, privileges.privilege_type;

with roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  roles.role_name,
  privileges.privilege_type,
  has_table_privilege(
    roles.role_name,
    'app_private.admin_users'::regclass,
    privileges.privilege_type
  ) as direct_privilege_granted
from roles
cross join privileges
order by roles.role_name, privileges.privilege_type;

select
  n.nspname as schema_name,
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as configuration,
  p.proacl as access_control_list,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'app_private' and p.proname = 'is_admin')
   or (n.nspname = 'public' and p.proname = 'is_current_user_admin')
order by n.nspname, p.oid::regprocedure::text;

-- SQL Editor identity is not a signed-in website session. In the SQL Editor,
-- auth.uid() is normally null, so this result should not be used as the
-- allowlisted administrator test. Use the behavioral procedure for that.
select
  current_user,
  auth.uid() as auth_uid,
  public.is_current_user_admin() as current_user_is_admin;-- Run this file read-only in the intended Supabase project's SQL editor after
-- applying supabase/migrations/202609050001_phase_2_foundation.sql.
--
-- These catalog/privilege checks do not prove behavior by themselves. Run the
-- rollback-isolated behavioral procedure in
-- supabase/verification/phase-2-behavioral-tests.sql separately.

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
)
select
  expected.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  case
    when c.oid is null then 'MISSING'
    when not c.relrowsecurity then 'RLS_DISABLED'
    else 'OK'
  end as status
from expected
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name;

with expected(bucket_id, expected_size, expected_mime_types) as (
  values
    ('member-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('collaboration-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('story-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('gallery-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('site-assets', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
)
select
  expected.bucket_id,
  (b.id is not null) as bucket_exists,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  case
    when b.id is null then 'MISSING'
    when b.public is distinct from false
      or b.file_size_limit is distinct from expected.expected_size
      or cardinality(coalesce(b.allowed_mime_types, '{}'::text[]))
         <> cardinality(expected.expected_mime_types)
      or not (
        coalesce(b.allowed_mime_types, '{}'::text[])
        @> expected.expected_mime_types
      )
      then 'INCORRECT_SETTINGS'
    else 'OK'
  end as status
from expected
left join storage.buckets b
  on b.id = expected.bucket_id
order by expected.bucket_id;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
),
roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select
  expected.table_name,
  roles.role_name,
  privileges.privilege_type,
  case
    when c.oid is null then false
    else has_table_privilege(
      roles.role_name,
      c.oid,
      privileges.privilege_type
    )
  end as privilege_granted
from expected
cross join roles
cross join privileges
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name, roles.role_name, privileges.privilege_type;

with roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  roles.role_name,
  privileges.privilege_type,
  has_table_privilege(
    roles.role_name,
    'app_private.admin_users'::regclass,
    privileges.privilege_type
  ) as direct_privilege_granted
from roles
cross join privileges
order by roles.role_name, privileges.privilege_type;

select
  n.nspname as schema_name,
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as configuration,
  p.proacl as access_control_list,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'app_private' and p.proname = 'is_admin')
   or (n.nspname = 'public' and p.proname = 'is_current_user_admin')
order by n.nspname, p.oid::regprocedure::text;

-- SQL Editor identity is not a signed-in website session. In the SQL Editor,
-- auth.uid() is normally null, so this result should not be used as the
-- allowlisted administrator test. Use the behavioral procedure for that.
select
  current_user,
  auth.uid() as auth_uid,
  public.is_current_user_admin() as current_user_is_admin;-- Run this file read-only in the intended Supabase project's SQL editor after
-- applying supabase/migrations/202609050001_phase_2_foundation.sql.
--
-- These catalog/privilege checks do not prove behavior by themselves. Run the
-- rollback-isolated behavioral procedure in
-- supabase/verification/phase-2-behavioral-tests.sql separately.

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
)
select
  expected.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  case
    when c.oid is null then 'MISSING'
    when not c.relrowsecurity then 'RLS_DISABLED'
    else 'OK'
  end as status
from expected
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name;

with expected(bucket_id, expected_size, expected_mime_types) as (
  values
    ('member-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('event-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('collaboration-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('story-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('gallery-images', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[]),
    ('site-assets', 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
)
select
  expected.bucket_id,
  (b.id is not null) as bucket_exists,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  case
    when b.id is null then 'MISSING'
    when b.public is distinct from false
      or b.file_size_limit is distinct from expected.expected_size
      or cardinality(coalesce(b.allowed_mime_types, '{}'::text[]))
         <> cardinality(expected.expected_mime_types)
      or not (
        coalesce(b.allowed_mime_types, '{}'::text[])
        @> expected.expected_mime_types
      )
      then 'INCORRECT_SETTINGS'
    else 'OK'
  end as status
from expected
left join storage.buckets b
  on b.id = expected.bucket_id
order by expected.bucket_id;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

with expected(table_name) as (
  values
    ('members'),
    ('collaborations'),
    ('events'),
    ('stories'),
    ('gallery_items'),
    ('applications'),
    ('contact_messages'),
    ('event_interests'),
    ('newsletter_subscribers'),
    ('site_settings')
),
roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select
  expected.table_name,
  roles.role_name,
  privileges.privilege_type,
  case
    when c.oid is null then false
    else has_table_privilege(
      roles.role_name,
      c.oid,
      privileges.privilege_type
    )
  end as privilege_granted
from expected
cross join roles
cross join privileges
left join pg_namespace n
  on n.nspname = 'public'
left join pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
order by expected.table_name, roles.role_name, privileges.privilege_type;

with roles(role_name) as (
  values ('anon'), ('authenticated')
),
privileges(privilege_type) as (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
)
select
  roles.role_name,
  privileges.privilege_type,
  has_table_privilege(
    roles.role_name,
    'app_private.admin_users'::regclass,
    privileges.privilege_type
  ) as direct_privilege_granted
from roles
cross join privileges
order by roles.role_name, privileges.privilege_type;

select
  n.nspname as schema_name,
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as configuration,
  p.proacl as access_control_list,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'app_private' and p.proname = 'is_admin')
   or (n.nspname = 'public' and p.proname = 'is_current_user_admin')
order by n.nspname, p.oid::regprocedure::text;

-- SQL Editor identity is not a signed-in website session. In the SQL Editor,
-- auth.uid() is normally null, so this result should not be used as the
-- allowlisted administrator test. Use the behavioral procedure for that.
select
  current_user,
  auth.uid() as auth_uid,
  public.is_current_user_admin() as current_user_is_admin;