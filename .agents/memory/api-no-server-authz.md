---
name: API has no server-side authorization
description: All role/permission gating in this app is client-side only; API routes trust the request body.
---

# API routes have NO server-side authorization

The PUT/POST handlers under `app/api/**` do not authenticate the caller or
enforce role/transition rules. Role gating (org_admin vs user) lives entirely in
the React layer, and identity for activity logging (`actorName`) is passed in the
request body — it is not derived from a verified session.

**Why:** The app was built with client-side `isAdmin` context only; there is no
session/auth middleware on the SSR API routes. A direct API call can set any
field regardless of the caller's UI role.

**How to apply:** When adding a "role-restricted" feature, know that the
restriction is cosmetic at the API boundary. If a feature genuinely needs
enforcement (privilege escalation, financial fields, destructive ops), it
requires introducing server-side auth across the API surface — a cross-cutting
change, not a per-route patch. Surface it as its own task rather than bolting an
inconsistent check onto one route.
