# Abuja Elite - UI/UX Upgrade Documentation

Generated for handoff to Claude for full UI/UX upgrade. Do NOT change any code without understanding the behavioral constraints documented below.

---

## PART A: Project Structure & Tech Stack

### 1. Folder Structure (excluding node_modules, .next, dist, build, .git)

```
abujaelite2/
├── artifacts/
│   └── abuja-elite/                    # Main application
│       ├── components.json             # shadcn/ui config
│       ├── index.html                  # Entry HTML
│       ├── package.json                # Dependencies
│       ├── vite.config.ts              # Vite build config
│       ├── tsconfig.json               # TypeScript config
│       ├── public/
│       │   ├── favicon.png
│       │   ├── favicon.svg
│       │   └── robots.txt
│       └── src/
│           ├── App.tsx                 # Main app with routes
│           ├── main.tsx                # Entry point
│           ├── index.css               # Global styles + Tailwind theme
│           ├── vite-env.d.ts
│           ├── components/
│           │   ├── elite-nav.tsx       # NOT USED - legacy
│           │   ├── error-boundary.tsx  # Error boundary component
│           │   ├── section-heading.tsx  # Section heading component
│           │   └── ui/                # shadcn/ui components (55+ files)
│           │       ├── accordion.tsx
│           │       ├── alert-dialog.tsx
│           │       ├── alert.tsx
│           │       ├── aspect-ratio.tsx
│           │       ├── avatar.tsx
│           │       ├── badge.tsx
│           │       ├── breadcrumb.tsx
│           │       ├── button-group.tsx
│           │       ├── button.tsx
│           │       ├── calendar.tsx
│           │       ├── card.tsx
│           │       ├── carousel.tsx
│           │       ├── chart.tsx
│           │       ├── checkbox.tsx
│           │       ├── collapsible.tsx
│           │       ├── command.tsx
│           │       ├── context-menu.tsx
│           │       ├── dialog.tsx
│           │       ├── drawer.tsx
│           │       ├── dropdown-menu.tsx
│           │       ├── empty.tsx
│           │       ├── field.tsx
│           │       ├── form.tsx
│           │       ├── hover-card.tsx
│           │       ├── input-group.tsx
│           │       ├── input-otp.tsx
│           │       ├── input.tsx
│           │       ├── item.tsx
│           │       ├── kbd.tsx
│           │       ├── label.tsx
│           │       ├── menubar.tsx
│           │       ├── navigation-menu.tsx
│           │       ├── pagination.tsx
│           │       ├── popover.tsx
│           │       ├── progress.tsx
│           │       ├── radio-group.tsx
│           │       ├── resizable.tsx
│           │       ├── scroll-area.tsx
│           │       ├── select.tsx
│           │       ├── separator.tsx
│           │       ├── sheet.tsx
│           │       ├── sidebar.tsx
│           │       ├── skeleton.tsx
│           │       ├── slider.tsx
│           │       ├── sonner.tsx
│           │       ├── spinner.tsx
│           │       ├── switch.tsx
│           │       ├── table.tsx
│           │       ├── tabs.tsx
│           │       ├── textarea.tsx
│           │       ├── toast.tsx
│           │       ├── toaster.tsx
│           │       ├── toggle-group.tsx
│           │       ├── toggle.tsx
│           │       └── tooltip.tsx
│           ├── features/
│           │   ├── admin/
│           │   │   ├── admin-extra.css      # Admin-specific styles
│           │   │   ├── admin-workspace.tsx  # Admin dashboard wrapper
│           │   │   └── reset-password.tsx   # Password reset page
│           │   └── public/
│           │       ├── data.ts              # Public data fetching hooks
│           │       ├── public-site.tsx      # All public pages & components
│           │       ├── public.css           # Public site styles
│           │       └── submission-form.tsx  # Contact/application form
│           ├── hooks/
│           │   ├── use-admin-content.ts     # Admin content queries
│           │   ├── use-admin-inactivity.ts  # 10-min inactivity timeout
│           │   ├── use-mobile.tsx           # Mobile detection
│           │   ├── use-modal.ts             # Modal state management
│           │   ├── use-supabase-auth.ts    # Auth state management
│           │   └── use-toast.ts            # Toast notifications
│           ├── lib/
│           │   ├── admin-draft-store.ts     # In-memory draft storage
│           │   ├── content-validation.ts   # Zod schemas for content
│           │   ├── utils.ts                # Utility functions (cn)
│           │   └── supabase/
│           │       ├── auth.ts              # Auth functions
│           │       ├── client.ts            # Supabase client initialization
│           │       ├── content.ts           # Content CRUD operations
│           │       ├── database.types.ts    # TypeScript types for DB
│           │       └── storage.ts           # Media upload/delete
│           └── pages/
│               ├── admin-dashboard.css      # Admin dashboard styles
│               ├── admin-dashboard.tsx      # Admin editor components
│               └── not-found.tsx            # 404 page
├── package.json                          # Root workspace config
├── tsconfig.json                         # Root TypeScript config
└── START-HERE.md
```

