---
name: ConfiguredProduct architecture
description: How LineItem.configuredProduct is structured, built, and kept in sync; migration approach.
---

# ConfiguredProduct Architecture

## The rule
Every `LineItem` in `Project.lineItemsData` owns exactly ONE `configuredProduct: ConfiguredProduct` structured JSON object. It is an **additive, backward-compatible** field — all legacy top-level fields remain alongside it during the UI migration phase.

## Sources of truth
- **Type**: `types/configuredProduct.ts` — `ConfiguredProduct`, `ConfiguredColorVariant`, `ArtworkLayer`, `PrintLocationTemplate`
- **Type**: `types/quote.ts` — `LineItem.configuredProduct?: ConfiguredProduct` (optional for backward compat)
- **Utilities**: `utils/configuredProduct.ts` — `buildConfiguredProduct(item)`, `getConfiguredProduct(item)`, `syncLegacyFields(item, cp)`, `updateConfiguredProduct(cp, partial)`

## Build logic
`buildConfiguredProduct(item)` derives a ConfiguredProduct from the legacy LineItem fields:
- `garmentVariants[]` → `colorVariants[]` (one entry per color/size-run)
- `serviceStyle` → `decorationMethod`
- `location1-4` → `printLocations[]`
- `apparelProvider` → `vendorName`
- `mockupUri` passed through
- Pricing fields (`productCostEach`, `serviceCostEach`, `serviceFeeEach`, `markupEach`) passed through

## Migration
- One-time migration script: `scripts/backfill-configured-product.ts` — run with `bun scripts/backfill-configured-product.ts`
- Idempotent: skips items that already have `configuredProduct` set
- API endpoint also exists: `POST /api/projects/backfill-configured-product` (requires Clerk auth)
- Initial run: 22 items across 15 projects backfilled (Jun 27 2026)

## LineItemCard sync
`handleVariantsChange` in `components/LineItemCard.tsx` calls `buildConfiguredProduct(updatedItem)` and includes it in every `onChange` call when variants change. Full bidirectional sync (for serviceStyle, locations, etc.) will be implemented when the UI wizard is rebuilt.

**Why:** The `configuredProduct` must always reflect the current item state so downstream consumers (Mockup Designer, document renderer) can read a single structured object rather than reconstructing it from scattered fields.
