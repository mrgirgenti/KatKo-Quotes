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
- **Header checkbox + bulk COUNT must use the VISIBLE intersection, not raw
  `selectedIds.size`.** A persistent `selectedIds: Set` is never auto-pruned, so if you
  drive the select-all header's checked/indeterminate state (or the "N selected" label)
  off `selectedIds.size` vs `filtered.length`, changing filter/search/tab leaves a stale
  checked/indeterminate header and a count that disagrees with what Delete actually
  affects. Compute `visibleSelectedCount = filtered.filter(p=>selectedIds.has(p.id))` and
  derive `selectionMode`, `allSelected`, and the bulk count from THAT. Contacts
  (`ContactsDirectory.tsx`) does this; Organizations (`clients.tsx`) still uses raw
  `selectedIds.size` (latent staleness bug there — fix if touched).
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

## Responsive standard for these tables (operational consistency) — CURRENT
These four list pages — Projects (`projects.tsx`), Quotes (`sales.tsx`), Organizations
(`clients.tsx`), Contacts (`components/ContactsDirectory.tsx`) — must look like ONE
responsive table, not a separate mobile UI. On EVERY breakpoint render the SAME full
desktop table (same columns, same order, same labels, sortable headers) inside a
HORIZONTAL ScrollView so mobile/tablet users scroll left/right to reach every column.
NO cards, NO per-breakpoint column hiding, NO compacting. Drop the mobile "Sort:" chip bar
(headers sort). Keep search, status-filter pills, selection + bulk action bar, and row
menus/actions working on all breakpoints.

Canonical pattern (all four use it):
```
<ScrollView style={{flex:1}}>                                   // vertical
  <ScrollView horizontal contentContainerStyle={{flexGrow:1}}>   // horizontal
    <View style={{ minWidth: <px>, flexGrow: 1 }}>               // PX min, NOT '100%'
      {tableHeader}{rows.map(... + divider)}
    </View>
  </ScrollView>
</ScrollView>
```
Pixel `minWidth` (Projects 1320, Quotes 1180, Orgs 1200, Contacts 1156 — was 1120 before
the checkbox column) forces horizontal
scroll on phones; `flexGrow:1` (on BOTH the h-scroll contentContainer AND the inner View)
lets it stretch to fill wide desktops so desktop stays effectively identical. `minWidth:'100%'`
is WRONG here — it collapses to viewport on mobile and never scrolls. Keep Client/Project/
Service columns as `flex` (they distribute within the px width). Lists render via `.map`
(not FlatList) so a vertical FlatList isn't nested in the h-ScrollView.

**Why:** user explicitly REVERSED the earlier "tablet=compact table / mobile=labeled cards"
plan — production staff need true desktop-table parity on tablet/mobile, scroll over cards.
**Supersedes** the prior compact-table + ProjectCard-mobile approach (now removed; ProjectCard,
OrgCard, PersonCard, the SaleRow mobile branch, mobileListData, and all `*C` compact styles
were deleted). Verify via code/LSP — the screenshot tool can't reach these breakpoints
(see screenshot-load-gate.md).

## "Approved" is NOT a real status
There is no `approved` member in `QuoteStatus` (`types/quote.ts`): members are draft,
needs_review, quoting, quoted, invoice_sent, paid, active, production_started, completed,
expired. Specs sometimes list "Approved" — do NOT add it ad hoc for one page; it would
need type + STATUS_CONFIG + STATUS_HIERARCHY + getEffectiveStatus + DB changes.
**Why:** scoped UI work should use the existing taxonomy, not invent statuses.
