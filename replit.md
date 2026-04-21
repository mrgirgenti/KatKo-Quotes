# Katalyst Ko Quote Tracker 5000

A React Native / Expo app for tracking sales quotes, built for Katalyst Ko custom apparel print shop.

## Features
- Create and manage sales quotes with line items
- Unified Projects tab (replaces separate Quote History + Sales tabs)
- Project lifecycle: Draft → Quoted → Active → Completed (auto-Expired after 30 days)
- Per-line-item completion tracking in Production View
- Rich filter bar: status pills, search, total range, sort
- Reports generation (PDF, CSV, Google Sheets export)
- User profiles with avatar support and role-based access control

## Role Hierarchy & Profile System
- **Two roles**: `org_admin` and `user` (stored in `UserProfile.role`)
- First/default user is always `org_admin`; newly created users default to `user`
- Backward migration: if stored users lack a role, first user becomes `org_admin`, rest become `user`
- **Org Admin Profile extras**: Company logo upload (replaces static sidebar logo), API Integrations (Wave Accounting URL/key, vendor catalog URLs, Google Sheets export URL, admin password), and User Management (add/delete users with role picker, view all users with role badges)
- **Standard User Profile**: Photo, avatar color, name, contact info only — no Organization Settings
- Sidebar reads dynamic company logo from `orgAdmin.companyLogo` (falls back to hardcoded CDN URI)
- `UserContext` exposes: `isOrgAdmin()`, `orgAdmin` (first user with role=org_admin), `createUser(name, email?, role?)`

## Client-Facing Catalogs — 2026-04-21
- **`ClientCatalog` database table** added via Prisma schema (id, name, description, vendorName, category, catalogUrl, websiteUrl, coverImageUrl, isActive, sortOrder, timestamps)
- **API routes**: `GET/POST /api/client-catalogs` and `PATCH/DELETE /api/client-catalogs/[id]`
- **Admin Catalogs page** (`app/(tabs)/catalogs.tsx`) refactored with two tabs:
  - "Wholesale Vendors" — existing internal vendor references (SanMar, S&S, etc.)
  - "Client-Facing Catalogs" — DB-driven retail catalogs with full add/edit/delete management UI
- **Portal CatalogsView** now fetches `/api/client-catalogs` and renders catalog cards (name, vendor, category badge, description, Open Catalog + Website buttons) when catalogs exist; falls back to empty state message when none are added yet
- **Portal branding**: "Client Portal" text changed to "Client Portals by Katalyst Ko Printshop" in all three top bar / sidebar locations (email step with logo, email step without logo, dashboard sidebar without logo)

## Known Bug Fixes (Phase 13) — 2026-04-21
- **Client Portal design unification**:
  - Changed `SIDEBAR_BG` from `#111827` (dark navy) to `#000000` (pure black) to match Ko OS header/sidebar.
  - All brand accent colors already matched (`#FF5A00`).
- **Client Portal form re-render bug**:
  - *Root cause*: `HomeView`, `ProjectsView`, `QuotesView`, `ArtworkView`, `CatalogsView`, `SubmitView` were defined as inner arrow functions inside the main component and rendered as `<SubmitView />`. On every parent re-render (every keystroke), React created new function references, unmounted and remounted the components, causing inputs to lose focus.
  - *Fix*: Changed all view renders from JSX component syntax (`<SubmitView />`) to function-call syntax (`SubmitView()`). This inlines the JSX in the parent's render tree and React reconciles it normally without unmount/remount.
- **Blank/placeholder "User" entries in Client Hub**:
  - *Root cause*: Internal users with default `firstName='User'` and `@noemail.internal` email were appearing in membership lists, and client users invited without a name got the 'User' default.
  - *Fix 1*: Added `isRealClientUser` filter in `hub/[id].tsx` that excludes memberships with no real email AND no real/non-default name.
  - *Fix 2*: Added DB-level filter in `app/api/memberships+api.ts` to exclude internal placeholder users (INTERNAL type with noemail.internal email and default 'User' name).

## Known Bug Fixes (Phase 12)
- **Org profile "Loading..." stuck bug (2026-04-21)**:
  - *Root cause*: React Query v5 defaulted `networkMode: 'online'`, which pauses query fetches when the browser detects the network as offline. In Replit's proxied environment, `navigator.onLine` can falsely report offline, causing `orgsQuery.isLoading` to remain `true` indefinitely.
  - *Fix 1*: Added `networkMode: 'always'` to the global `QueryClient` in `app/_layout.tsx` so all queries bypass online/offline detection.
  - *Fix 2*: Added a direct per-org `useQuery(['org_detail', id])` in `app/crm/[id].tsx` that fetches from `/api/orgs/{id}` directly, as a belt-and-suspenders fallback. The page uses whichever data source resolves first (CrmContext orgs list OR direct org fetch).

