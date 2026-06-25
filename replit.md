# Katalyst Ko Quote Tracker 5000 — Ko OS

A React Native / Expo app for tracking sales quotes, built for Katalyst Ko custom apparel print shop.

## Project Rules

### AUTHENTICATION LOCK
Clerk is complete and approved. The agent must not inspect, modify, validate, regenerate, or revisit any Clerk implementation unless specifically requested by the user. All future tasks must ignore authentication entirely.

### PRODUCT MODEL LAW — NON-NEGOTIABLE
The relationship between Products, Quotes, and Mockups is fixed and must be honored everywhere:
- **Products = Curated Library** — the Products catalog is a deliberately curated library, NOT the universe of every product that can be sold.
- **Quotes = Any Product** — quoting is never restricted to the curated library; any product can be quoted (free-text), with the catalog as an optional enhancement/link layer, never a gate.
- **Mockups = Any Suitable Visual Representation** — mockups may use any suitable visual representation, not limited to the curated library.

Never gate quoting or mockups on the Products catalog.

## Run & Operate

To run the application, use the following command:
```bash
PORT=5000 bun run node_modules/.bin/expo start --web --port 5000
```

Required environment variables: `PORT`.

_Populate as you build_

## Stack

- **Framework**: React Native with Expo (~54.0.27)
- **Routing**: Expo Router (file-based routing, SSR mode via `web.output: "server"`)
- **Package Manager**: Bun
- **Database**: PostgreSQL (Replit-hosted), accessed via raw `pg` Pool
- **ORM**: Raw parameterized SQL via `lib/pool.ts`
- **Validation**: _Populate as you build_
- **Build Tool**: Metro bundler (`metro.config.js`)
- **State Management**: React Context + TanStack React Query v5 (all mutations go through API routes)
- **UI**: React Native StyleSheet, lucide-react-native, expo-linear-gradient

## Where things live

- **App Entry**: `app/_layout.tsx`
- **Main Tabs**: `app/(tabs)/`
- **Quote Details**: `app/quote/`
- **Client Profile**: `app/crm/[id].tsx`
- **Client Portal**: `app/portal/[orgId].tsx`
- **API Routes**: `app/api/` (server-side, Node environment)
- **Reusable Components**: `components/`
- **React Context Providers**: `contexts/`
- **Server Utilities**: `lib/` (e.g., `lib/pool.ts` for DB access)
- **Prisma Schema**: `prisma/schema.prisma` (for schema migrations only)
- **Type Definitions**: `types/`
- **DB Schema Source of Truth**: `prisma/schema.prisma`
- **API Contracts Source of Truth**: `app/api/**/*.ts` (implicitly defined by route handlers)
- **Theme Files**: `constants/colors.ts` (for brand colors)
- **Responsive Breakpoints**: `hooks/useBreakpoint.ts`

## Architecture decisions

- **Raw SQL over Prisma Client**: Due to NixOS binary incompatibility, direct `pg` pool is used for all runtime DB access, with Prisma only for schema migrations (`prisma db push`).
- **Unified Org Logo System**: `Organization.logoUrl` is the single source of truth for organization logos across the app, replacing `internalLogoUrl` for display.
- **Client Hub as Dashboard**: The client portal (`app/portal/[orgId].tsx`) is designed as a full dashboard with sidebar navigation, transitioning from a step-based flow.
- **Activity Tracking Expansion**: Extensive system-generated activity types are logged automatically for CRM and project lifecycle events, distinguishable from manual notes.
- **Server-Side Rendered (SSR) Web App**: Expo web app uses `web.output: "server"`, requiring a Node/Bun server for API routes, not a static site export.

## Product

- **Sales Quote Management**: Create, manage, and track sales quotes with line items.
- **Unified Project Tracking**: Single "My Projects" view for all project statuses, replacing separate quote and sales views.
- **Project Lifecycle Management**: Tracks projects through Draft, Quoted, Active, In Production, and Completed states. Auto-expiration for quoted projects.
- **Client Hub**: A client-facing portal for clients to submit requests, view project status, access media bins, and browse product catalogs.
- **CRM System**: Comprehensive CRM for managing organizations, contacts, activities, and leads with role-based access control.
- **Media Bin**: Centralized storage for project-specific and organization-level files with upload, preview, and management features.
- **Reports**: Generation of PDF, CSV, and Google Sheets exports for quotes and project data.
- **Role-Based Access Control**: Differentiates `org_admin` and `user` roles with varying access to features like company logo upload, API integrations, and user management.

## User preferences

- **Communication style**: Use clear and concise language.
- **Coding style**: Adhere to modern TypeScript/React best practices. Prefer functional components and hooks.
- **Workflow**: Prioritize iterative development. Break down large tasks into smaller, manageable steps.
- **Interaction**: Ask for clarification before implementing significant changes or making assumptions about design.
- **Code reviews**: Detailed explanations of changes and their impact are appreciated.

## UI Conventions

### OVERLAY / DROPDOWN LAW — NON-NEGOTIABLE
Every dropdown menu, action popover, row context menu, or any floating panel MUST use `<OverlayMenu>` from `@/components/OverlayMenu`. This is an absolute rule with no exceptions.

**Why:** React Native's layout system clips `position: 'absolute'` children at the nearest ancestor that forms a stacking context (ScrollView, overflow:hidden View, etc.). Using a plain absolutely-positioned sibling for a dropdown will always clip behind rows below it in a table, behind sticky headers, or behind sibling layout boxes. `OverlayMenu` renders via a `Modal` (portal) so it floats above the entire page unconditionally.

