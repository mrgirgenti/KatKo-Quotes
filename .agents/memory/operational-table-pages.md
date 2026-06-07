---
name: Operational table pages (Projects + Quotes siblings)
description: The Quotes and Projects tabs share one operational-table design; keep them in sync, and gotchas for the shared row-menu + bulk selection.
---

# Quotes & Projects are sibling operational tables

`app/(tabs)/projects.tsx` (nav "Projects") and `app/(tabs)/sales.tsx` (nav "Quotes")
are intentional siblings: same "operational command center" design — sortable data
TABLE + KPI stats bar + status filter pills (with counts) + search + advanced filters
+ bulk action bar + mobile sort strip / card fallback. They differ only in dataset
and domain columns:
- Projects → `projects` slice; columns incl. Invoice#, Total, Markup, Applicator(s);
  actions are lifecycle (Accept Intake / Start Production / Complete / Revert).
- Quotes → `sales` slice (active/production_started/completed); columns Quote #
  (`invoiceNumber||projectNumber`), Revenue (`salesData?.amountCollected || calculations.total`),
  Profit (`getSalesProfit`); actions are sales-side (Track, Save&Lock / Unlock via
  admin-password modal, Revert Back, Export to Sheets, Export PDF, Print, Delete).

**Rule:** when changing the table/KPI/pills/sort/bulk UX on one, consider applying it
to the other so they stay visually consistent.
**Why:** users perceive them as one system; the Quotes page was explicitly rebuilt to
match the Projects design.

## Gotchas carried over from the Projects template
- **Bulk selection must derive from the FULL dataset, not `filtered`.** The Projects
  template derives `selectedQuotes` from `filtered`, so if the user selects rows then
  changes filter/search/sort, the bulk count/dialog and the operation silently act on
  only the still-visible subset. Quotes fixes this by deriving `selectedSales` from
  the full `sales` list keyed by `selectedIds`. Prefer that approach.
- **The per-row dropdown is a measure-anchored `Modal` (not the shared OverlayMenu).**
  It must flip ABOVE the trigger and clamp to the viewport, or bottom-row menu items
  render off-screen (especially on mobile). Quotes' `openMenu` does this; the Projects
  template does NOT (latent bug there).
- Lock gating must be enforced in BOTH the single-row action and bulk delete — locked
  sales should be skipped, not deleted.

## Quotes header parity (matches Projects)
- CTA is **"New Quote"** (Plus icon) → `router.push('/')` (the index/New Quote page),
  the sales-side analog of Projects' "Start Project". No CSV-export CTA.
- KPI/stats bar shows **status COUNT tiles** (Needs Review, Quoted, Invoice Sent, Paid,
  Expired) — not financial aggregates — to mirror the Projects KPI style.
- Status pills render the full `STATUS_PILLS` list always (not just nonzero) like Projects.
- Search matches client/org (`personOrganization`), project, quote# (`invoiceNumber`/
  `projectNumber`), AND line-item `serviceStyle`.

## "Approved" is NOT a real status
There is no `approved` member in `QuoteStatus` (`types/quote.ts`): members are draft,
needs_review, quoting, quoted, invoice_sent, paid, active, production_started, completed,
expired. Specs sometimes list "Approved" — do NOT add it ad hoc for one page; it would
need type + STATUS_CONFIG + STATUS_HIERARCHY + getEffectiveStatus + DB changes.
**Why:** scoped UI work should use the existing taxonomy, not invent statuses.
