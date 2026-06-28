---
name: Fee constants and canonical calculation utilities
description: Single source of truth for fee rates (constants/fees.ts) and canonical qty/subtotal functions; never inline these.
---

# Fee Constants and Canonical Calculation Utilities

## The rules

### Fee rates
`constants/fees.ts` is the SINGLE SOURCE OF TRUTH for all fee rates and their display labels.
- `ONLINE_FEE_PCT` (0.029), `ONLINE_FEE_FLAT` (0.60), `CARD_FEE_PCT` (0.0375), `SALES_TAX_PCT` (0.083)
- `ONLINE_FEE_LABEL` ("2.9% + $0.60"), `CARD_FEE_LABEL` ("3.75%"), `SALES_TAX_LABEL` ("8.3%")

**Never hardcode** these numeric literals or string equivalents anywhere else — `quoteCalculations.ts`, UI toggles, display labels, and all documents must import from `constants/fees.ts`.

### Canonical quantity / subtotal functions
`utils/quoteCalculations.ts` exports:
- `getTotalQuantity(sizes, isPromotional)` — canonical size sum; handles promotional (flat) vs non-promotional items
- `calculateLineItemSubtotal(item)` — full per-line-item calc: qty, costs, subtotal, perPiece

**Never** use `Object.values(item.sizes).reduce(...)` or local `sumSizes()`/`getItemQuantity()` functions anywhere in the codebase. Always call the canonical utilities.

**Why:** Promotional items store quantity in `sizes.flat`. Naive `Object.values().reduce()` includes flat for non-promotional items, which silently over-counts when a non-promo item has a stale non-zero flat value. Only `getTotalQuantity` handles this correctly.

**How to apply:** Any file computing qty or line-item subtotals must import from `utils/quoteCalculations`. Local helper functions that duplicate this logic are forbidden (they were systematically removed in the No Shortcuts pass).

## Coverage (as of the No Shortcuts pass)
Canonical functions now used in: `utils/csvExport.ts`, `utils/googleSheetsExport.ts`, `utils/pdfGenerator.ts`, `app/(tabs)/history.tsx`, `app/(tabs)/reports.tsx`, `app/quote/sales-tracking.tsx`, `app/api/projects/[id]+api.ts`, `app/api/projects/[id]/backfill+api.ts`, `app/api/portal/submit+api.ts`.

## ConfiguredProduct eagerly set on portal submission
`app/api/portal/submit+api.ts` now calls `buildConfiguredProduct` on each line item before storing in the DB (`enrichedLineItems`). The DB always receives canonical `configuredProduct` data — no more lazy fallback-only writes from the portal path.
