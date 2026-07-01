---
name: Multi-product line item architecture
description: A LineItem ("Design") can hold MULTIPLE products via products[]; how the lineItemProducts adapter keeps everything in sync and why.
---

# Multi-Product Line Item Architecture

## The rule
A `LineItem` (a "Design" in the Quote Builder) can hold MULTIPLE garments via
`LineItem.products?: ConfiguredProduct[]` (`types/quote.ts`, additive/optional).
All products in one design SHARE the design-level artwork/mockup, print locations,
service style, calculator, notes, services and pricing. Only the garment identity
(type/style/color) and per-garment size runs differ per product.

## Canonical reader lives in `utils/configuredProduct.ts`
There is EXACTLY ONE `getLineItemProducts(item)` (returns `item.products` if
nonempty, else `[getConfiguredProduct(item)]` — the lazy fallback for legacy rows).
It lives in `utils/configuredProduct.ts` (a types-only module, no util deps) and is
imported by BOTH the pricing engine (`quoteCalculations.ts`) and the adapter
(`lineItemProducts.ts`, which re-exports it so existing importers keep working).
**Why it lives there, not in lineItemProducts:** `lineItemProducts` imports
`getTotalQuantity` from `quoteCalculations`, so `quoteCalculations` CANNOT import
back from `lineItemProducts` (circular). The shared reader must sit below both.
Do NOT re-add a second local products-reader in any consumer — that is exactly how
the multi-product-undercount bug happened (see phantom-field trap below).

## No `LineItem.configuredProducts` field — it's `products` (phantom-field trap)
The canonical multi-product array is `LineItem.products`. `configuredProducts`
(plural) does NOT exist on the type — it is a recurring typo. Because it type-errors
only as "property does not exist" (easy to dismiss as baseline noise), a reader that
checks `item.configuredProducts` silently falls through to the single primary
product, so multi-product designs UNDERCOUNT to one garment in totals. Any code
reading OR writing the products array MUST use `products`.

## The write funnel — `utils/lineItemProducts.ts`
`syncLineItemFromProducts(item, products)` is the single write path;
`aggregateSizesAcrossProducts` and `blendProductCostEach` also live here.

## syncLineItemFromProducts contract
- Design-level fields (serviceStyle, location*, locationDetails, mockupUri,
  serviceCostEach/serviceFeeEach/markupEach) are sourced FROM THE LINE ITEM, not
  products[0], and mirrored INTO each product. They are the shared source of truth.
- Writes back: `products`, aggregate `sizes`, flattened legacy `garmentVariants`
  (one per colorVariant across ALL products), `configuredProduct = products[0]`,
  legacy product/productColor/apparelProvider/location*, and a BLENDED
  `productCostEach = Σ(cost×qty)/totalQty` (0 when totalQty is 0).
- Per-product serviceCost/fee/markup are IGNORED for math; line-item-level values win.

**Why blended cost:** it is a display/compat shim (per-each average) for surfaces
that still read the flat `item.productCostEach`. The pricing engine
(`utils/quoteCalculations.ts`) itself sums per-product (`Σ cp.productCostEach ×
cpQty`) via the canonical reader, so it does NOT depend on the blend for
multi-product totals. Blending is cent-exact equal to that sum. NOTE: the engine is
NOT frozen — it is correct to edit it to read the canonical `products` array; the
old "never touch it" belief is what produced the duplicate buggy reader.

## No DB migration
No schema change. products[] is written lazily on the next save; old rows load via
the `getLineItemProducts` fallback. The whole compat layer (configuredProduct,
garmentVariants, legacy top-level fields) stays LOAD-BEARING — read surfaces
(`app/quote/[id].tsx`, `app/quote/production/[id].tsx`) and documents
(`utils/projectDocument.ts`) still iterate the flattened `garmentVariants`, which
`syncLineItemFromProducts` regenerates from ALL products automatically.

## Promotional stays single flat-qty mode
Promotional service style is deliberately NOT multi-product — it keeps the original
single flat-quantity behavior. Documented deliberate decision (architect-approved).

## Portal (Client Hub) variant→product grouping
The Client Hub submit form (`SubmitView` in `app/portal/[orgId].tsx`) is
variant-based: each "Add Another Product / Color" row is a `garmentVariant`, and it
already hides ALL pricing (zeros every cost field). It does NOT send products[].
`app/api/portal/submit+api.ts` → `portalVariantsToProducts()` reconstructs the
canonical products[] by GROUPING garmentVariants by product identity
(`productId`, else lowercased product label): same-garment rows collapse into ONE
product with multiple colorVariants; distinct garments stay separate products. This
preserves per-garment identity instead of collapsing all rows under the primary's
style/brand. Pricing is always forced to zero server-side; per-product blank COGS is
resolved from the catalog as an internal reference only (stripped from customer DTOs).

## Documents
`utils/projectDocument.ts` → `buildProductLabel(li)` iterates `getLineItemProducts`
and joins each "{label} - {colors}" with " · " for the customer-facing Product line.
Reads only labels/colors — never a cost field. The doc model's `product` stays a
plain string, so `projectDocumentHtml.ts` / `pdfGenerator` need no change.
