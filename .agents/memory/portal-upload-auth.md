---
name: Portal upload auth bypass
description: Why portal file operations need their own API routes instead of /api/files
---

Portal clients authenticate via their own session (orgId + userId in localStorage),
NOT via Clerk tokens. The main /api/files POST and /api/files/[id] DELETE both call
`authenticateRequest()` which requires a valid Clerk Bearer token.

**Why:** When Clerk auth hardening was added to /api/files, portal uploads broke
silently (fetch().catch(() => {}) swallowed the 401). Root cause is that portal
clients never have a Clerk token.

**How to apply:** Any file operation initiated from app/portal/[orgId].tsx must go to
portal-scoped routes:
- Upload → POST /api/portal/[orgId]/upload+api.ts (no auth, validates orgId from route)
- Delete → DELETE /api/portal/[orgId]/files/[fileId]+api.ts (no auth, validates orgId ownership)

Never route portal file ops through /api/files or /api/files/[id] — those require Clerk.
