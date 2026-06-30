---
name: Multi-product pricing rule
description: How productCostTotal is calculated for line items with multiple garments — exact sum, never blended average.
---

# Multi-Product Pricing Rule — NON-NEGOTIABLE

## The Rule
Line Item Product Cost = **Σ (product.productCostEach × product.qty)** for every product in the design.

There is no weighted average garment cost in this business model. A blended/weighted `productCostEach` must never be computed, stored, or displayed. It would produce inaccurate reporting, purchasing, profitability, and future inventory integrations.

Example:
- Adult Tee: 23 × $4.50 = $103.50
- Youth Tee: 12 × $3.20 = $38.40
- Women's Tee: 8 × $5.10 = $40.80
- **Product Cost = $182.70** (exact sum, not $4.25/pc × 43)

## Architecture

`LineItem.configuredProducts[]` (multi-product array) is the canonical pricing source.
`LineItem.configuredProduct` (singular) is legacy backward-compat for single-product items only.
`LineItem.productCostEach` has no meaningful value for multi-product designs — do not read it for calculations.

The pricing engine (`utils/quoteCalculations.ts`) resolves products via `getLineItemProducts(item)`:
1. `item.configuredProducts[]` if present and non-empty
2. `[item.configuredProduct]` if present (single-product legacy)
3. Legacy flat `item.sizes` + `item.productCostEach` (oldest compat)

Then: `productCostTotal = Σ(cp.productCostEach × getProductQty(cp, isPromotional))`

Service cost, service fee, and markup are LINE-ITEM level (shared across the design), never per-product.

`calculateLineItemTotals` now delegates to `calculateLineItemSubtotal` to avoid duplication.

`productCostRows?: ProductCostRow[]` in `LineItemCalculations` carries the per-product breakdown for the LINE ITEM COSTS display panel (only populated when ≥2 products).

## Why
User explicitly stated: "There should never be a calculated 'average garment cost.' That value does not exist in our business model."

## How to Apply
- Any code computing `item.productCostEach * qty` as if it were the line-item product cost is WRONG for multi-product items — use `calculateLineItemSubtotal(item).productCostTotal` instead.
- `syncMultiProductLineItem()` in `utils/configuredProduct.ts` is the correct write path for multi-product items; it never writes a blended `productCostEach`.
- `syncLegacyFields()` is single-product only.
- `QuoteCalculations.productCostEach` is a DISPLAY-ONLY summary average across the whole quote (total ÷ totalQty) — it's labeled "avg" and is never used as an input to further calculations.