## Known Bug Fixes (Phase 3)
- **Quote submit persistence fix (2026-04-19)**:
  - *Bug 1*: `isAdmin` in QuotesContext evaluated `false` during async `UserContext` init (`currentUser=null`), causing the per-user filter `q.userId === null` to drop all DB quotes. Fix: `const isAdmin = !currentUser || currentUser.role === 'org_admin'` — treat no-user state as admin view so quotes are visible during initialization.
  - *Bug 2*: POST `/api/projects` INSERT always uses `gen_random_uuid()` (server-generated UUID), ignoring the client's `generateId()` timestamp string. After submit, `router.push(/quote/${clientId})` navigated to a non-existent route. Fix: Use `onSuccess: (saved) => router.push(/quote/${saved.id})` to navigate with the server-returned UUID instead of a blind `setTimeout`.

## Context Layer
- **QuotesContext**: All quote/project CRUD via `/api/projects` — fully migrated from AsyncStorage
- **CrmContext**: All org/contact/activity CRUD via `/api/orgs` — fully migrated from AsyncStorage. Phase 3 additions: `updateOrgHubEnabled`, `createMembership`, `createMembershipAsync`, `deleteMembership`
- **UserContext**: Primary store is AsyncStorage; DB sync added in Phase 3 (fire-and-forget upsert on init and on create/update). AsyncStorage IDs used directly as PostgreSQL `User.id` (string PK). `syncUserToDB()` called on boot and on every mutation.
- **ClientsContext**: DELETED. The legacy `Client` type is fully replaced by `Organization` + `Contact`. Dashboard client counts now derive from `useCrm().orgs`. `autoAddClientIfNew` in sales-tracking now calls `addOrg` via `useCrm`. `contexts/ClientsContext.tsx` and `types/client.ts` deleted.

## Phase 15 — Unified Organization Logo System (2026-04-21)

### Single Source of Truth: `Organization.logoUrl`
The entire app now uses one field — `Organization.logoUrl` — as the single authoritative org logo. `internalLogoUrl` remains in the DB schema for backward compatibility but is no longer managed or displayed anywhere in the UI.

### New Shared Components
- **`components/OrgAvatar.tsx`**: Logo-aware avatar used everywhere. Props: `name`, `logoUrl?`, `size`, `shape` (`square`|`circle`). Shows real logo if `logoUrl` is set and loads successfully; falls back to colored initial circle/square.
- **`components/OrgLogoUploader.tsx`**: Compact profile-style logo uploader for the Org Profile. Shows current logo (or initials) as an 88px avatar with a camera badge overlay. Actions: "Change" link + "Remove" link (only shown when logo exists). No permanent dashed upload box.

### Changes by File
- **`app/(tabs)/clients.tsx`**: Replaced local initials-only `OrgAvatar` with shared `OrgAvatar` that shows the real org logo (`logoUrl`) in list and card rows.
- **`app/(tabs)/client-hubs.tsx`**: Replaced local `OrgAvatar` with shared component; `hasLogo` now checks `org.logoUrl` only (not `internalLogoUrl`).
- **`app/crm/[id].tsx`**: Replaced the wide dashed `MediaUploader` with compact `OrgLogoUploader`. Upload/change/remove managed here; writes to `logoUrl` only.
- **`app/hub/[id].tsx`**: Removed dual-logo Portal Branding section. Replaced with a read-only display showing the current org logo (`OrgAvatar`) + "Manage this logo from the Organization Profile." message. Removed `logoUrlDraft`, `internalLogoUrlDraft`, `savingLogos`, `logoSaved` state and `handleSaveLogos` handler.
- **`app/portal/[orgId].tsx`**: Removed `orgInternalLogoUrl` state. Portal uses `orgLogoUrl` (= `org.logoUrl`) exclusively.

### Logo Display Coverage
| Surface | Field Used | Fallback |
|---|---|---|
| Contacts list (table + cards) | `org.logoUrl` | Colored initial circle |
| Organization profile header | `org.logoUrl` | Colored initial square |
| Client Hubs index cards | `org.logoUrl` | Colored initial square |
| Hub Management branding panel | `org.logoUrl` (read-only) | Colored initial square |
| Client Portal header/sidebar | `org.logoUrl` | No logo shown |

## Phase 14 — MediaUploader, Client Hubs Cards & Logo Bug Fixes (2026-04-21)

### Shared MediaUploader Component
- **`components/MediaUploader.tsx`**: Reusable file uploader with click + drag-drop, live preview, replace/remove actions, upload state machine (idle/uploading/success/error), shape variants (wide/square/circle). Replaces ad-hoc logo input UI in hub and CRM pages.

### Client Hubs Index — Full Card Redesign
- **`app/(tabs)/client-hubs.tsx`**: Replaced thin search-result rows with proper 2-column responsive management cards.
  - **Top section**: OrgAvatar (logo image → initial-letter fallback) + org name + `Active Client` status badge + `Portal Live` badge.
  - **Middle section**: Primary contact name, email, org type, "Logo configured" / "No logo set" readiness indicator (green/gray).
  - **Bottom section**: Orange `Open Hub` + outline `Copy Link` + gear `Settings` buttons on a gray-tinted footer.