### 2. Framework, Build Tool, Styling & UI Libraries

**Framework:** React 18 with TypeScript
**Build Tool:** Vite (configured in vite.config.ts)
**Routing:** Wouter (file-based routing in App.tsx)
**State Management:** React Query (@tanstack/react-query) for server state

**Styling Approach:**
- Tailwind CSS v4 (using @tailwindcss/vite plugin)
- CSS variables for theming (defined in src/index.css)
- Custom CSS classes in component-specific CSS files
- No separate tailwind.config.js - theme is inline in index.css using @theme directive

**UI Libraries:**
- shadcn/ui components (Radix UI primitives) - 55+ components in src/components/ui/
- Lucide React for icons
- Framer Motion for animations
- Sonner for toast notifications
- Recharts for charts (if needed)
- Embla Carousel for carousels
- next-themes for theme switching (though currently dark-only)

### 3. Pages/Routes and Rendering Files

**Public Routes:**
- `/` → Home page (rendered by `Home()` component in App.tsx, lines 27-73)
- `/about` → About page (`AboutPage` in public-site.tsx)
- `/connect` → Connect/contact page (`ConnectPage` in public-site.tsx)
- `/privacy` → Privacy information (`InformationPage` in public-site.tsx)
- `/terms` → Terms of service (`InformationPage` with terms=true in public-site.tsx)
- `/members` → Members collection (`CollectionPage` with resource='members' in public-site.tsx)
- `/members/:slug` → Member detail (`DetailPage` with resource='members' in public-site.tsx)
- `/community` → Alias for /members
- `/collaborations` → Collaborations collection (`CollectionPage` with resource='collaborations')
- `/collaborations/:slug` → Collaboration detail
- `/experiences` → Events collection (`CollectionPage` with resource='events')
- `/experiences/:slug` → Event detail
- `/stories` → Stories collection (`CollectionPage` with resource='stories')
- `/stories/:slug` → Story detail
- `/journey` → Alias for /stories
- `/gallery` → Gallery collection (`CollectionPage` with resource='gallery_items')

**Admin Routes:**
- `/admin/login` → Admin login page (`AdminWorkspace` with loginOnly=true in App.tsx)
- `/admin` → Admin dashboard (`AdminWorkspace` in admin-workspace.tsx)
- `/admin/reset-password` → Password reset (`ResetPassword` in reset-password.tsx)

**404:** Handled by default route in App.tsx using `PublicShell` with not-found content

### 4. Shared Components

**Navigation:**
- `PublicNav` (public-site.tsx) - Main public site navbar with mobile drawer
- `PublicFooter` (public-site.tsx) - Footer with links

**Content Display:**
- `PublicImage` (public-site.tsx) - Image component with fallback to initials
- `ContentCard` (public-site.tsx) - Card for members, events, stories, collaborations
- `FeaturedCollection` (public-site.tsx) - Featured items grid on homepage
- `CollectionPage` (public-site.tsx) - Paginated collection view with filters
- `DetailPage` (public-site.tsx) - Single item detail view
- `Lightbox` (public-site.tsx) - Gallery lightbox modal

