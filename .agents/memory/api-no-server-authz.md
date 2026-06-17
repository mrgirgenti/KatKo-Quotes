---
name: API server-side authorization (partial)
description: Server-side auth now exists for project mutations and user-role changes; most GET reads are still ungated.
---

# API server-side authorization is PARTIAL

Real auth (Clerk) now exists. `lib/auth.ts#authenticateRequest` verifies the
Bearer token (`@clerk/backend verifyToken({secretKey})`) and resolves/provisions
the DB `User` (role comes from `internalRole`, DB is the source of truth).
Client `apiFetch` (QuotesContext, CrmContext) and `syncUserToDB` attach the token
via `lib/clerkToken.ts`.

What IS enforced server-side:
- Project mutations: `POST /api/projects` requires auth; `PUT /api/projects/[id]`
  blocks priority/assignee CHANGES by non-admins (operational STATUS allowed for
  any authed user, by design — preserves the Production Module); DELETE is
  org_admin-only; `actorName` is derived from the verified session, not the body.
- `POST /api/users` internal branch: client-supplied `role` is only honored when
  the caller is a verified org_admin (closes the privilege-escalation path that
  otherwise nullifies the whole role model). CLIENT branch left open for portal.

What is NOT yet enforced (deferred — known gap):
- Most GET reads are still UNAUTHENTICATED: `GET /api/projects`,
  `GET /api/projects/[id]`, `GET /api/projects/[id]/activity`, `GET /api/users`.
  Anyone can read internal data by direct API call. The login screen is a UX gate
  only for reads.
- Gating reads requires updating direct (non-apiFetch) callers too:
  `app/quote/[id].tsx` and `app/(tabs)/projects.tsx` fetch `/api/projects/[id]`
  WITHOUT a token, and the client portal/hub also hit some routes — so it is a
  cross-cutting change, not a per-route patch.

**Why:** Auth was added incrementally (Task #19) scoped to mutations; read-gating
was deferred to avoid breaking the untouched client-hub portal and direct fetch
call sites.

**How to apply:** Treat write/role endpoints as enforced; treat reads as open.
Before relying on read protection, add `authenticateRequest` to the GET routes AND
attach tokens at every direct fetch caller (audit `rg "fetch\(.*/api/"`).
