---
name: Client Hub My Projects = three fixed workflow sections
description: The portal My Projects page groups by 3 fixed workflow stages, never dynamically by status.
---

# Client Hub "My Projects" grouping law

`app/portal/[orgId].tsx` → `MyProjectsView` must render **exactly three** customer-facing
sections, fixed by business-workflow stage — never one-section-per-status:

1. **SUBMITTED QUOTES** — quote-stage records (NEEDS_REVIEW, QUOTING, QUOTED, and future
   CHANGE_REQUESTED / REVISION_REQUESTED / AWAITING_APPROVAL / AWAITING_RESPONSE).
2. **ACTIVE PROJECTS** — catch-all for every post-approval status (Active, Invoiced,
   Paid, In Production, Ready For Production, On Hold, Awaiting Artwork/Mockup, etc.).
3. **COMPLETED PROJECTS** — only COMPLETED, SHIPPED.

**Why:** Customers should only understand "waiting on a quote → work in progress →
finished." Surfacing internal workflow states as their own sections (Quote Ready, Being
Quoted, Quotes Sent, Needs Review, …) leaks complexity. A user-approved correction
collapsed the old status-driven sections into these three.

**How to apply:**
- Statuses only *route* a record into a bucket via a `sectionOf(status)` helper; statuses
  never spawn a section. Active is the fall-through default.
- **Expired/Cancelled are excluded from all three sections** and reachable only through the
  "Expired Quotes" filter pill (a drill-in section that appears only when that pill is
  active). Don't add a permanent Expired section.
- The portal API (`/api/portal/[orgId]/projects`) already normalizes at SQL level:
  `QUOTE_SENT→QUOTED`, `DRAFT→NEEDS_REVIEW`, `CANCELLED→EXPIRED`. Bucket on the normalized
  value.
- Pagination and the empty-state must key off the **currently visible** bucket totals
  (the 3 sections, or expired in the pill view) — never raw `sortedDisplayed`, or excluded
  rows produce blank pagination pages / a blank body.