- `OrgAvatar` component added inside the file: loads `org.logoUrl` then `org.internalLogoUrl` with `onError` fallback to initial-letter avatar.

### Critical Logo Bug Fixes
1. **Wrong query key in hub/[id].tsx**: Was invalidating `['orgs']` after branding save — changed to `['crm_orgs']` so CrmContext actually refreshes. Cards now show "Logo configured" correctly.
2. **Wrong FormData field in crm/[id].tsx**: Was sending `organizationId` but files API expects `orgId` — logo uploads were silently failing without this fix.
3. **Wrong response field in crm/[id].tsx**: Was reading `data.id` but API returns `{ file: { id } }` — URL construction was broken.

### Files API Null-Params Defense
- **`app/api/files/[id]+api.ts`**: Added `params ?? {}` guard and early 404 return in both GET and DELETE handlers. Expo Router SSR sometimes calls dynamic API routes with `null` params during static rendering; this was causing 500 errors.

### Sidebar Logo Size
- Katalyst Ko logo in `components/Sidebar.tsx` enlarged from 160×58 → 200×80 with increased vertical padding.

## Phase 11 — Org Profile Redesign (2026-04-21)

### Layout
- **Left panel**: Identity card (88×88 logo + Upload Logo button, org name, type, status badges, address block), Lead Tracking section (if Cold/Working), Primary Contact card, Account Rep card (from ORG_ADMIN Hub membership), Stats row (quotes count + total revenue), action buttons.
- **Right panel**: Replaced tab system with always-visible scrollable cards: Active Projects, Activity, Contacts, Quotes & Revenue, Client Hub, Campaigns.

### Logo Upload
- "Upload Logo" / "Change Logo" button triggers hidden `<input type="file">` (web only) → POSTs to `/api/files` → updates `org.logoUrl` via `updateOrg`.
- Displays `org.logoUrl` → `org.internalLogoUrl` → initial-letter fallback (consistent with portal logo priority system).

### Account Rep
- Derived from the ORG_ADMIN Hub membership for the org (no new DB column required).
- "Assign account rep" link opens the Add Member modal with ORG_ADMIN pre-selected.

### Card-based Right Panel
- Removes tab bar; all sections always visible and scrollable.
- Contacts card includes full department-grouped management (add/edit/delete contacts & departments inline).
- Client Hub card includes toggle, "Open Client Portal" external link, Internal Team section, Client Users section.
- Campaigns card only renders if org is a lead (Cold/Working) or has existing campaigns.

## Phase 10 — Artwork Upload & Media Bin (2026-04-21)

### File Storage Architecture
- **Storage backend**: Filesystem at `/home/runner/workspace/uploads/{orgId}/{uuid}-{filename}`. The `File.storageKey` field stores the relative path.
- **Supported types**: AI, SVG, PNG, JPG/JPEG, PDF
- **Two scopes**: Project-specific files (`projectId` + `organizationId` both set) and org-level Media Bin files (`projectId = null`, `organizationId` only).
- **Visibility**: All client-uploaded files use `visibility = CLIENT_VISIBLE`.

### New API Endpoints
- `POST /api/files` — Multipart file upload. Fields: `file` (File), `orgId`, `projectId?`, `uploadedByUserId?`, `fileType?`, `visibility?`. Validates extension, writes to filesystem, inserts `File` DB record.
- `GET /api/files?orgId=X&projectId=Y&scope=org` — Lists files. `scope=org` returns only org-level (no projectId). `projectId` filters to project-specific files.
- `GET /api/files/[id]` — Serves raw file from filesystem with correct Content-Type. `?inline=true` for browser preview, default is attachment download.
- `DELETE /api/files/[id]` — Deletes file from filesystem and DB.

### New lib
- `lib/files.ts` — `writeUpload`, `readUpload`, `deleteUpload`, `ensureOrgDir`, `ALLOWED_MIME_TYPES`, `getMimeLabel`, `formatBytes`.

### Client Portal — Submit Request
- Drag-and-drop upload zone added above Submit button in `SubmitView`. Hidden `<input type="file">` triggers on click or file drop (DOM events via `dropZoneRef.current.addEventListener`). Files queued as `PendingFile[]` state, uploaded sequentially after project creation. Submit button label shows pending file count.
- `handleNewRequest` clears `pendingFiles` on reset.

### Client Portal — Artwork / Media Bin view
- Replaced empty placeholder with a full file library:
  - Header row with "Upload Files" button (orange) + hidden file input
  - Dashed drop zone for drag-and-drop (`mediaBinDropRef`)
  - File grid: thumbnail preview for images, type badge (AI/PDF/etc.) for others, file name, size, date, Download + Delete actions
  - `fetchMediaBin(orgId)` called when switching to 'artwork' nav item
  - All Media Bin files stored with `projectId = null` (org-level scope)

