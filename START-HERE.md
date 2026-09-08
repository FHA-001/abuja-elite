# Abuja Elite — development checkpoint

This is the updated working project, packaged at your request before completing the full implementation and live verification. It is NOT a declaration of production readiness.

## Run on Windows

Use Node.js 24. In PowerShell, inside this folder:

```powershell
npm.cmd install --global pnpm@10.28.2
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example artifacts/abuja-elite/.env.local
notepad artifacts/abuja-elite/.env.local
pnpm.cmd dev
```

Add your existing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in that file. Never add server secrets to VITE_ variables. Open http://localhost:3006 and /admin/login. Alternatively use start-windows.cmd after installing Node and pnpm.

## Implemented in this checkpoint

- Portable Vite configuration and pnpm setup; original workspace retained.
- Protected admin login, visibility toggle, retry, sign-out and account cache clearing.
- Supabase overview counts, paginated content CRUD, publication/feature controls and private image uploads/previews.
- Submission inboxes and review statuses; homepage settings editor.
- Public collections and detail pages, gallery lightbox, honest empty/error states, retained homepage hero and brand styling.
- Contact, application, newsletter and event-interest forms with Turnstile integration. Forms show Instagram contact until configured.
- New server handlers for submission validation and publication-aware private media delivery.
- Incremental SQL migration for persistent submission rate limits, service-only write RPC and linked-gallery visibility. The applied Phase 2 migration is unchanged.
- Password recovery screen, Vercel configuration, SEO metadata/sitemap script and focused automated tests.

## Verification at checkpoint

Nine focused tests passed for validation, time conversion, challenge handling, privileged-field stripping, rate identifiers, submission responses and private media checks. Frontend and Edge Function TypeScript checks passed before the final packaging edits. A production build produced dist/public output; the final SEO/deployment additions still require a complete fresh verification run. No real administrator browser login, live Storage API test, remote migration or Edge Function deployment was performed. Database types remain manually maintained.

## Remaining phases — continue in this order

1. Finish local review and verification: run pnpm.cmd verify; resolve any errors; inspect desktop/mobile pages, keyboard navigation, auth/session transitions, CRUD saves and image uploads. The related-content selector and final deployment/SEO changes need review. Check installation on Windows.
2. Apply and verify the new remote backend: review then run supabase/migrations/202609070002_public_workflows.sql in the existing project's SQL editor. Add rollback-isolated behavioral tests for new submission RPC/rate limits/duplicates/gallery visibility; regenerate database.types.ts from the real schema. Do not rerun the original migration as an upgrade.
3. Deploy public-media and submit-interest Edge Functions: use the Supabase CLI or dashboard. Both require verify_jwt=false, as recorded in supabase/config.toml. public-media uses the runtime SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. submit-interest additionally requires PUBLIC_SITE_ORIGINS (comma-separated exact origins), TURNSTILE_SECRET_KEY, TURNSTILE_HOSTNAMES (comma-separated hostnames) and FORM_RATE_SECRET (random secret at least 32 characters). Configure these in Supabase secrets, never the browser or chat. Set VITE_TURNSTILE_SITE_KEY in the frontend only when ready. Confirm challenge hostname/action, CORS, persistence, rate limits and duplicate responses on the deployed functions.
4. Complete launch account/content configuration: disable public admin signup, configure Auth Site URL and /admin/reset-password redirects, production email delivery, test the actual administrator login/recovery/sign-out, then enter approved content/images and contact details. Review privacy/terms copy and your retention process before enabling forms. Newsletter handling records consent/review status; it does not send campaigns or double-opt-in email.
5. Deploy through GitHub/Vercel: root project settings are in vercel.json; use Node24 and the frontend environment variables. Set VITE_SITE_URL to the real HTTPS origin. Test direct routes, media, forms, CSP and mobile layout in preview before production. SEO is currently client-rendered; per-detail social previews/server-rendered SEO remain an enhancement. Rebuild the sitemap after content changes.

## Known boundaries

Deleting content or removing an image selection retains the storage object to avoid breaking shared references. A safe unused-media cleanup interface remains to be built if needed; do not bulk-delete shared objects. Public-media rechecks publication and allows up to 30 seconds of caching. Previously downloaded images cannot be recalled. Admin media previews remain time-limited signed URLs. No fictional records are seeded. Legacy Express/OpenAPI/Drizzle scaffolds are retained but are not the new website backend. Older documents describe historical phases; this checkpoint document is the current continuation guide.
