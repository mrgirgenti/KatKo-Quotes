---
name: Clerk auth architecture
description: How Clerk authentication is wired into this Expo SSR app — identity layer, DB user mapping, server-side verification, and client token injection.
---

# Clerk Auth Architecture

## Principle
Clerk = identity only. DB `User` table is the source of truth for roles (`internalRole` → `FrontendRole`).

## Key files
- `lib/auth.ts` — `authenticateRequest(req)` verifies Bearer token with `@clerk/backend` `verifyToken`, then calls `upsertDbUser` to provision/reconcile the DB row. Returns `AuthedUser | null`. Exports `unauthorized()` (401) and `forbidden()` (403) helpers.
- `app/sign-in.tsx` — Google SSO + email/password sign-in screen.
- `app/sign-up.tsx` — account creation screen.
- `app/forgot-password.tsx` — password reset screen.
- `lib/clerkToken.ts` — `setClerkTokenGetter` / `getClerkToken` so non-React modules (apiFetch) can retrieve the Clerk Bearer token.
- `app/_layout.tsx` — `ClerkProvider` at the root; `AuthGate` component handles client-side redirects; `useEffect` calls `setClerkTokenGetter(() => getToken())`.

## DB User provisioning (`upsertDbUser`)
1. Look up `User` by `authProvider='clerk'` + `authProviderUserId`.
2. If found → update `lastLoginAt`, return.
3. Pull profile from Clerk API (email, firstName, lastName).
4. If email matches an existing row → attach Clerk identity to it (legacy user migration path).
5. Otherwise `INSERT`. First user ever → `SUPER_ADMIN`; all subsequent → `SALES`.

## Role mapping
`internalRole='SUPER_ADMIN'` → `FrontendRole='org_admin'`; everything else → `'user'`.

## Server-side enforcement
- `POST /api/projects` and `PUT/PATCH /api/projects/[id]` call `authenticateRequest(req)` and return 401 if null.
- `actorName` for activity log is derived from the verified user, not the request body.
- Priority/assignee/operationalStatus changes on projects require `org_admin` role → 403 otherwise.

## Portal routes
`/portal/*` routes are a separate client-facing auth system and are intentionally NOT gated by Clerk.

**Why:** Clerk = lightweight identity layer only; business logic (roles, permissions) stays in our DB to avoid coupling to the identity provider's pricing/features.
