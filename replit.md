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

## Known Bug Fixes (Phase 3)
- **Quote submit persistence fix (2026-04-19)**:
  - *Bug 1*: `isAdmin` in QuotesContext evaluated `false` during async `UserContext` init (`currentUser=null`), causing the per-user filter `q.userId === null` to drop all DB quotes. Fix: `const isAdmin = !currentUser || currentUser.role === 'org_admin'` — treat no-user state as admin view so quotes are visible during initialization.
  - *Bug 2*: POST `/api/projects` INSERT always uses `gen_random_uuid()` (server-generated UUID), ignoring the client's `generateId()` timestamp string. After submit, `router.push(/quote/${clientId})` navigated to a non-existent route. Fix: Use `onSuccess: (saved) => router.push(/quote/${saved.id})` to navigate with the server-returned UUID instead of a blind `setTimeout`.

## Context Layer
- **QuotesContext**: All quote/project CRUD via `/api/projects` — fully migrated from AsyncStorage
- **CrmContext**: All org/contact/activity CRUD via `/api/orgs` — fully migrated from AsyncStorage. Phase 3 additions: `updateOrgHubEnabled`, `createMembership`, `createMembershipAsync`, `deleteMembership`
- **UserContext**: Primary store is AsyncStorage; DB sync added in Phase 3 (fire-and-forget upsert on init and on create/update). AsyncStorage IDs used directly as PostgreSQL `User.id` (string PK). `syncUserToDB()` called on boot and on every mutation.
- **ClientsContext**: DELETED. The legacy `Client` type is fully replaced by `Organization` + `Contact`. Dashboard client counts now derive from `useCrm().orgs`. `autoAddClientIfNew` in sales-tracking now calls `addOrg` via `useCrm`. `contexts/ClientsContext.tsx` and `types/client.ts` deleted.

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
