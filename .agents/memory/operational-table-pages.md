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

## Responsive standard for these tables (operational consistency)
The point of these pages is operational workflow, so EVERY desktop column's meaning
must survive at smaller widths — never silently drop required fields.
- **Required fields** (must stay visible/identifiable on every breakpoint): Status,
  Order Date, Due Date, Client, Project, Quote#/Invoice#, Service, PCS, Revenue/Total,
  Profit/Markup. (Applicator(s) is the one NON-required projects col — OK to drop on tablet.)
- **Desktop (>=1024):** full table, unchanged. Keep it byte-equivalent — gate every
  responsive tweak behind `isTablet`/`compact` so the desktop branch renders identically.
- **Tablet (768–1023): COMPACT FULL TABLE** — show ALL required columns, just shrunk
  (smaller fixed-col widths + tighter row/header padding; keep Client/Project/Service as
  `flex` so they absorb leftover space). NO column-hiding, NO horizontal scroll. Pattern:
  `style={[styles.colX, compact && styles.colXC]}` with `*C` width/font overrides; in the
  compact actions cell, drop text buttons (icon-only Track + menu chevron) to save width.
  Watch the fixed-col budget: at ~768 the sidebar is collapsed (~64px) so content ≈ ~684px;
  keep summed fixed widths well under that or flex cols get crushed.
- **Mobile (<768): labeled key-value cards** (NOT a sort strip / unlabeled card). Canonical
  card = `components/ProjectCard.tsx`: left big queue `#N`, header (recordNum + STATUS badge
  + menu), 3 two-col labeled rows [PROJECT|CLIENT][ORDER DATE|DUE DATE][SERVICE|PCS], footer
  [TOTAL/REVENUE|PROFIT]. Quotes mirrors these exact styles in `sales.tsx`. Keep menu/track/
  lock/selection behavior intact.
**Why:** user explicitly rejected hiding columns on tablet; chose "compact full table"; and
wanted mobile cards labeled so a field is never ambiguous. Verify via code/LSP — the
screenshot tool can't reach these breakpoints (see screenshot-load-gate.md).

## "Approved" is NOT a real status
There is no `approved` member in `QuoteStatus` (`types/quote.ts`): members are draft,
needs_review, quoting, quoted, invoice_sent, paid, active, production_started, completed,
expired. Specs sometimes list "Approved" — do NOT add it ad hoc for one page; it would
need type + STATUS_CONFIG + STATUS_HIERARCHY + getEffectiveStatus + DB changes.
**Why:** scoped UI work should use the existing taxonomy, not invent statuses.
