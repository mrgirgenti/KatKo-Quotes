---
name: CRM/Hub user provisioning & linkedUserId model
description: How Contact↔User↔Membership is keyed (linkedUserId) vs how portal login works (email), and the grant-flow FK race.
---

# Client Hub provisioning & the linkedUserId model

## Two-layer identity model (don't conflate)
- **CRM/Hub admin side** resolves a contact's hub access via **`Contact.linkedUserId`**
  (authoritative), NOT by email matching. `contactHasHubAccess(c) = !!(c.linkedUserId
  && clientMembershipByUserId.has(c.linkedUserId))`. Hub readiness ("Team Member
  Added", "Org Admin Assigned") derives from contacts whose linkedUserId resolves to a
  membership, not from raw membership counts.
- **Portal login** (`app/api/portal/[orgId]+api.ts`) is **email-based auth**: it matches
  `LOWER(u.email)` joined to an OrganizationMembership for that org. It does NOT use
  Contact.linkedUserId. These are deliberately separate layers.

**Why it matters:** the same email can appear on multiple Contacts across orgs (e.g.
josh@katalystko.com is on two different contacts). Email matching for *relationship*
resolution is ambiguous; linkedUserId disambiguates. Login can still be email-based
because it's per-org auth input, not a relationship link.

## Grant-flow FK race (known bug class)
The grant handlers (crm `handleSaveContact` / `handleEnableHubFromCard` /
`handleAddClientUser`, and hub `handleGrantHubFromContact`) generate a client-side
`client_<ts>_<rand>` id, POST it to `/api/users`, then create a membership with the
returned user id.

`POST /api/users` (client branch) returns the **existing** user (200) if the email is
already taken — good. But on an email-unique race it returns **204 (empty body)**, and
the handlers fall back to `{ id: userId }` (the freshly generated `client_<ts>` id that
was **never inserted**). The subsequent membership insert then violates
`OrganizationMembership_userId_fkey` → `Key (userId)=(client_...) is not present in
table "User"`.

**Root cause is the provisioning fallback, NOT the linkedUserId model** — it would exist
regardless of Phase A. Fix direction (when in scope): never reuse the optimistic
client id; only create the membership with an id actually confirmed present in User
(handle 204/non-2xx by re-fetching the user by email or aborting with a clear error).

**Related data artifacts to watch:** orphan CLIENT memberships with no Contact
(`has_contact=f`), and contacts that are linked (linkedUserId set, user exists) but have
no membership ("linked, no access").