### Ko OS — Uploaded Artwork section
- Added `renderUploadedArtwork()` in `app/quote/[id].tsx`
- Appears below Line Items in both desktop-left column and mobile layout
- `useEffect` fetches `/api/files?orgId=X&projectId=Y` when quote loads
- Dark-themed cards (matching Ko OS aesthetic): image thumbnail or type badge, filename, size, View (opens in new tab) + Download actions

## Phase 9 — Client Portal Dashboard Redesign (2026-04-21)

### Architecture
The client portal (`app/portal/[orgId].tsx`) is now a full dashboard-driven SaaS-style UI with sidebar navigation. The `Step` type changed from `'email' | 'form' | 'success'` to `'email' | 'dashboard'`. After email verification, the user lands in the dashboard; the submission form is now a view within the dashboard rather than a separate step.

### New API endpoint
- `app/api/portal/[orgId]/projects+api.ts` — GET returns all non-cancelled projects for the org (id, title, status, inHandsDate, createdAt, lineItemCount). Validates hubEnabled.

### Dashboard layout (step === 'dashboard')
- **Sidebar** (210px dark `#111827` background): Org logo/name, 6 nav items with active highlight, user avatar + sign-out button at the bottom. Sticky on web via `Platform.select({ web: { position: 'sticky', height: '100vh' } })`.
- **Main content area** (`flex: 1`, light gray): Scrollable content per active view.

### Nav views
- **Dashboard (Home)** — Welcome header, responsive `dashGrid` with: Active Projects section card (pipeline + status + in-hands date), Quotes & Invoices section card, Artwork empty state. "View all →" links navigate to detail views.
- **Projects** — Full project list with `ProjectPipeline` component (7-step dot pipeline) and status pill per project.
- **Quotes & Invoices** — Filtered to QUOTED + INVOICE_SENT projects.
- **Artwork** — Empty state (placeholder for future feature).
- **Catalogs** — Empty state.
- **Submit Request** — Existing submission form (unchanged logic). After submission, shows success inline with edit/cancel window.

### New top-level components (defined in portal file)
- `StatusPill` — colored pill badge matching `PORTAL_STATUS_CONFIG`
- `ProjectPipeline` — 7-step dot-and-line pipeline showing current status position
- `NAV_ITEMS` — array of `{ id, label, Icon }` for sidebar nav
- `PORTAL_STATUS_CONFIG` — maps DB status strings to display label + colors
- `STATUS_PIPELINE` — canonical ordered status array

### Styling
- `dash` StyleSheet added: sidebar, nav items, section cards, project cards, quote rows, empty states, grid layout
- All original styles preserved for the submission form and email step

## Phase 8 — Client Portal Branding (2026-04-21)

### New DB columns
- `Organization.logoUrl TEXT` — org-specific client-facing logo (client override)
- `Organization.internalLogoUrl TEXT` — admin-set internal default logo for this org

### Priority logic for portal header logo
1. `logoUrl` (org-specific client override)
2. `internalLogoUrl` (admin-side default)
3. Text fallback: "KATALYST KO / Client Portal"

### Changed files
- `prisma/schema.prisma`: Added `logoUrl` + `internalLogoUrl` to `Organization` model
- `types/crm.ts`: Added `logoUrl?` + `internalLogoUrl?` to `Organization` interface
- `app/api/orgs+api.ts` + `app/api/orgs/[id]+api.ts`: Both `toFrontendOrg` functions now return logo fields. `PUT /api/orgs/[id]` accepts + persists both logo fields (params 11 & 12).
- `app/api/portal/[orgId]+api.ts`: GET now returns `logoUrl` + `internalLogoUrl` alongside org name
- `app/portal/[orgId].tsx`: Fetches org info on mount (GET) to read logo URLs. Top bar now renders org logo image + org name when a logo URL is present, with `Image` from React Native. New styles: `topBarBrandRow`, `topBarLogo`.
- `app/hub/[id].tsx`: New "Portal Branding" section in right column with `logoUrlDraft` / `internalLogoUrlDraft` state, text inputs for both URL fields, and a "Save Branding" button that calls `PUT /api/orgs/[id]`. New `logoInput` style.

## Phase 7 — Activity Tracking Expansion + CRM Detail Page Fix (2026-04-21)

### Bug Fixes
- **CRM detail page crash fixed**: `client_intake` (and any unknown activity type) caused `Cannot read properties of undefined (reading 'color')` because `ACTIVITY_TYPE_CONFIG` only had the 5 manual types. Fixed by:
  - Expanding `ActivityType` union in `types/crm.ts` to include all system event types
  - Adding all types to `ACTIVITY_TYPE_CONFIG` with `isSystem: true` flag
  - Adding safe fallback in `crm/[id].tsx`: `ACTIVITY_TYPE_CONFIG[entry.type] ?? ACTIVITY_TYPE_CONFIG['note']`
  - Adding `isLoading` loading state guard in `crm/[id].tsx` (was showing "Contact not found" before orgs loaded)