**Forms:**
- `ConnectForm` (submission-form.tsx) - Contact/application form with Cloudflare Turnstile

**Layout:**
- `PublicShell` (public-site.tsx) - Layout wrapper for public pages (nav + main + footer)
- `Metadata` (public-site.tsx) - SEO meta tags management

**Admin Components (in admin-dashboard.tsx):**
- `Editor` - Form editor for creating/editing content
- `RecordList` - Table/list view of records
- `InboxDetail` - Drawer for viewing inbox submissions
- `Settings` - Site settings form

**Utility Components:**
- `ErrorBoundary` (error-boundary.tsx) - Error boundary wrapper
- `SectionHeading` (section-heading.tsx) - Section header with kicker

**shadcn/ui Components (55+):**
- Button, Input, Textarea, Select, Checkbox, Switch
- Dialog, Drawer, Alert, AlertDialog
- Card, Badge, Avatar
- Form, Field, Label
- Toast, Toaster, Sonner
- And many more Radix-based primitives

### 5. Global Styles, Theme & Config Files

**Global Styles:**
- `src/index.css` - Main stylesheet with:
  - Tailwind imports (@import 'tailwindcss')
  - CSS custom properties for colors, fonts, spacing
  - Base styles (html, body, buttons, inputs)
  - Utility classes (.eyebrow, .display-font, .noise, .focus-ring)
  - Component-specific styles (.elite-page, .elite-shell, .hero, .marquee, .section, etc.)
  - Responsive breakpoints
  - Reduced motion support

**Theme Configuration:**
- Theme is defined inline in index.css using @theme directive
- CSS variables for colors (HSL format):
  - --background, --foreground, --border, --input, --ring
  - --card, --card-foreground, --card-border
  - --primary, --primary-foreground
  - --secondary, --secondary-foreground
  - --muted, --muted-foreground
  - --accent, --accent-foreground
  - --destructive, --destructive-foreground
  - --chart-1 through --chart-5
- Font variables:
  - --app-font-sans: 'Manrope', sans-serif
  - --app-font-serif: 'Playfair Display', serif
  - --app-font-mono: 'DM Mono', monospace
- Custom variables:
  - --public-canvas, --public-surface, --public-hover-surface
  - --public-body-text, --public-gold-label
  - --radius, --shadow-sm, --shadow-md
  - --tracking-normal, --spacing, --elevate-1, --elevate-2

**Component-Specific CSS:**
- `src/features/public/public.css` - Public site styles (minified, 24KB)
- `src/features/admin/admin-extra.css` - Admin-specific overrides
- `src/pages/admin-dashboard.css` - Admin dashboard styles (13KB)

**Config Files:**
- `components.json` - shadcn/ui configuration (style: new-york, cssVariables: true)
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration

**Fonts:**
- Google Fonts imported in index.css:
  - DM Mono (400, 500)
  - Manrope (400, 500, 600, 700, 800)
  - Playfair Display (600, 700, italic 600)
- Inter (400, 500, 600, 700) imported in index.html (may not be used)

---

## PART B: Application Behavior

### 6. Supabase Usage

**Tables:**
1. `members` - Community member profiles
2. `collaborations` - Business/brand collaborations
3. `events` - Events and experiences
4. `stories` - Editorial stories/articles
5. `gallery_items` - Gallery photographs
6. `applications` - Membership applications
7. `contact_messages` - Contact form submissions
8. `event_interests` - Event registration interest
9. `newsletter_subscribers` - Newsletter subscriptions
10. `site_settings` - Public site configuration

**Storage Buckets:**
- `member-images` - Member profile photos
- `collaboration-images` - Collaboration logos/cover images
- `event-images` - Event cover images
- `story-images` - Story cover images
- `gallery-images` - Gallery photographs
- `site-assets` - Site-wide assets (logos, etc.)

**Auth Methods:**
- Email/password authentication via Supabase Auth
- Admin check via Supabase RPC function `is_current_user_admin`
- Session persistence in browser storage
- Password reset via email (Supabase built-in)

