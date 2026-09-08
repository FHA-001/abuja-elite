-- Rollback-isolated Phase 2 behavioral checks.
--
-- Run this entire file as the trusted Supabase SQL Editor owner. Replace the
-- two UUID placeholders with existing Auth user IDs:
--   - ordinary_user_id must exist in auth.users and must not be an admin.
--   - admin_user_id must exist in auth.users and must already be present in
--     app_private.admin_users.
--
-- The script creates temporary fixtures, switches between anon and
-- authenticated JWT contexts, checks expected visibility/denials, tests an
-- allowlisted administrator operation, and rolls everything back. It never
-- inserts fictional records permanently. Storage API upload/download behavior
-- is intentionally separate from the SQL policy/catalog checks.

begin;

select set_config(
  'app.phase2_ordinary_user_id',
  'REPLACE_WITH_ORDINARY_AUTH_USER_UUID',
  true
);
select set_config(
  'app.phase2_admin_user_id',
  'REPLACE_WITH_ALLOWLISTED_ADMIN_AUTH_USER_UUID',
  true
);

do $$
declare
  ordinary_id uuid := current_setting('app.phase2_ordinary_user_id')::uuid;
  admin_id uuid := current_setting('app.phase2_admin_user_id')::uuid;
begin
  if ordinary_id = admin_id then
    raise exception 'Test users must be different Auth users';
  end if;

  if not exists (select 1 from auth.users where id = ordinary_id) then
    raise exception 'The ordinary test user does not exist in auth.users';
  end if;

  if not exists (select 1 from auth.users where id = admin_id) then
    raise exception 'The administrator test user does not exist in auth.users';
  end if;

  if exists (select 1 from app_private.admin_users where user_id = ordinary_id) then
    raise exception 'The ordinary test user is unexpectedly allowlisted';
  end if;

  if not exists (select 1 from app_private.admin_users where user_id = admin_id) then
    raise exception 'The administrator test user is not allowlisted';
  end if;
end
$$;

select set_config('app.phase2_published_member_id', gen_random_uuid()::text, true);
select set_config('app.phase2_draft_member_id', gen_random_uuid()::text, true);
select set_config('app.phase2_published_story_id', gen_random_uuid()::text, true);
select set_config('app.phase2_future_story_id', gen_random_uuid()::text, true);
select set_config('app.phase2_public_setting_id', gen_random_uuid()::text, true);
select set_config('app.phase2_private_setting_id', gen_random_uuid()::text, true);
select set_config('app.phase2_application_id', gen_random_uuid()::text, true);
select set_config('app.phase2_admin_insert_id', gen_random_uuid()::text, true);

-- Fixture creation happens as the trusted owner so it is independent of RLS.
set local role postgres;

insert into public.members (id, name, slug, published)
values
  (
    current_setting('app.phase2_published_member_id')::uuid,
    'Phase 2 Published Fixture',
    'phase-2-published-fixture',
    true
  ),
  (
    current_setting('app.phase2_draft_member_id')::uuid,
    'Phase 2 Draft Fixture',
    'phase-2-draft-fixture',
    false
  );

insert into public.stories (
  id,
  title,
  slug,
  content,
  published,
  published_at
)
values
  (
    current_setting('app.phase2_published_story_id')::uuid,
    'Phase 2 Published Story Fixture',
    'phase-2-published-story-fixture',
    'Published story fixture.',
    true,
    now() - interval '1 hour'
  ),
  (
    current_setting('app.phase2_future_story_id')::uuid,
    'Phase 2 Future Story Fixture',
    'phase-2-future-story-fixture',
    'Future story fixture.',
    true,
    now() + interval '1 hour'
  );

insert into public.site_settings (id, setting_key, value, is_public)
values
  (
    current_setting('app.phase2_public_setting_id')::uuid,
    'phase-2-public-fixture',
    '{"visibility":"public"}'::jsonb,
    true
  ),
  (
    current_setting('app.phase2_private_setting_id')::uuid,
    'phase-2-private-fixture',
    '{"visibility":"private"}'::jsonb,
    false
  );

insert into public.applications (
  id,
  name,
  email,
  message,
  interest
)
values (
  current_setting('app.phase2_application_id')::uuid,
  'Phase 2 Submission Fixture',
  'phase2-fixture@example.com',
  'Submission privacy fixture.',
  'community'
);

-- Anonymous website context.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if (select count(*) from public.members) <> 1 then
    raise exception 'Anonymous users should see only published members';
  end if;

  if (select count(*) from public.stories) <> 1 then
    raise exception 'Anonymous users should not see future-dated stories';
  end if;

  if (select count(*) from public.site_settings) <> 1 then
    raise exception 'Anonymous users should see only public settings';
  end if;

  if public.is_current_user_admin() then
    raise exception 'Anonymous users must not be administrators';
  end if;
end
$$;

do $$
begin
  begin
    insert into public.members (name, slug, published)
    values ('Phase 2 Anonymous Write', 'phase-2-anonymous-write', true);
    raise exception 'Anonymous insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform 1 from public.applications;
    raise exception 'Anonymous submission read unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- Ordinary authenticated website context.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('app.phase2_ordinary_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', current_setting('app.phase2_ordinary_user_id')
  )::text,
  true
);

do $$
begin
  if (select count(*) from public.members) <> 1 then
    raise exception 'Ordinary users should see only published members';
  end if;

  if (select count(*) from public.stories) <> 1 then
    raise exception 'Ordinary users should not see future-dated stories';
  end if;

  if (select count(*) from public.site_settings) <> 1 then
    raise exception 'Ordinary users should see only public settings';
  end if;

  if public.is_current_user_admin() then
    raise exception 'Ordinary users must not be administrators';
  end if;

  if (select count(*) from public.applications) <> 0 then
    raise exception 'Ordinary users must not read submissions';
  end if;
end
$$;

do $$
begin
  begin
    insert into public.members (name, slug, published)
    values ('Phase 2 Ordinary Write', 'phase-2-ordinary-write', true);
    raise exception 'Ordinary insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

-- Allowlisted administrator context.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('app.phase2_admin_user_id'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', current_setting('app.phase2_admin_user_id')
  )::text,
  true
);

do $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Allowlisted administrator was not recognized';
  end if;

  if (select count(*) from public.members) <> 2 then
    raise exception 'Administrator should see draft and published members';
  end if;

  if (select count(*) from public.stories) <> 2 then
    raise exception 'Administrator should see both story fixtures';
  end if;

  if (select count(*) from public.site_settings) <> 2 then
    raise exception 'Administrator should see public and private settings';
  end if;

  if (select count(*) from public.applications) <> 1 then
    raise exception 'Administrator should see submissions';
  end if;

  update public.members
  set name = 'Phase 2 Administrator Updated Fixture'
  where id = current_setting('app.phase2_published_member_id')::uuid;

  if not found then
    raise exception 'Administrator update was denied';
  end if;

  insert into public.members (id, name, slug, published)
  values (
    current_setting('app.phase2_admin_insert_id')::uuid,
    'Phase 2 Administrator Insert Fixture',
    'phase-2-administrator-insert-fixture',
    false
  );

  delete from public.members
  where id = current_setting('app.phase2_admin_insert_id')::uuid;

  if not found then
    raise exception 'Administrator delete was denied';
  end if;
end
$$;

-- No fixture or allowlist state survives this point.
rollback;