**The pattern — always:**
```tsx
import OverlayMenu from '@/components/OverlayMenu';

<OverlayMenu menuWidth={180} align="right"
  trigger={({ open }) => (
    <TouchableOpacity onPress={open}>...</TouchableOpacity>
  )}
>
  {({ close }) => (
    <>
      <TouchableOpacity onPress={() => { close(); doSomething(); }}>...</TouchableOpacity>
    </>
  )}
</OverlayMenu>
```

**Never use:**
- `position: 'absolute'` siblings of a trigger button (clips inside ScrollViews)
- Manual `zIndex` + conditional `{isOpen && <View style={{ position: 'absolute' }}>}` patterns
- `position: 'relative'` wrappers with an absolute child dropdown

This rule applies to every file, every screen, every new feature going forward.

### PHONE FORMAT LAW — NON-NEGOTIABLE
Every phone number, ANYWHERE it appears (tables, forms, invoices/PDFs, templates, portal, and the database), MUST be `(###) ###-####`. It auto-adjusts from any input (`##########`, `###-###-####`, `1##########`, etc.). The single source of truth is `@/utils/phone`:
- **Display** any stored phone with `formatPhone(raw)` (idempotent).
- **Inputs** (`<TextInput>`) format live with `formatPhoneInput(raw)` via `onChangeText`, and pre-fill values through it too.
- **API write paths** normalize before storing with `formatPhoneOrNull(raw)` so the DB itself holds the formatted value.
- **Search/filter** compares `normalizePhone(value)` on both sides so digit-only queries still match formatted storage.
- For **display/storage** (`formatPhone`/`formatPhoneOrNull`), non-US / non-10-digit values pass through untouched (graceful degradation), never blocked. Live `<TextInput>` formatting is US-oriented (caps at 10 digits).

Never render a raw `.phone` field directly — always pipe it through a `utils/phone` helper.

- **MediaCard file type**: `<MediaCard>` shows the file type only in the `typeLabel` metadata line below the image (e.g. "Jun 20, 2026 · PNG · 1.2 MB"). There is no separate file-type badge/pill — it was removed as redundant clutter. Always pass `typeLabel` on every usage so the metadata line is complete.
- **Table column widths**: Global defaults tightened (textPrimary 280/220/400, text 130/110/220, status 120, date 110, numeric 88). Per-table overrides: Organizations `org` (240/195/315), `bizType` fixed 130px, `phone` fixed 138px; Quotes/Projects `colProject` (210/160/300); Client Hubs `colOrg` (`flex:1, minWidth:160, maxWidth:300`).

## Gotchas

- **DB Column Mismatch**: Always ensure `prisma/schema.prisma` matches the actual PostgreSQL database schema. Missing columns (e.g., `quoteSentAt`, `waveInvoiceLink`) can cause silent failures or 500 errors on save. Run `npx prisma db push` after schema changes.
- **React Query `networkMode`**: In Replit's proxied environment, `networkMode: 'always'` in `QueryClient` is crucial to prevent queries from pausing due to false offline reports.
- **Dynamic API Routes `null` params**: Expo Router SSR can call dynamic API routes with `null` params during static rendering; include `params ?? {}` guards and early 404 returns in API handlers.
- **`isAdmin` Context Evaluation**: Be mindful of asynchronous `UserContext` initialization; `isAdmin` checks should account for `currentUser=null` state.
- **Expo Router Navigation with Server IDs**: When creating new records, navigate using the server-returned UUID (`onSuccess: (saved) => router.push(/quote/${saved.id})`) instead of client-generated IDs or blind timeouts.

## Brand Assets

### PRIMARY LOGO — Non-Negotiable
The **horizontal "KATALYST KO | KO." wordmark** (`ko-logo-horizontal.png`) is the primary brand asset going forward. It must appear in the upper-left of every document: Quote, Invoice, Production Punch Sheet, and any future documents.

- **Bundled file**: `assets/images/ko-logo-horizontal.png` (for React Native `<Image require()>`)
- **Public URL**: `public/ko-logo-horizontal.png` → served at `/ko-logo-horizontal.png`
- **PDF/document embed**: `constants/logoDataUri.ts` exports `KO_LOGO_HORIZONTAL_URI` — a base64 data URI of the same file, used by `constants/company.ts → COMPANY.logoUrl` so the logo renders in every PDF context (native expo-print, web print dialog, downloaded HTML, iframes) without any network dependency.
- **Sidebar / UI**: `COMPANY.logoFallback = '/ko-logo-horizontal.png'` — used when no org logo is uploaded.

The square **KO. flag icon** (`ko-logo.png`) is for auth page icon badges (sign-in, sign-up, forgot-password) only.

Do not use the old R2 CDN URL or old pennant-style Katalyst Ko logo anywhere.

## Pointers

- **Expo Router Docs**: [https://docs.expo.dev/router/introduction/](https://docs.expo.dev/router/introduction/)
- **TanStack Query Docs**: [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
- **React Native Docs**: [https://reactnative.dev/docs/getting-started](https://reactnative.dev/docs/getting-started)
- **PostgreSQL Docs**: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **NixOS (for deployment/environment specifics)**: [https://nixos.org/](https://nixos.org/)