**Files That Talk to Supabase:**
- `src/lib/supabase/client.ts` - Client initialization
- `src/lib/supabase/auth.ts` - Auth functions (signIn, signOut, getCurrentSession, isCurrentUserAdmin)
- `src/lib/supabase/content.ts` - CRUD operations for all content tables
- `src/lib/supabase/storage.ts` - Media upload/delete/signed URLs
- `src/lib/supabase/database.types.ts` - TypeScript type definitions
- `src/features/public/data.ts` - Public data fetching hooks (usePublicList, usePublicRecord, useSettings)
- `src/hooks/use-supabase-auth.ts` - React hook for auth state
- `src/features/admin/admin-workspace.tsx` - Admin dashboard (uses client directly)
- `src/features/public/submission-form.tsx` - Public form submission (calls Supabase Edge Function)

**Environment Variables Required (names only, no values):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY` (for Cloudflare Turnstile on forms)
- `VITE_SITE_URL` (for canonical URLs)
- `BASE_PATH` (optional, for deployment subpath)

### 7. Admin Flow (Step by Step)

**Login:**
1. Navigate to `/admin/login`
2. Enter email and password
3. Form submits to `getSupabaseClient().auth.signInWithPassword()`
4. On success, `useSupabaseAuth` hook checks `is_current_user_admin` RPC
5. If admin, redirect to `/admin`; if not, show "Access restricted" error
6. Session persists in browser storage via Supabase auth

**Protected Routes:**
- All `/admin/*` routes are protected by `useSupabaseAuth` hook
- Hook checks: authenticated status + admin role via RPC
- If not authenticated, redirect to `/admin/login`
- If authenticated but not admin, show "Access restricted" message
- Inactivity timeout: 10 minutes of no activity triggers auto-logout (useAdminInactivity hook)
- Warning shown at 9 minutes with option to stay signed in

**Create New Post:**
1. Click "Add record" button in any content section
2. Opens `Editor` modal (from admin-dashboard.tsx)
3. Form fields vary by resource type (defined in `resourceFields` constant)
4. Image uploads use `uploadAdminMedia()` function:
   - Validates file type (JPEG, PNG, WebP only)
   - Validates file size (max 5 MiB)
   - Uploads to appropriate bucket based on resource
   - Returns path and signed preview URL
5. Drafts stored in-memory via `admin-draft-store.ts` (cleared on page refresh)
6. On save, validates with Zod schemas in `content-validation.ts`
7. Calls `save()` function which:
   - For new records: inserts into table
   - For existing: updates by ID
   - Invalidates React Query caches for admin and public queries
8. Published status controlled by checkbox; only published records appear on public site

**Image Upload & Display:**
- Upload via file input in Editor form
- Calls `uploadAdminMedia(bucket, file, folder)`
- Path format: `{resource}/{recordId or 'drafts'}/{field}/{uuid}-{filename}`
- Preview uses signed URL via `createAdminMediaPreview(bucket, path)` (5 min expiry)
- On public site, images served via Supabase Edge Function `public-media`:
  - URL format: `{VITE_SUPABASE_URL}/functions/v1/public-media?resource={resource}&id={recordId}&v={path}`
  - This function handles public access without exposing storage directly

**Edit Post:**
1. Click record in list view
2. Opens `Editor` modal pre-populated with existing data
3. Changes update in-memory draft
4. Save calls `save()` with ID parameter (update instead of insert)
5. Image uploads work same as create

**Delete Post:**
1. Click delete button in list view
2. Confirmation dialog: "Delete this record? Its uploaded images will be kept so shared images remain available."
3. If confirmed, calls `remove()` which:
   - Deletes record from table
   - Does NOT delete images (to preserve shared images)
   - Invalidates React Query caches
4. To delete images manually, would need separate admin action

### 8. Public Flow (Data Fetching & Rendering)

**Posts/Members Fetching:**
- Uses `usePublicList(resource, page, search, category, featured, limit, eventFilter)` hook
- Creates separate Supabase client with publishable key only (no auth)
- Filters: `published=true` always
- For stories: also filters `published_at not null and <= now`
- For events: can filter by status (scheduled) or date (upcoming/past)
- Ordering: featured first, then sort_order (for members/collaborations/gallery) or date (events/stories)
- Pagination: 12 items per page (configurable)
- Search: ILIKE search on specific field (name for members, title for events/stories, caption for gallery)
- Stale time: 30 seconds (refetches after 30s)
- Retry: 1 attempt on failure

**Images Fetching:**
- Images NOT fetched directly from Supabase Storage
- Instead, use Edge Function `public-media` with signed URLs
- `PublicImage` component constructs URL:
  - `{VITE_SUPABASE_URL}/functions/v1/public-media?resource={resource}&id={recordId}&v={path}`
- Fallback: if image fails to load, show initials (for members) or icon
- Lazy loading: `loading="lazy"` for non-large images
- Large images (detail view): `loading="eager"`

**Rendering on Each Page:**

**Home (/):**
- Hero section with settings from `useSettings()` hook
- Featured collections (3 items each): members, events, collaborations, stories, gallery
- Marquee with brand messaging
- Connect form inline

**Collection Pages (/members, /events, etc.):**
- CollectionPage component
- Filters: search input, category dropdown (if applicable), event filter (for events)
- Grid of results using ContentCard component
- Pagination controls
- Empty state when no results

**Detail Pages (/members/:slug, etc.):**
- DetailPage component
- Fetches single record by slug via `usePublicRecord()`
- Large image, title, metadata (dates, location, author)
- Body content split by paragraphs
- Social links (website, Instagram) if present
- For events: registration button if upcoming and not cancelled

**Gallery (/gallery):**
- CollectionPage with gallery-specific grid layout
- Clicking image opens Lightbox modal
- Lightbox: keyboard navigation (arrows), close button, counter

**About/Connect/Privacy/Terms:**
- Static content rendered in respective components
- Connect page includes ConnectForm

### 9. Every User Action and What It Triggers

**Public Site Actions:**

**Navigation:**
- Click nav links → Wouter route change, scroll to top, close mobile drawer
- Click card → Navigate to detail page
- Click "Explore collection" → Navigate to collection page
- Click "Back to X" → Navigate back to collection

**Mobile Menu:**
- Click hamburger → Open drawer, set body overflow hidden
- Click drawer link → Navigate, close drawer
- Click backdrop → Close drawer
- Press Escape → Close drawer, focus hamburger button

**Search/Filter:**
- Type in search input → Updates local state, does not fetch
- Click "Search" button → Submits form, resets page to 0, triggers usePublicList refetch
- Click "Clear" button → Clears search, resets page, refetches
- Change category dropdown → Resets page, refetches
- Change event filter (upcoming/past/all) → Resets page, refetches

**Pagination:**
- Click "Previous" → Decrement page, refetches
- Click "Next" → Increment page, refetches

**Gallery Lightbox:**
- Click gallery image → Opens lightbox with that image
- Click close button → Closes lightbox
- Press Escape → Closes lightbox
- Click previous/next arrows → Navigate images
- Press left/right arrow keys → Navigate images

**Form Submission (ConnectForm):**
- Select kind (contact/application/newsletter) → Updates form fields shown
- Type in fields → Updates form state
- Click "Send enquiry" → 
  - Validates required fields
  - Gets Cloudflare Turnstile token
  - Calls Supabase Edge Function `submit-interest`
  - On success: shows success message, resets form
  - On error: shows error message, resets Turnstile
- Click "Send another enquiry" (after success) → Resets to form view

**Admin Dashboard Actions:**

**Login:**
- Type email/password → Updates form state
- Click "Sign in" → 
  - Calls Supabase auth.signInWithPassword()
  - On success: auth state updates, redirects to /admin
  - On error: shows error message
- Click "Forgot password?" → 
  - Validates email entered
  - Calls Supabase auth.resetPasswordForEmail()
  - Shows success/error message

**Navigation:**
- Click sidebar item → Changes section, resets page/search, closes mobile sidebar
- Click "Sign out" → 
  - Calls Supabase auth.signOut()
  - Clears admin queries cache
  - Clears user drafts
  - Redirects to /admin/login

**Content Management:**
- Click "Add record" → Opens Editor modal with empty form
- Click record in list → Opens Editor modal pre-populated
- Click "Delete" → 
  - Shows confirmation dialog
  - If confirmed: deletes record, invalidates cache
- Type in search box → Filters list (client-side for inboxes)
- Click pagination → Changes page, refetches

**Editor Form:**
- Type in fields → Updates in-memory draft
- Click file input → Triggers file picker, uploads image on selection
- Click "Save" → 
  - Validates with Zod
  - Inserts or updates record
  - Invalidates caches
  - Closes modal
- Click "Cancel" → Closes modal, clears draft
- Click "Delete" (in edit mode) → Same as list delete

**Settings Form:**
- Type in fields → Updates in-memory draft
- Click "Save website settings" → 
  - Validates email/URL formats
  - Updates each setting record
  - Invalidates cache
  - Shows success message

**Inbox Management:**
- Click inbox row → Opens drawer with details
- Change status dropdown → Updates selection
- Click "Save status" → 
  - Validates consent for newsletter
  - Updates record
  - Refreshes list
- Click "Delete record" → 
  - Confirms deletion
  - Deletes record
  - Refreshes list

**Inactivity Warning:**
- Click "Stay signed in" → Resets inactivity timers
- Click "Sign out now" → Triggers logout

### 10. Fragile Logic (Must Not Break)

**Tightly Coupled to Markup/Classes:**

**CSS Classes (DO NOT RENAME):**
- `.elite-page` - Main page wrapper
- `.elite-shell` - Content container with max-width
- `.elite-nav` - Navbar (uses `.scrolled` class for sticky state)
- `.hero` - Hero section
- `.marquee` - Scrolling marquee
- `.section` - Section wrapper
- `.public-card` - Card component
- `.member-card` - Member-specific card variant
- `.gallery-card` - Gallery-specific card variant
- `.public-grid` - Grid layout
- `.gallery-grid` - Gallery-specific grid
- `.public-image` - Image wrapper
- `.member-initials` - Fallback initials for members
- `.image-empty` - Fallback icon for missing images
- `.public-form` - Form wrapper
- `.public-drawer` - Mobile navigation drawer
- `.public-lightbox` - Gallery lightbox
- `.ae-admin` - Admin dashboard wrapper
- `.ae-sidebar` - Admin sidebar
- `.ae-nav-item` - Admin nav item (uses `.ae-nav-item-active` for active state)
- `.ae-input` - Admin form inputs
- `.ae-field` - Admin form field wrapper
- `.ae-gate` - Admin login wrapper
- `.gold-button` - Primary button style
- `.outline-button` - Secondary button style

**Data Attributes (DO NOT REMOVE):**
- `data-testid="button-hero-discover"` - Hero discover button
- `data-testid="button-hero-connect"` - Hero connect button
- `data-testid="link-about-community"` - About community link

**ARIA Attributes (DO NOT REMOVE):**
- `aria-label`, `aria-current`, `aria-expanded`, `aria-controls`, `aria-modal`, `aria-hidden` - Critical for accessibility
- `role="dialog"`, `role="status"`, `role="alert"` - Screen reader announcements

**Props/Function Names (DO NOT CHANGE):**

**PublicSite Components:**
- `PublicNav` - Must export as named export
- `PublicFooter` - Must export as named export
- `PublicShell` - Must accept `children`, `title`, `description` props
- `Metadata` - Must accept `title`, `description`, `noindex` props
- `PublicImage` - Must accept `resource`, `record`, `large` props
- `ContentCard` - Must accept `resource`, `record`, `onImage` props
- `FeaturedCollection` - Must accept `resource` prop
- `CollectionPage` - Must accept `resource` prop
- `DetailPage` - Must accept `resource`, `slug` props
- `ConnectForm` - Must accept `initialKind`, `eventId` props

**Admin Components:**
- `Editor` - Must accept `resource`, `record`, `onClose`, `onCreate`, `onUpdate`, `onUploadMedia`, `createMediaPreview`, `userId` props
- `RecordList` - Must accept `resource`, `records`, `isLoading`, `error`, `query`, `onQueryChange`, `onEdit`, `onDelete`, `onRetry` props

**Hooks (DO NOT CHANGE SIGNATURES):**
- `usePublicList(resource, page, search, category, featured, limit, eventFilter)` - Return type must have `rows`, `total`, `isPending`, `isError`
- `usePublicRecord(resource, slug)` - Return type must have data as PublicRecord or null
- `useSettings()` - Return type must be object with setting keys as properties
- `useSupabaseAuth()` - Return type must have `status`, `session`, `user`, `isAdmin`, `error`, `retry`, `userId`
- `useAdminInactivity(userId, sessionToken, onLogout)` - Return type must have `state`, `staySignedIn`, `manualLogout`

**Resource Names (DO NOT CHANGE):**
- `'members'`, `'collaborations'`, `'events'`, `'stories'`, `'gallery_items'`, `'site_settings'`
- These are used as table names, bucket names, and route segments

**Slug Format (DO NOT CHANGE VALIDATION):**
- Slugs must match regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`
- Lowercase, alphanumeric, hyphens only
- Max 180 characters

**Image Path Format (DO NOT CHANGE):**
- Paths stored in DB are relative to bucket (no leading slash)
- Public URLs constructed via Edge Function, not direct storage access
- Format: `{resource}/{recordId or 'drafts'}/{field}/{uuid}-{filename}`

**Date Handling (DO NOT CHANGE):**
- All dates stored as ISO 8601 strings in database
- Display uses `dateLabel()` function with Africa/Lagos timezone
- Form inputs use `datetime-local` format
- Conversion functions: `toLagosInput()`, `fromLagosInput()` handle +1 hour offset

**Zod Validation Schemas (DO NOT CHANGE STRUCTURE):**
- Schemas in `content-validation.ts` enforce data integrity
- Field names, types, and constraints must match
- Custom refinements (e.g., end time after start time) must be preserved

**Supabase RPC Functions (DO NOT CHANGE):**
- `is_current_user_admin` - Must return boolean
- `submit_public_enquiry` - Must accept `{p_kind, p_payload, p_rate_key}` and return `{received: boolean}`

**Environment Variable Names (DO NOT CHANGE):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_SITE_URL`, `BASE_PATH`

**Wouter Route Structure (DO NOT CHANGE):**
- Routes defined in App.tsx using `<Route path="..." component={...} />`
- Dynamic routes use `:slug` parameter
- Default route is 404 handler

**React Query Keys (DO NOT CHANGE):**
- `['public', resource, page, search, category, featured, limit, eventFilter]` - Public list queries
- `['public', 'detail', resource, slug]` - Public detail queries
- `['public', 'settings']` - Settings query
- `['admin', userId, 'counts']` - Admin dashboard counts
- `['admin', userId, section, page]` - Admin list queries
- Changing keys will break cache invalidation

**Inactivity Storage Keys (DO NOT CHANGE):**
- `admin-inactivity` - localStorage key for activity tracking
- `admin-session-expired` - localStorage key for expiry marker

**Draft Store Keys (DO NOT CHANGE FORMAT):**
- Format: `{userId}|{resource}|{recordId or 'new'}`
- Used by `admin-draft-store.ts`

**Cloudflare Turnstile (DO NOT CHANGE):**
- Widget container ref must be passed to `turnstile.render()`
- Callback must set token state
- Error/expired callbacks must handle appropriately
- Site key from `VITE_TURNSTILE_SITE_KEY`

**Critical:**
- DO NOT change the relationship between resource names and bucket names
- DO NOT change the published flag logic (published=true required for public visibility)
- DO NOT remove the `featured` flag or `sort_order` fields
- DO NOT change the inactivity timeout (10 minutes) or warning (9 minutes)
- DO NOT remove the Cross-Origin checks in inactivity hook
- DO NOT change the draft persistence behavior (in-memory only, cleared on refresh)
- DO NOT remove error boundaries or error handling
- DO NOT change the accessibility attributes or roles
