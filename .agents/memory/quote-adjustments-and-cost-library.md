---
name: Quote adjustments tables & cost library
description: How Production Costs / Other Charges adjustment tables and the shared cost library behave in the Quote Builder + Settings.
---

# Quote adjustments (Production Costs / Other Charges) & cost library

## Adjustment tables FEED the pricing engine
The per-line-item PRODUCTION COSTS and OTHER CHARGES tables
(`components/QuoteAdjustmentsTable.tsx`) are summed into the engine:
`calculateLineItemSubtotal` sets `productionCostTotal = Σ item.productionCosts[]`
and `otherCostTotal = Σ item.otherCharges[]` (each row via `calcAdjustmentAmount`),
which flows up through `calculateQuote` → CalculationDisplay (Quote Summary) →
Grand Total. Legacy quotes with empty arrays fall back to the flat scalars
`item.serviceFeeEach` / `item.otherCostEach`.

**Why:** the flat scalars are the legacy input; the itemized arrays are the new
canonical source. Array-present supersedes scalar (mirrors the products[]→flat
pattern) so old data still prices and downstream surfaces reading the scalars don't
break. calc types: `flat` (rate), `hourly`/`per_unit` (rate×qty), `percentage`
(rate% of base).

**Percentage base = adjustmentBase, NOT the full subtotal.**
`adjustmentBase = productCostTotal + serviceCostTotal + markupTotal` (line subtotal
BEFORE Production/Other adjustments). It is a real field on `LineItemCalculations`;
LineItemCard passes it as the tables' `baseAmount` so table/modal "Calculated" ==
engine contribution.
**Why:** using the real subtotal as the % base is circular (subtotal → % adj →
subtotal). adjustmentBase breaks the cycle while staying close to "% of subtotal".

**Discovered-but-untouched:** the manual PRODUCTION (`serviceFeeEach`) / OTHER
(`otherCostEach`) CurrencyInputs still render in the LINE ITEM COSTS panel; once a
table has rows they are ignored by the engine (fallback only). Hiding/removing them
is a separate UI task.

**calc lives in the engine now:** `calcAdjustmentAmount` is defined in
`utils/quoteCalculations.ts` and re-exported from `utils/adjustments.ts` (one-way
dep: adjustments → quoteCalculations) to avoid a util↔util circular import.

## Cost library is an in-session store, not persisted
The Production Library / Other Charges Library live in `lib/costLibraryStore.ts`
(module-level state via `useSyncExternalStore`), shared between Settings → Cost
Configuration (edits) and the Quote Builder "Add Production" / "Add Other Charge"
dialogs (read enabled items). It is seeded with defaults and is browser-session
only — there is NO API/DB persistence yet.

**Why:** the libraries were built ahead of a backend. Seeds make the dialogs usable
out of the box.

**How to apply:** persisting to DB/API is a known future task — reloading the page
resets the libraries to seeds. Don't treat that reset as a bug.

## Add dialog is a full RN Modal, not OverlayMenu
`components/AddAdjustmentModal.tsx` is a two-step (pick library item → configure →
preview → save) `Modal`. The Overlay Law (`OverlayMenu`) applies to dropdowns/
popovers; full-screen dialogs correctly use RN `Modal`. Calc helpers live in
`utils/adjustments.ts` specifically to avoid a table↔modal circular import.
