---
name: CRM/Hub people provisioning & linkedUserId model
description: Contacts are the single people source of truth; how hub access is derived (linkedUserId) and provisioned (one contact-keyed server path) vs how portal login works (email).
---

# Client Hub provisioning & the linkedUserId model

## Single source of truth: Contacts
People management has ONE read model and ONE write path. Never reintroduce a parallel
people surface (the old standalone Hub Management page + Hub Members/Invite/Add-Member
cards were deleted for exactly this reason — they drifted from Contacts).

- **Read (derivation):** `lib/contacts.ts` is authoritative. `fetchEnrichedContacts` /
  `toEnrichedContact` LEFT JOIN `Contact.linkedUserId -> User(userType='CLIENT') ->
  OrganizationMembership` and derive per-row `hubAccess`, `hubStatus`, `isOrgAdmin`,
  `membershipId`, `inviteSentAt`, `lastActivityAt`. **Every** endpoint that returns org
  contacts must use this — both `/api/orgs/[id]` (detail) AND `/api/orgs` (list). If only
  one is enriched, surfaces that read the other (Client Hub card counts, ContactsDirectory,
  client-hubs page) silently drift.
- **Write (provisioning):** all people/auth mutations go through ONE endpoint keyed by
  contactId: `PATCH /api/orgs/[id]/contacts/[contactId]` with `{action}` (enableHubAccess,
  disableHubAccess, resendInvite, resetPassword, promoteAdmin, removeAdmin). It provisions
  the invisible `User`+`OrganizationMembership` substrate server-side and sends invite/reset
  emails via `lib/email`. The UI never creates/manages memberships directly.

**Why:** the same email can appear on multiple Contacts across orgs, so **email matching for
relationship resolution is ambiguous** — `linkedUserId` disambiguates. Do NOT add an email
fallback to contact→user resolution (a removed `/api/orgs` email-match path caused exactly
this drift).

## Portal login is a separate layer
`app/api/portal/[orgId]+api.ts` login is **email-based auth** (matches `LOWER(u.email)` +
membership for that org). It does NOT use `Contact.linkedUserId`. Deliberately separate:
login is per-org auth input, not a relationship link.

## Provisioning guards (learned)
- `User.email` is globally `@unique`. When enabling hub access, look up the existing user by
  email **including userType**: reuse only if `CLIENT` (reactivate if DISABLED); if the email
  belongs to a non-CLIENT (internal) user, **reject with a clear 409** — never turn an
  internal account into a client login (it also collides with the unique constraint).
- The old client-generated `client_<ts>` id → 204 race FK bug is GONE: the server now creates
  the User/membership itself and links the real DB id, so never reintroduce optimistic
  client-side user ids for provisioning.

**Data artifacts to watch:** orphan CLIENT memberships with no Contact, and contacts linked
(linkedUserId set) but with no membership ("linked, no access").
