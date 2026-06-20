---
name: White-screen triage on the Expo SSR app
description: A blank/"continually loading" white screen on this app is usually an expired Clerk session, not a code regression — how to confirm before blaming your edit.
---

# White screen ≠ your edit broke it

When the user reports the app "won't load / white screen after edits," confirm the
real cause before assuming a regression. On this app the usual culprit is an
**expired Clerk login session**, which is auth-locked and fixed by re-authenticating
(hard refresh → sign in again), NOT by a code change.

**Fast triage checklist (all read-only):**
1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/` (and `/sign-in`,
   `/(tabs)`, `/portal/<x>`) → all 200 means SSR/server is healthy.
2. `curl .../api/auth/me` → **401 "JWT is expired"** is the smoking gun: the Clerk
   session token lapsed. Check the expiry vs current time in the workflow logs.
3. Browser console (refresh_all_logs): if you see only "Running application main"
   plus the known shadow*/pointerEvents/Clerk-dev-keys warnings and **no JS error**,
   the React tree booted fine — it's a session/auth-state issue, not a render crash.
4. `git show --stat HEAD` → scope the blast radius of your change.

**Why it's not the portal redesign:** the root `AuthGate` in `app/_layout.tsx`
explicitly skips portal routes (`if (isPortal) return;`) — portal pages use their own
email-based session, not Clerk/UserContext. An expired Clerk JWT can never come from a
portal-only edit. On expiry, AuthGate **redirects to `/sign-in`** (it has no global
blanking "Loading…" gate at the root; the loading gates live inside the auth-gated
screens themselves).

**Resolution:** tell the user to hard-refresh and sign in again. Do not touch Clerk
(AUTHENTICATION LOCK in replit.md).
