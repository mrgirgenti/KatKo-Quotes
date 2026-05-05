# Katalyst Ko Quote Tracker 5000 — Ko OS

A React Native / Expo app for tracking sales quotes, built for Katalyst Ko custom apparel print shop.

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

## Gotchas

- **DB Column Mismatch**: Always ensure `prisma/schema.prisma` matches the actual PostgreSQL database schema. Missing columns (e.g., `quoteSentAt`, `waveInvoiceLink`) can cause silent failures or 500 errors on save. Run `npx prisma db push` after schema changes.
- **React Query `networkMode`**: In Replit's proxied environment, `networkMode: 'always'` in `QueryClient` is crucial to prevent queries from pausing due to false offline reports.
- **Dynamic API Routes `null` params**: Expo Router SSR can call dynamic API routes with `null` params during static rendering; include `params ?? {}` guards and early 404 returns in API handlers.
- **`isAdmin` Context Evaluation**: Be mindful of asynchronous `UserContext` initialization; `isAdmin` checks should account for `currentUser=null` state.
- **Expo Router Navigation with Server IDs**: When creating new records, navigate using the server-returned UUID (`onSuccess: (saved) => router.push(/quote/${saved.id})`) instead of client-generated IDs or blind timeouts.

## Pointers

- **Expo Router Docs**: [https://docs.expo.dev/router/introduction/](https://docs.expo.dev/router/introduction/)
- **TanStack Query Docs**: [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
- **React Native Docs**: [https://reactnative.dev/docs/getting-started](https://reactnative.dev/docs/getting-started)
- **PostgreSQL Docs**: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **NixOS (for deployment/environment specifics)**: [https://nixos.org/](https://nixos.org/)