### New System Activity Types
Added to `ActivityType` and `ACTIVITY_TYPE_CONFIG`:
- `client_intake` — Client submitted a project via portal (Inbox icon, orange)
- `client_cancel` — Client cancelled a portal submission (XCircle icon, red)
- `quote_created` — Quote/project created (FileText icon, blue)
- `quote_sent` — Quote sent to client (Send icon, purple)
- `quote_approved` — Client approved the quote (CheckCircle icon, green)
- `invoice_sent` — Invoice sent (FileText icon, purple)
- `payment_received` — Payment received (DollarSign icon, green)
- `in_production` — Order moved to production (Package icon, orange)
- `completed` — Order completed (CheckCircle icon, green)
- `hub_enabled` — Client Hub enabled for org (Shield icon, blue)
- `member_added` / `member_removed` — Team membership changes (User icon)
- `contact_added` / `contact_updated` — Contact record changes (User icon)

System events render with a distinct left-border style (`activityEntrySystem`) to distinguish them from manual CRM log entries.

### Automatic Activity Logging Added
- **`POST /api/projects`**: Logs `quote_created` when a new project is created with an `organizationId`
- **`PUT /api/projects/[id]`**: Reads old `frontendStatus` before update, logs status-change activities (`quote_sent`, `quote_approved`, `invoice_sent`, `payment_received`, `in_production`, `completed`) when status transitions for projects with an org link
- **`POST /api/portal/quote/[id]`** (approve action): Logs `quote_approved` when client approves a quote with an org link

### Quote View Improvements
- Org name in quote detail CRM panel is now a clickable link (with `ExternalLink` icon) that navigates to `/crm/[orgId]`
- New `orderContactOrgLink` style (row with gap) and removed `marginBottom` from `orderContactOrgName` (moved to link row)

## Phase 6 — Client Hub Project Submission Intake (2026-04-19)

### New files
- `app/portal/[orgId].tsx`: Client-facing portal page (no Ko OS layout). Two-step flow: email verification → submission form. Registered in `_layout.tsx` with `headerShown: false`.
- `app/api/portal/[orgId]+api.ts`: GET returns org name + verifies hubEnabled. POST validates client email against org memberships, returns session (userId, userName, userEmail, orgName).
- `app/api/portal/submit+api.ts`: POST creates Project with `status=NEEDS_REVIEW`, `intakeSource=CLIENT_HUB`, ties to org + submitting client user, creates ActivityLog entry.

### Modified files
- `types/quote.ts`: Added `needs_review` to `QuoteStatus`, `STATUS_CONFIG` (amber/yellow), `STATUS_HIERARCHY`. Added `intakeSource?: string` to `Quote` interface.
- `app/api/projects+api.ts` + `app/api/projects/[id]+api.ts`: Both updated with `needs_review` ↔ `NEEDS_REVIEW` mapping and `intakeSource` field in `toFrontendQuote`.
- `app/(tabs)/projects.tsx`: Added "Needs Review" filter pill (now shows count). Added `onAcceptIntake` prop/handler to `ProjectRow`. "Accept & Start Quote" action in desktop dropdown for `needs_review` projects (moves to `quoted`).
- `app/hub/[id].tsx`: Added "Client Portal Link" section (shows URL + copy-to-clipboard button) when hub is enabled.
- `app/_layout.tsx`: Registered `portal/[orgId]` stack screen with no internal header.

### Client submission form fields
- Project title (required)
- Service type (Screen Printing / Direct to Film / Embroidery / Promotional / Not Sure)
- Estimated quantity
- Due date
- Project details (free text — garments, colors, design, artwork, shipping notes)
- File upload: DEFERRED — artwork files are sent via email (clearly stated on the form)

### Internal notification
- ActivityLog entry created on submission: `actionType='client_intake'`, metadata includes serviceType + quantity
- No email notification yet (deferred — no email infrastructure built)

### Verified end-to-end
- ✅ Portal GET/POST auth endpoints return correct org/user data
- ✅ Submit API creates project with NEEDS_REVIEW + CLIENT_HUB intake source
- ✅ Project appears immediately in Ko OS Projects list with amber "Needs Review" badge
- ✅ Filter pill shows correct count
- ✅ Activity log entry created for the submission

## Phase 5 — Full Client Hubs Admin Section (2026-04-19)
- `app/(tabs)/client-hubs.tsx`: Redesigned to show ALL orgs split into "Hub Enabled" / "Not Enabled" sections; org search; "Not Enabled" orgs have a toggle switch to enable hub in-place (navigates to hub detail after enable); uses `useCrm()` for live data
- `app/hub/[id].tsx`: New dedicated hub management screen — org status card with hubEnabled toggle + portal-ready indicator; Org Admin section (assign/change with internal user picker); Client Users section (invite with role selector, change role, remove); Internal Team section; all changes invalidate `client-hubs` query cache
- `app/api/memberships/[id]+api.ts`: Added PATCH endpoint to update membership role
- `app/_layout.tsx`: Registered `hub/[id]` Stack.Screen with black Ko OS header

