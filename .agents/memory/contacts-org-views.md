---
name: Contacts vs Organizations views
description: How the single /clients route serves both the org table and the people directory
---

The CRM `Contact` table is genuinely person-centric (belongs to an Organization, optional `linkedUserId` to a portal User). The data model was already correct; the historical complaint that "Contacts duplicates Organizations" was purely presentation.

**Routing:** `app/(tabs)/clients.tsx` reads the `view` global search param. `view=contacts` renders the person-centric directory (`components/ContactsDirectory.tsx`); anything else renders the org table. Sidebar nav points Organizations→`/clients`, Contacts→`/clients?view=contacts`.

**Hub Status derivation (read-only, in `/api/orgs` GET):** match each contact to a CLIENT `User` — explicit `Contact.linkedUserId` is authoritative; otherwise fall back to lower(email) match BUT only if that user has an `OrganizationMembership` in the contact's org.

**Why the org scope matters:** `User.email` is unique, but an email-only match can link a contact to a portal user in a *different* org, leaking their hub presence/last-login. Always scope email fallback by membership.

**Known gap (not yet done):** the Hub invite flow does not set `Contact.linkedUserId`, so links rely on the email+membership fallback. A proper find-or-create-and-link on invite + a one-time backfill remain as follow-ups.
