# Abuja Elite Phase 2 — Supabase foundation

This phase adds the local Supabase browser client, typed data-access helpers,
versioned database/storage policies, and reusable authentication/media helpers.
The homepage remains hardcoded and intentionally does not query Supabase yet.
Public submission flows remain deferred to Phase 4.

## Files

- `supabase/migrations/202609050001_phase_2_foundation.sql`
  - Creates the application schema, RLS policies, admin allowlist, content
    tables, submission tables, triggers, indexes, and private Storage buckets.
- `supabase/verification/phase-2-verification.sql`
  - Read-only checks to run after the migration in the intended Supabase
    project.
- `supabase/verification/phase-2-behavioral-tests.sql`
  - Rollback-isolated checks for anonymous, ordinary authenticated, and
    allowlisted administrator visibility and mutation behavior.
- `artifacts/abuja-elite/src/lib/supabase/client.ts`
  - Typed browser client using only the publishable Vite variables.
- `artifacts/abuja-elite/src/lib/supabase/database.types.ts`
  - Interim types matching the migration. Generate replacement types after
    remote access is available.
- `artifacts/abuja-elite/src/lib/supabase/auth.ts`
  - Email/password sign-in, sign-out, session lookup, auth subscriptions, and
    current-user administrator checks.
- `artifacts/abuja-elite/src/hooks/use-supabase-auth.ts`
  - Reusable loading, authenticated, unauthenticated, and error state hook.
- `artifacts/abuja-elite/src/lib/supabase/content.ts`
  - Bounded, deterministically ordered published-content queries.
- `artifacts/abuja-elite/src/lib/supabase/storage.ts`
  - Admin upload, delete, and short-lived preview helpers for private media.

## Apply remotely

Remote migration application is pending because no Supabase management
connection is attached to this environment. The publishable browser key cannot
run DDL and must not be replaced with a `service_role` key.

In the intended Abuja Elite Supabase project:

1. Run the migration file in the Supabase SQL Editor:
   `supabase/migrations/202609050001_phase_2_foundation.sql`
2. Run the separate read-only verification file:
   `supabase/verification/phase-2-verification.sql`
3. Replace the two Auth UUID placeholders and run the rollback-isolated
   behavioral procedure:
   `supabase/verification/phase-2-behavioral-tests.sql`
4. Confirm every application table reports `rls_enabled = true`.
5. Confirm all six buckets are private, limited to 5 MiB, and restricted to
   JPEG, PNG, and WebP.
6. Generate authoritative types from the linked project:

   ```bash
   npx supabase gen types typescript --linked \
     > artifacts/abuja-elite/src/lib/supabase/database.types.ts
   ```

### Separate Storage API behavior check

The read-only verification file only inspects bucket settings and Storage
policies. It does not prove the Storage API behavior. After creating the
allowlisted administrator and applying the migration, test the API separately:

1. As an anonymous client, confirm upload, list, download, update, and delete
   requests against each private bucket are denied.
2. As an ordinary authenticated client, repeat those requests and confirm they
   are denied.
3. As the allowlisted administrator, upload one JPEG or WebP fixture to a
   unique object path, confirm a short-lived signed preview can be generated,
   download it, update or replace it, and delete it.
4. Confirm a disallowed MIME type and a file larger than 5 MiB are rejected.
5. Remove the test object and keep the test outside the SQL transaction; Storage
   API operations are not rolled back by the SQL behavioral script.

## Initial administrator setup

The browser cannot grant itself administrator access. After creating the first
user in Supabase Auth, copy that exact Auth user UUID into the private
allowlist from the trusted SQL Editor:

```sql
insert into app_private.admin_users (user_id)
values ('AUTH_USER_UUID');
```

Before using the admin-only authentication scope in production:

- Disable public signup in Supabase Auth.
- Configure the exact local and deployed redirect URLs.
- Configure password recovery.
- Configure production email delivery.
- Do not request or store an administrator password in this repository.

## Security and content decisions

- Publishable content defaults to `published = false`.
- All content defaults to `featured = false`.
- Stories use plain text with paragraph breaks, not raw HTML. A later editor
  can preserve this format without introducing unsafe HTML rendering.
- Events are stored as `timestamptz` and displayed with explicit
  `Africa/Lagos` conversion. `scheduled` and `cancelled` are lifecycle states;
  upcoming/past is derived from event time.
- Submission tables are not publicly readable or writable in this phase.
  Phase 4 must add server-side validation, spam protection, persistent rate
  limiting, duplicate handling, controlled fields, and non-revealing responses.
- Event-interest email normalization is a stored generated column derived from
  `lower(btrim(email))`; callers must provide `email`, never the generated
  value.
- Newsletter email storage retains a normalized unique value with basic
  length and format checks. Full request validation remains a Phase 4 concern.
- Storage helpers persist stable bucket/object paths, not expiring signed URLs.
- Removing a content row does not automatically remove its Storage object.
  Shared references must be checked before media deletion.
- Public media delivery is deliberately unfinished. Draft media remains in
  private buckets until Phase 4 adds publication-aware delivery.
- No invented members, events, collaborations, biographies, testimonials, or
  subscriber records are seeded.

## Retained infrastructure

The existing Express health server, OpenAPI package, and Drizzle/PostgreSQL
scaffold remain unchanged in this phase. They are not used by the new
frontend foundation, but are retained to avoid breaking the current Replit
preview/workspace build while the project transitions to the approved
Supabase architecture. They should be retired only in a separately approved
cleanup phase after all consumers and workflows are migrated.