### What works in Client Hubs:
- View all orgs + their hub status from the Client Hubs sidebar item
- Enable a hub for any org with a single toggle (immediately opens management screen)
- Assign or change the org admin (picks from internal team users)
- Invite client users with name, email, and role selection (MEMBER/ORG_ADMIN/BILLING_CONTACT/APPROVER)
- Change any member's role inline (tapping role badge opens role picker modal)
- Remove any member (client or internal)
- Portal-ready indicator: green "Portal Ready" when hub is enabled AND an org admin is assigned

### What remains before client project submission goes live:
- Client-facing portal UI (external view for clients) — not built yet
- Email invitation delivery (currently just stores the user record)
- Project intake submission form visible to client users
- File visibility controls (CLIENT_VISIBLE vs INTERNAL)

## Phase 4 — Client Hubs Admin Area, Client Users, Hub Tab Enhancements (2026-04-19)
- `app/api/client-hubs+api.ts`: GET all hub-enabled orgs with aggregated stats: totalMembers, clientUsers count, orgAdminName
- `app/(tabs)/client-hubs.tsx`: New screen listing hub-enabled orgs — org card shows name, CRM status, admin assigned status, client user count, ready/needs-setup indicator
- `components/Sidebar.tsx`: Added "Client Hubs" (Globe icon) nav item
- `app/(tabs)/_layout.tsx`: Registered `client-hubs` screen (hidden from mobile tab bar)
- `app/api/users+api.ts`: GET supports `?type=client` filter; POST supports `userType: 'CLIENT'` path (requires real email, uses `#6366F1` avatar color)
- `app/api/memberships+api.ts`: Now includes `userType` (INTERNAL/CLIENT) in both GET and POST responses
- `types/crm.ts`: Added `userType` to `OrgMembership`
- `app/crm/[id].tsx` Hub tab: Split into "Internal Team" + "Client Users" sections; ORG_ADMIN row highlighted with orange badge; "Invite" button creates CLIENT user + membership in one flow; separate "Add" button for internal team
- New styles: `memberRowAdmin`, `adminBadge`, `adminBadgeText`

## Phase 3 — User DB Sync, Project Attribution, Memberships, Hub (2026-04-19)
- `app/api/users+api.ts`: GET internal users, POST upsert-by-AsyncStorage-ID (email=`{id}@noemail.internal`; maps `org_admin→SUPER_ADMIN`, `user→SALES`; race condition handled with 204 on duplicate)
- `app/api/memberships+api.ts` + `[id]+api.ts`: GET by `?orgId=`, POST upsert, DELETE
- `app/api/orgs/[id]+api.ts` PUT: now accepts `hubEnabled` and persists to DB
- `app/api/projects+api.ts`: `createdByUserId` re-enabled via `resolveUserId()` helper (verifies FK before setting)
- `types/crm.ts`: Added `OrgMembership`, `MembershipRole`, `hubEnabled` on `Organization`
- **Org profile Hub tab**: Toggle `hubEnabled`, view/add/remove team members with `MembershipRole` (ORG_ADMIN/MEMBER/BILLING_CONTACT/APPROVER)

## CRM / Contact System
- Full CRM pipeline: Cold → Working → Active Client → Past Client
- Org profile: Lead Tracking banner (Cold/Working only), Activity Log, Contacts tab, Quotes tab, Campaigns tab, **Hub tab** (hubEnabled toggle + team member management)
- **Departments**: Contacts grouped by department within each org; department CRUD; contacts assignable to departments
- **Contact Import**: 3-step import wizard (paste text or CSV → column auto-mapping → preview → confirm bulk import)
- **Active Projects Tracker**: Purple banner on org profile showing any active/in-production quotes; disappears when none
- **New Quote button** on each org profile (left panel) → navigates to New Quote form pre-filled with org name
- **CRM Autocomplete in New Quote**: Person/Organization field searches CRM orgs live; click to link quote to org (stores orgId)
- **Quote-contact linking**: Quotes with orgId appear in that org's Quotes tab; fallback to name-matching for legacy quotes
- Campaign templates (3 pre-built): Standard 4-Week, Church/Ministry, School/Youth outreach

## Project Status Flow (hierarchy: quoted < active < production_started < completed)
- `draft` — quote being built (New Quote tab only)
- `quoted` — submitted to client (appears in Projects tab)
- `active` — client accepted/converted to active
- `production_started` — "Start Production" pressed in Quote Details; shows as "In Production" purple badge
- `completed` — all line items done, project completed
- `expired` — auto-computed: quoted + orderDate > 30 days ago (no action needed)

