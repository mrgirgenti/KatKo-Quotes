---
name: Clerk auth frozen
description: User has explicitly frozen all Clerk/auth work — never touch it again unless asked.
---

# Clerk Authentication — Frozen

The user has explicitly declared Clerk authentication complete and out of scope for all future work.

**The rule:** Never touch auth files, never plan auth tasks, never validate auth, never investigate Clerk — unless the user explicitly asks for it.

**Why:** Clerk integration was completed and approved. The user wants zero auth noise in all future planning and implementation.

**How to apply:** If a task *could* touch auth (even indirectly), skip the auth angle entirely. Do not mention Clerk, session tokens, environment variables for Clerk, middleware, auth configuration, or auth-related cleanup unless the user's message explicitly requests it.

Files that are frozen (do not modify):
- `lib/auth.ts`
- `lib/clerkToken.ts`
- `app/_layout.tsx` (ClerkProvider / AuthGate sections)
- `app/sign-in.tsx`
- `app/sign-up.tsx`
- `app/forgot-password.tsx`
- `app/api/auth/me+api.ts`
- Any file whose sole purpose is auth
