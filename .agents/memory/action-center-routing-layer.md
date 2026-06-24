---
name: Action Center is a routing layer
description: Action Center surfaces items and jumps to the source record; it is NOT tasks/ticketing/assignment software.
---

# Action Center = routing layer, not ticketing

The Action Center (`app/(tabs)/action-center.tsx`) is a **routing/triage surface**: it
lists actionable items and sends the user to the source record (Quote/Project or
Organization). It is explicitly **NOT** task-management, ticketing, or assignment
software.

**Why:** A user-approved correction stripped out the ticketing/assignment model that had
crept in (per-item ASSIGNED owner + avatars, a 3-state status switcher, an activity
timeline, and Details/Activity/Related tabs). The product intent is "see it → open the
real record and act there," not "manage work inside the Action Center."

**How to apply — do NOT reintroduce:**
- No ASSIGNED column, assignee avatars/initials, or assignment controls.
- No status-switcher pills in the drawer (only `Mark as Resolved` is allowed; `markViewed`
  fires automatically on open / via the row overflow menu).
- No activity timeline or Details/Activity/Related tabs. The drawer is a single read-only
  DETAILS panel + Comments + Attachments, plus a footer (primary Open CTA + Mark Resolved).
- Filter pills are routing/triage categories, not workflow states:
  All, New, Needs Review, Customer Requests, Production Issues, System Alerts, Resolved.

**Routing rule (Quote == Project entity):** `projectId → /quote/{id}`, else
`organizationId → /crm/{id}`. CTA/menu labels come from `ctaFor(item)` (Open Quote / Open
Project / Open Organization) — keep the primary CTA and the overflow-menu label in sync;
never hardcode "Open Project".

**Requester metadata:** producers populate `metadata.requestedByName` /
`requestedByEmail` (e.g. `submit+api.ts` NEW_QUOTE_SUBMISSION, quote-response
QUOTE_REVISION_REQUEST). The drawer falls back to legacy `responderName` for older rows.