## Production Mode (app/quote/production/[id].tsx)
- Navigated to when "Start Production" button pressed in Quote Details
- Status changes to `production_started` on navigate
- Screen goes directly to item detail view (no intermediate list screen)
- Auto-starts at first incomplete item (or item 0 if all done)
- Shows: mockup, design name, service style, applicator, product, locations, notes, size quantities
- Bottom bar: Exit Production | Mark Done/Unmark (or Complete Project when all done)
- Prev/Next navigation between items
- Title: "Production Mode"

## Tech Stack
- **Framework**: React Native with Expo (~54.0.27)
- **Routing**: Expo Router (file-based routing, SSR mode via `web.output: "server"`)
- **Package Manager**: Bun
- **Database**: PostgreSQL (Replit-hosted), accessed via raw `pg` Pool (no Prisma — NixOS binary incompatibility)
- **State Management**: React Context + TanStack React Query v5 (all mutations go through API routes)
- **UI**: React Native StyleSheet, lucide-react-native, expo-linear-gradient

## Data Layer Architecture
- **Schema**: Prisma schema in `prisma/schema.prisma` (used only for `prisma db push` to manage schema migrations)
- **DB Access**: Raw parameterized SQL via `lib/pool.ts` (pg Pool singleton on `globalThis`)
- **API Routes**: `app/api/` using Expo Router `+api.ts` convention (server-only, Node environment)
  - `GET/POST /api/orgs` — list all orgs (with contacts+activity embedded), create org
  - `GET/PUT/DELETE /api/orgs/[id]` — single org CRUD
  - `POST /api/orgs/[id]/contacts` — add contact
  - `PUT/DELETE /api/orgs/[id]/contacts/[contactId]` — update/delete contact
  - `POST/PUT/DELETE /api/orgs/[id]/activity` — activity log CRUD
  - `GET/POST /api/projects` — list all quotes, create quote
  - `GET/PUT/DELETE /api/projects/[id]` — single quote CRUD; PUT also upserts `ProjectItem` rows alongside the blob
  - `POST /api/projects/[id]/quote` — populate the `Quote` relational table from current Project state (idempotent)
  - `POST /api/projects/[id]/invoice` — populate the `Invoice` relational table from Project/salesData (idempotent)
  - `POST /api/projects/[id]/backfill` — bulk-insert `ProjectItem` rows from `lineItemsData` blob (safe to re-run)
  - `POST /api/migrate` — one-time AsyncStorage→DB migration (called on first load if server is empty)
- **Route param convention**: Expo Router passes params as the second argument directly `{ id }`, NOT `{ params: { id } }`
- **DB Table casing**: PascalCase table names (`"Organization"`, `"Contact"`, `"ActivityLog"`, `"Project"`), camelCase columns (quoted)
- **Enum casting**: `$n::"ProjectStatus"` required for ProjectStatus enum
- **ActivityLog**: Has no `updatedAt` column — don't include it in INSERT/UPDATE
- **Status mapping** (frontend → DB enum): draft→DRAFT, quoted→QUOTE_SENT, active/production_started→IN_PRODUCTION, completed→COMPLETED, expired→CANCELLED
- **userId safety**: `userId: 'default'` must be converted to `null` before insert (FK to User table)

## NixOS Workarounds
- **Prisma native binary broken**: `libssl.so.3` path issues on NixOS. Solution: use raw `pg` via `lib/pool.ts`
- **DO NOT set LD_LIBRARY_PATH** in workflow command — breaks NixOS bash
- **DO NOT use Prisma client** for runtime DB access — only `prisma db push` for schema migrations

## Project Structure
- `app/` - Expo Router pages (file-based routing)
  - `(tabs)/` - Main tab screens (New Quote, History, Sales, Clients)
  - `quote/` - Quote detail, edit, and sales tracking screens
  - `clients/[id].tsx` - Client profile page (info panel + linked quotes)
  - `api/` - Server-side API routes (raw pg)
  - `profile.tsx`, `reports.tsx`, `modal.tsx`
- `components/` - Reusable UI components
- `contexts/` - React Context providers (CrmContext, QuotesContext, UserContext)
- `lib/` - Server utilities (`pool.ts` — pg Pool singleton)
- `prisma/` - Schema only (`schema.prisma`); run `npx prisma db push` to sync
- `constants/` - Colors and other constants
- `utils/` - PDF generator, CSV export, Google Sheets export
- `types/` - TypeScript type definitions

## Running the App
The app runs via the "Start application" workflow on port 5000 using:
```
PORT=5000 bun run node_modules/.bin/expo start --web --port 5000
```

## Key Configuration Files
- `app.json` - Expo configuration
- `metro.config.js` - Metro bundler config (bun cache excluded from watching)
- `tsconfig.json` - TypeScript configuration

