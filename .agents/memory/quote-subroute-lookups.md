---
name: Quote sub-route lookups & status model
description: Pitfalls in project-detail action routing (Production Mode, Track Costs) and the QuoteStatus value set.
---

## QuoteStatus has NO 'sale' value
Valid statuses: draft | needs_review | quoting | quoted | invoice_sent | paid | active | production_started | completed | expired.
**Why:** `sales-tracking.tsx` guarded on `quote.status !== 'sale'`, which is always true, so Track Costs always showed "Sale not found".
**How to apply:** Never gate a screen on a `'sale'` status. The Track Costs / Cost Tracking page (`sales-tracking.tsx`) should load for any found project; guard on `!quote` (+ a loading state), not on status.

## Open Production vs Start Production are distinct actions
- "Start Production" (paid status) → mutate paid→production_started THEN navigate (`handleStartProduction`).
- "Production Mode" (production_started/active/completed) → navigation-only to `/quote/production/{id}`; must NOT call the start-production mutation.
**Why:** Reusing the mutating handler for "Production Mode" fired a bogus "Payment Required" alert on `completed` projects (its guard only allows paid/active/production_started) and could revert `active`→`production_started`.

## Sub-routes lack the detail page's directQuote fallback
`app/quote/[id].tsx` falls back to a direct `/api/projects/{id}` fetch (`directQuote`) so it can render projects not present in the context arrays. `sales-tracking.tsx` and `production/[id].tsx` only look in context (`quotes`/`sales`/`projects`) — add a loading guard (ActivityIndicator while `isLoading`) before any "not found", and consider a direct fetch if non-admin user filtering ever hides a project that the detail page still shows.

## Cost/calculation fields can be null on real records
`quote.calculations.*` and saved cost fields (`productCostEach`, sizes, etc.) are often null/undefined on older or completed projects. `quote?.calculations.onlineFee.toFixed(2)` crashes because `?.` only guards `quote`, not the nested object/field.
**How to apply:** When rendering money/cost on these screens, use `(quote?.calculations?.X ?? 0).toFixed(2)`, coerce per-each/size values with `?? 0` (and `Number(qty) || 0` in quantity reducers), and remember `formatCurrency`/`?? 0` does NOT catch `NaN` (only null/undefined) — keep arithmetic operands non-NaN at the source.