## Responsive System
The app uses a width-based breakpoint system (`hooks/useBreakpoint.ts`) for responsive layouts:
- **Mobile** (< 768px): Bottom tab bar navigation, single-column layout, 16px horizontal padding
- **Tablet** (768–1023px): Collapsed sidebar (64px icon-only), single-column layout
- **Desktop** (≥ 1024px): Full expanded sidebar (240px), two-column layout with sticky pricing panel

Breakpoints are detected via `useWindowDimensions` so they respond to live browser resizing. The navigation switches between `Tabs` (bottom bar, mobile) and `Sidebar + Slot` (web, tablet/desktop) in `app/(tabs)/_layout.tsx`.

## UI Conventions
- **Brand colors**: Primary/tint `#FF5A00`, sidebar/header `#000000`
- **Line Item Card header**: `#000000` (black) with white text
- **Quote Details line item header**: `#111111` (black), collapsible, shows design name + service·applicator + qty pcs + chevron
- **ToggleButton**: Selected state (Yes or No) is always orange (`#FF5A00`); unselected is grey
- **ComboBox popup**: `maxWidth: 340`, compact paddings/fonts, capped list height `240`
- **Projects table header**: `#111111` black with white text; columns: Status, Date, Client, Project, Applicator(s), Service(s), Total, Markup, Actions
- **Clients table header**: `#111111` black with white text; columns: Avatar, Name, Organization, Email, Phone, Status, Actions

## System-Wide Status Colors (single source of truth in `types/quote.ts` → `STATUS_CONFIG`)
Quote statuses:
- **Draft** = grey bg `#F3F4F6`, grey text `#6B7280`
- **Quoted** = blue bg `#EFF6FF`, blue text `#2563EB`
- **Active** = solid orange bg `#FF5A00`, white text `#FFFFFF`
- **In Production** = solid purple bg `#7C3AED`, white text `#FFFFFF` (status key: `production_started`)
- **Completed** = solid green bg `#16A34A`, white text `#FFFFFF`
- **Expired** = light grey bg `#F9FAFB`, grey text `#9CA3AF`

Also exported: `STATUS_HIERARCHY` mapping status keys to numeric level (0–4) for bulk action conflict detection.

Client statuses (defined in `clients.tsx` and `clients/[id].tsx` → `STATUS_STYLE`):
- **Active** = solid orange bg `#FF5A00`, white text (matches quote Active)
- **Prospect** = yellow bg `#FEF9C3`, dark amber text `#854D0E`
- **Inactive** = light grey bg `#F3F4F6`, grey text `#6B7280`

## Quote Details Page
- **Action bar** (quoted status): ⋮ menu | Mark as Active | Start Production (Flame icon)
- **Action bar** (active/completed): ⋮ menu | Track Costs | Start Production (Flame icon)
- **Menu items**: Edit Quote | Revert to Quoted (active only) | Export to Sheets (active only) | Export PDF | Print | Delete
- **Mark as Active**: stays on page, no navigation (toast confirmation only)
- **Revert to Quoted**: stays on page, no navigation (toast + Alert confirmation)
- **Desktop layout**: two-column (left: Order Info + Line Items, right: Pricing Summary + Sales Tracking)
- **PDF/Print**: Opens new browser window with HTML, triggers print dialog after 800ms

## PDF/Print (web)
Both `generateAndSharePDF` and `printQuote` on web:
1. Generate HTML string from quote data
2. Open new window (`window.open('', '_blank')`)
3. Write HTML to new window
4. Call `window.print()` after 800ms delay

## LineItem Card Layout (field order)
1. Design Name
2. Service Style (SegmentedControl)
3. Service Applicator + Product Source (side-by-side row)
4. Location #1 + Location #2 (side-by-side row)
5. `+ Add Location #3 / #4` (expandable — shows Location 3 + 4 row inline)
6. Project Notes
7. **Garment & Sizes** section — multi-color variant table (up to 10 rows)
   - Each row: Style/Product | Color | XS | S | M | L | XL | 2XL | 3XL | 4XL | Qty | [X]
   - `GarmentVariant = { product, color, sizes: SizeQuantities }`
   - Stored as `item.garmentVariants?: GarmentVariant[]`
   - All variant sizes merged into `item.sizes` for downstream calculations
8. Embroidery Calculator (if Embroidery style)
9. DTF Calculator (if Direct to Film style), inside costs section
10. Costs Per Piece (Product / Service / Fees / Markup)
11. Line Item Subtotal table

## Order Information Form
- Tablet/Desktop: Person/Organization | Project Name | Invoice Number on same row (3 columns)
- Mobile: stacked fields

## Known Patches
- `node_modules/metro-file-map/src/watchers/FallbackWatcher.js`: ENOSPC/EINVAL treated as ignorable (prevents Metro crash on Replit)
- `stubs/react-native-reanimated.js`: Comprehensive stub; wired via `metro.config.js` `extraNodeModules`

## Deployment
Runs as a server-side rendered Expo web app (`web.output: "server"` in `app.json`). The API routes require a Node/Bun server — this is NOT a static site export.
