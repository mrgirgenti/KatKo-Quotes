import type { LineItem, GarmentVariant, SizeQuantities, ServiceStyle } from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';
import { EMPTY_SIZES } from '@/types/quote';
import { getConfiguredProduct, syncLegacyFields, getLineItemProducts } from '@/utils/configuredProduct';
import { getTotalQuantity } from '@/utils/quoteCalculations';

/**
 * lineItemProducts — THE single shared adapter for the multi-product Line Item
 * model. A Line Item ("Design") may hold multiple Products (garments) that share
 * the same artwork/mockup, locations, calculator, notes, services, fees and
 * markup. Only the products + their sizes differ.
 *
 * ─── BUSINESS RULE ─────────────────────────────────────────────────────────────
 * Multi-product Line Items are intended for designs that share the SAME production
 * run: same artwork, same service style, same print locations, same calculator,
 * same notes, same setup. Typical cases: one shirt design across multiple colors,
 * or closely related garment variants in the same run. If a product needs
 * materially different pricing, notes, setup, or purchasing treatment, it must be
 * a separate Line Item.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * The pricing engine (utils/quoteCalculations.ts) is NEVER changed: it only ever
 * reads the flat aggregate `item.sizes` and the flat per-each fields
 * (productCostEach/serviceCostEach/serviceFeeEach/markupEach). On every edit,
 * `syncLineItemFromProducts` recomputes:
 *   - aggregate `sizes`      = sum of every product's every color/size
 *   - blended `productCostEach` = Σ(productCost × productQty) ÷ totalQty
 * Because blended × totalQty equals the true product-cost total, all existing
 * per-line and quote-level calculations produce identical numbers.
 *
 * ⚠ BLENDED COST IS A COMPATIBILITY ADAPTER — NOT BUSINESS TRUTH ─────────────
 * `LineItem.productCostEach` (written by `syncLineItemFromProducts`) is a derived,
 * transient shim that keeps the legacy single-cost pricing engine producing the
 * correct order total. It MUST NOT be used as the authoritative cost for:
 *   – reports, profitability, or margin analysis
 *   – purchasing, vendor ordering, or inventory
 *   – project documents (cost columns)
 *   – accounting or finance exports
 *   – any future product-level pricing feature
 * The REAL per-product cost lives in each `ConfiguredProduct.productCostEach`.
 * When deeper pricing work is intentionally scoped, read from there directly.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Service cost, service fee and markup remain at the Line Item level (shared
 * across the design) and are mirrored onto each product only as a snapshot.
 */

const sizeKeys = (): (keyof SizeQuantities)[] => [
  'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl', 'flat',
];

function addSizes(acc: SizeQuantities, s: SizeQuantities | undefined): SizeQuantities {
  for (const k of sizeKeys()) acc[k] = (acc[k] ?? 0) + (s?.[k] ?? 0);
  return acc;
}

/** Sum the sizes across all color variants of ONE product. */
export function getConfiguredProductSizes(cp: ConfiguredProduct): SizeQuantities {
  return (cp.colorVariants ?? []).reduce<SizeQuantities>(
    (acc, cv) => addSizes(acc, cv.sizes),
    { ...EMPTY_SIZES },
  );
}

/** Sum the sizes across ALL products in a design. */
export function aggregateSizesAcrossProducts(products: ConfiguredProduct[]): SizeQuantities {
  return products.reduce<SizeQuantities>(
    (acc, cp) => addSizes(acc, getConfiguredProductSizes(cp)),
    { ...EMPTY_SIZES },
  );
}

/** Total piece count of ONE product, respecting Promotional (flat) counting. */
export function getConfiguredProductQuantity(
  cp: ConfiguredProduct,
  serviceStyle: ServiceStyle | string | undefined,
): number {
  const isPromo = serviceStyle === 'Promotional';
  return getTotalQuantity(getConfiguredProductSizes(cp), isPromo);
}

/**
 * Blended per-each product cost across all products, weighted by quantity:
 *   Σ(productCost × productQty) ÷ Σ(productQty)
 * blended × totalQty == true product-cost total (cent-exact). When there are no
 * quantities yet, falls back to the first product's cost so the COSTS panel
 * still shows a sensible number.
 *
 * ⚠ COMPAT ADAPTER ONLY — See module-level warning above. This value is written
 * to `LineItem.productCostEach` solely to feed the legacy pricing engine. It is
 * NOT a substitute for reading each `ConfiguredProduct.productCostEach` directly
 * in any context that requires per-product accuracy (purchasing, profitability,
 * documents, etc.).
 */
export function blendProductCostEach(
  products: ConfiguredProduct[],
  serviceStyle: ServiceStyle | string | undefined,
): number {
  let costTotal = 0;
  let qtyTotal = 0;
  for (const cp of products) {
    const qty = getConfiguredProductQuantity(cp, serviceStyle);
    costTotal += (cp.productCostEach ?? 0) * qty;
    qtyTotal += qty;
  }
  if (qtyTotal > 0) return costTotal / qtyTotal;
  return products[0]?.productCostEach ?? 0;
}

// getLineItemProducts is the SINGLE canonical reader — defined once in
// utils/configuredProduct.ts and re-exported here so existing importers of
// '@/utils/lineItemProducts' keep working unchanged.
export { getLineItemProducts };

// ─── PRICING CONSISTENCY INVARIANT ──────────────────────────────────────────
//
// For multi-product Line Items, serviceCostEach, serviceFeeEach, and markupEach
// are LINE ITEM-LEVEL values shared across every product in the design:
//
//   ✅  Products MAY have unique productCostEach  (garment cost varies by style)
//   ❌  Products MUST NOT have divergent serviceCostEach — owned by the Line Item
//   ❌  Products MUST NOT have divergent serviceFeeEach  — owned by the Line Item
//   ❌  Products MUST NOT have divergent markupEach      — owned by the Line Item
//
// Per-product service/markup pricing is intentionally unsupported until the
// pricing engine (utils/quoteCalculations.ts) is refactored to read those
// values per-product. Until then, per-product divergence would produce silently
// wrong quote totals: the engine reads serviceCostEach/serviceFeeEach/markupEach
// from the LINE ITEM, not from individual ConfiguredProducts.
//
// If you need per-product service or markup pricing:
//   1. Refactor the pricing engine to read per-product values.
//   2. Update or remove this guard accordingly.
//   3. Add regression tests for the new pricing path.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that no product in a multi-product Line Item carries a
 * serviceCostEach, serviceFeeEach, or markupEach that diverges from the
 * parent Line Item values.
 *
 * Throws with a descriptive message identifying the offending product and field
 * so the error is actionable. Single-product items are always considered valid
 * (normalization handles the snapshot; no cross-product totaling is at risk).
 *
 * Call this BEFORE the blending/normalization step in syncLineItemFromProducts.
 */
export function validateProductPricingConsistency(
  item: LineItem,
  products: ConfiguredProduct[],
): void {
  if (products.length <= 1) return;

  const itemServiceCost = item.serviceCostEach ?? 0;
  const itemServiceFee  = item.serviceFeeEach  ?? 0;
  const itemMarkup      = item.markupEach      ?? 0;

  for (const cp of products) {
    const label = cp.productLabel ?? cp.styleNumber ?? cp.styleName ?? 'unknown';

    if (cp.serviceCostEach !== itemServiceCost) {
      throw new Error(
        `Multi-product line items do not support per-product serviceCostEach, ` +
        `serviceFeeEach, or markupEach. These values must remain shared at the ` +
        `Line Item level. Product "${label}" has serviceCostEach=${cp.serviceCostEach} ` +
        `but the Line Item is ${itemServiceCost}.`,
      );
    }
    if (cp.serviceFeeEach !== itemServiceFee) {
      throw new Error(
        `Multi-product line items do not support per-product serviceCostEach, ` +
        `serviceFeeEach, or markupEach. These values must remain shared at the ` +
        `Line Item level. Product "${label}" has serviceFeeEach=${cp.serviceFeeEach} ` +
        `but the Line Item is ${itemServiceFee}.`,
      );
    }
    if (cp.markupEach !== itemMarkup) {
      throw new Error(
        `Multi-product line items do not support per-product serviceCostEach, ` +
        `serviceFeeEach, or markupEach. These values must remain shared at the ` +
        `Line Item level. Product "${label}" has markupEach=${cp.markupEach} ` +
        `but the Line Item is ${itemMarkup}.`,
      );
    }
  }
}

function productLabelOf(cp: ConfiguredProduct): string {
  if (cp.productLabel) return cp.productLabel;
  return `${cp.styleNumber ?? ''} — ${cp.styleName ?? ''}`.replace(/^ — | — $/g, '').trim();
}

/**
 * Sync ALL derived Line Item fields from a product array. This is the ONLY place
 * the flat aggregate `sizes`, blended `productCostEach`, legacy `garmentVariants`
 * / `product` / `productColor` / `location*`, the singular `configuredProduct`,
 * and the canonical `products` array are written together. Every mutation in the
 * editor, portal and API write paths funnels through here so nothing drifts.
 *
 * Design-level fields (decorationMethod, printLocations, locationDetails,
 * mockupUri) and the shared service/fee/markup pricing are mirrored onto every
 * product as a snapshot — they remain Line-Item-level for the math.
 */
export function syncLineItemFromProducts(item: LineItem, products: ConfiguredProduct[]): LineItem {
  const list = products.length > 0 ? products : [getConfiguredProduct(item)];

  // Guard against per-product service/fee/markup divergence before any blending.
  validateProductPricingConsistency(item, list);

  const primary = list[0];

  // Design-level fields are OWNED BY THE LINE ITEM — that is where the editor's
  // design inputs (service style, print locations, notes, mockup, vendor/source)
  // write. They are mirrored onto every product as a snapshot so downstream read
  // surfaces (portal, documents) stay consistent, but the LINE ITEM always wins.
  // Sourcing these from the line item (never from products[0]) is what prevents a
  // later per-product edit from re-syncing a stale snapshot back over a design
  // change the user just made.
  const designDecoration = (item.serviceStyle as string | undefined) ?? primary.decorationMethod;
  const designLocations = [item.location1, item.location2, item.location3, item.location4]
    .filter((l): l is string => typeof l === 'string' && l.length > 0);
  const designLocationDetails = item.locationDetails ?? primary.locationDetails;
  const designMockup = item.mockupUri; // no fallback: lets an explicit "remove" clear it
  const designVendor = item.apparelProvider ?? primary.vendorName;

  const serviceCostEach = item.serviceCostEach ?? 0;
  const serviceFeeEach = item.serviceFeeEach ?? 0;
  const markupEach = item.markupEach ?? 0;

  // Mirror design-level + shared pricing onto every product (snapshot only).
  const normalizedProducts: ConfiguredProduct[] = list.map((cp) => ({
    ...cp,
    decorationMethod: designDecoration,
    printLocations: designLocations,
    locationDetails: designLocationDetails,
    mockupUri: designMockup,
    vendorName: designVendor,
    serviceCostEach,
    serviceFeeEach,
    markupEach,
  }));

  // Aggregate every size dimension (including `flat`) across all products. The
  // pricing engine's getTotalQuantity counts garment sizes OR flat depending on
  // serviceStyle, so a Promotional design's flat count rides in here too.
  const aggregateSizes = aggregateSizesAcrossProducts(normalizedProducts);
  const blendedProductCost = blendProductCostEach(normalizedProducts, item.serviceStyle);

  // Populate legacy fields from the PRIMARY product (product label, color, vendor,
  // locations, decoration method, configuredProduct, mockup) ...
  const base = syncLegacyFields(item, normalizedProducts[0]);

  // ... then project EVERY product's color variants into garmentVariants so the
  // existing read surfaces (quote detail, production, PDF) that iterate
  // garmentVariants automatically show all products without code changes.
  const garmentVariants: GarmentVariant[] = normalizedProducts.flatMap((cp) =>
    (cp.colorVariants ?? []).map((cv) => ({
      product: productLabelOf(cp),
      color: cv.color,
      sizes: cv.sizes,
      productId: cp.productId,
      styleNumber: cp.styleNumber,
      brand: cp.brand,
      productName: cp.styleName,
      productSource: cp.productSource,
      category: cp.category,
    })),
  );

  const totalColorRuns = normalizedProducts.reduce(
    (n, cp) => n + (cp.colorVariants?.length ?? 0),
    0,
  );

  return {
    ...base,
    products: normalizedProducts,
    configuredProduct: normalizedProducts[0],
    sizes: aggregateSizes,
    garmentVariants,
    // PRIMARY product label drives the collapsed-card "primary product".
    product: productLabelOf(normalizedProducts[0]) || base.product,
    productColor:
      totalColorRuns > 1
        ? 'Multiple'
        : (normalizedProducts[0].colorVariants[0]?.color ?? base.productColor),
    // COMPAT ADAPTER: blended cost keeps the legacy engine cent-exact.
    // NOT business truth — read ConfiguredProduct.productCostEach per product for
    // purchasing, profitability, documents, and any product-level pricing work.
    productCostEach: blendedProductCost,
    serviceCostEach,
    serviceFeeEach,
    markupEach,
    mockupUri: designMockup,
  };
}

/**
 * Apply a DESIGN-LEVEL patch (service style, locations, locationDetails, mockup,
 * vendor/source, applicator, and the shared service/fee/markup pricing) to the
 * Line Item, then re-mirror it across every product. This is the SINGLE funnel
 * for design-level edits: it guarantees products[] never drift out of sync with
 * the line item, and it preserves the aggregate sizes + blended cost untouched
 * (because the products themselves are unchanged).
 */
export function updateDesignFields(item: LineItem, patch: Partial<LineItem>): LineItem {
  const merged: LineItem = { ...item, ...patch };
  return syncLineItemFromProducts(merged, getLineItemProducts(merged));
}

/** Create a fresh, empty product that inherits the design-level context. */
export function emptyConfiguredProduct(item: LineItem): ConfiguredProduct {
  const primary = getLineItemProducts(item)[0];
  return {
    productSource: 'manual',
    decorationMethod: (item.serviceStyle as string) ?? primary?.decorationMethod ?? 'Screen Printing',
    colorVariants: [{ color: '', sizes: { ...EMPTY_SIZES } }],
    printLocations: primary?.printLocations ?? [],
    locationDetails: primary?.locationDetails,
    mockupUri: item.mockupUri ?? primary?.mockupUri,
    productCostEach: 0,
    serviceCostEach: item.serviceCostEach ?? 0,
    serviceFeeEach: item.serviceFeeEach ?? 0,
    markupEach: item.markupEach ?? 0,
  };
}

/** Replace the product at `index` and re-sync the Line Item. */
export function updateProductAt(item: LineItem, index: number, cp: ConfiguredProduct): LineItem {
  const products = getLineItemProducts(item).map((p, i) => (i === index ? cp : p));
  return syncLineItemFromProducts(item, products);
}

/** Append a new product (optionally from a template) under the SAME Line Item. */
export function addProduct(item: LineItem, template?: ConfiguredProduct): LineItem {
  const products = [...getLineItemProducts(item), template ?? emptyConfiguredProduct(item)];
  return syncLineItemFromProducts(item, products);
}

/** Remove the product at `index`. Always keeps at least one product. */
export function removeProductAt(item: LineItem, index: number): LineItem {
  const current = getLineItemProducts(item);
  if (current.length <= 1) return item;
  const products = current.filter((_, i) => i !== index);
  return syncLineItemFromProducts(item, products);
}

/** Duplicate the product at `index`, inserting the copy right after it. */
export function duplicateProductAt(item: LineItem, index: number): LineItem {
  const current = getLineItemProducts(item);
  const source = current[index];
  if (!source) return item;
  const copy: ConfiguredProduct = {
    ...source,
    colorVariants: (source.colorVariants ?? []).map((cv) => ({
      ...cv,
      sizes: { ...cv.sizes },
    })),
  };
  const products = [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
  return syncLineItemFromProducts(item, products);
}

/**
 * Set a uniform garment cost on EVERY product (used by the LINE ITEM COSTS
 * "Product" override field). For a single-product Line Item this is exactly the
 * legacy behaviour of editing `productCostEach` directly.
 */
export function setUniformProductCost(item: LineItem, cost: number): LineItem {
  const products = getLineItemProducts(item).map((p) => ({ ...p, productCostEach: cost }));
  return syncLineItemFromProducts(item, products);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-cost / markup divergence guard
//
// CONTEXT: serviceCostEach, serviceFeeEach, and markupEach are DESIGN-LEVEL
// fields owned by the Line Item. They are mirrored onto each ConfiguredProduct
// only as a read snapshot. `syncLineItemFromProducts` always overwrites the
// product-level copies with the Line Item values — so the Line Item wins and
// totals stay correct.
//
// The danger arises if a future editor feature writes per-product service costs
// or markups BEFORE calling syncLineItemFromProducts, without first updating
// the Line Item level fields. In that scenario the divergence is silently
// overwritten and the editor state the user saw never makes it into the total.
//
// These utilities make the invariant testable and detectable:
//   - checkServiceCostDivergence  — returns all diverging products + fields
//   - assertNoServiceCostDivergence — throws if any divergence is found (use in
//     editor mutation code paths to catch the mismatch early)
//   - warnOnServiceCostDivergence  — console.warn wrapper used inside
//     syncLineItemFromProducts during development
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_COST_FIELDS = ['serviceCostEach', 'serviceFeeEach', 'markupEach'] as const;
type ServiceCostField = (typeof SERVICE_COST_FIELDS)[number];

/** One detected divergence between a product's snapshot and the Line Item level. */
export interface ServiceCostDivergence {
  /** Zero-based index in the products array. */
  productIndex: number;
  /** Human-readable label for the diverging product. */
  productLabel: string;
  /** Which field diverges. */
  field: ServiceCostField;
  /** The authoritative value from the Line Item. */
  lineItemValue: number;
  /** The stale/incorrect value stored on the product. */
  productValue: number;
}

/**
 * Check whether any product carries service-cost / markup values that differ
 * from the Line Item level fields.
 *
 * Returns an empty array when everything is consistent (the normal state after
 * any call to `syncLineItemFromProducts`). Returns one entry per (product ×
 * field) mismatch when stale snapshots are detected.
 *
 * The LINE ITEM always wins: any diverging product value will be overwritten
 * by the next call to `syncLineItemFromProducts`. This utility surfaces the
 * divergence so calling code can decide whether to warn, throw, or migrate.
 */
export function checkServiceCostDivergence(
  item: Pick<LineItem, 'serviceCostEach' | 'serviceFeeEach' | 'markupEach'>,
  products: ConfiguredProduct[],
): ServiceCostDivergence[] {
  const divergences: ServiceCostDivergence[] = [];
  const lineItemValues: Record<ServiceCostField, number> = {
    serviceCostEach: item.serviceCostEach ?? 0,
    serviceFeeEach: item.serviceFeeEach ?? 0,
    markupEach: item.markupEach ?? 0,
  };

  for (let i = 0; i < products.length; i++) {
    const cp = products[i];
    const derived = (cp.productLabel
      ?? `${cp.styleNumber ?? ''} — ${cp.styleName ?? ''}`.replace(/^ — | — $/g, '').trim());
    const label = derived || `product[${i}]`;
    for (const field of SERVICE_COST_FIELDS) {
      const lineItemValue = lineItemValues[field];
      const productValue = cp[field] ?? 0;
      if (productValue !== lineItemValue) {
        divergences.push({ productIndex: i, productLabel: label, field, lineItemValue, productValue });
      }
    }
  }
  return divergences;
}

/**
 * Throw an error if any product carries service-cost / markup values that
 * diverge from the Line Item level. Use this in editor mutation paths where
 * you want to catch the mismatch at the source rather than having it silently
 * overwritten by `syncLineItemFromProducts`.
 *
 * Always call `syncLineItemFromProducts` (or `updateDesignFields`) to resolve
 * the Line Item before asserting — the assert is a dev-time correctness check,
 * not a runtime gate on rendering.
 */
export function assertNoServiceCostDivergence(
  item: Pick<LineItem, 'serviceCostEach' | 'serviceFeeEach' | 'markupEach'>,
  products: ConfiguredProduct[],
): void {
  const divergences = checkServiceCostDivergence(item, products);
  if (divergences.length === 0) return;

  const summary = divergences
    .map(
      (d) =>
        `  • ${d.productLabel} [${d.field}]: product=${d.productValue} vs lineItem=${d.lineItemValue}`,
    )
    .join('\n');

  throw new Error(
    `[lineItemProducts] Service-cost / markup divergence detected between Line Item and products.\n` +
      `The Line Item always wins — call syncLineItemFromProducts before asserting.\n` +
      `Divergences:\n${summary}`,
  );
}

/** Internal: log a dev warning when syncLineItemFromProducts detects stale snapshots. */
function warnOnServiceCostDivergence(
  item: Pick<LineItem, 'serviceCostEach' | 'serviceFeeEach' | 'markupEach'>,
  products: ConfiguredProduct[],
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const divergences = checkServiceCostDivergence(item, products);
  if (divergences.length === 0) return;
  const summary = divergences
    .map(
      (d) =>
        `  • ${d.productLabel} [${d.field}]: product=${d.productValue} → overriding with lineItem=${d.lineItemValue}`,
    )
    .join('\n');
  console.warn(
    `[lineItemProducts] syncLineItemFromProducts: per-product service-cost / markup snapshot` +
      ` is stale and will be overwritten by Line Item values.\n${summary}\n` +
      `To fix: write service costs / markups to the Line Item, then call syncLineItemFromProducts.`,
  );
}

export interface LineItemProductsSummary {
  products: ConfiguredProduct[];
  productCount: number;
  /** Number of distinct color/size runs across all products. */
  colorRunCount: number;
  totalQuantity: number;
  aggregateSizes: SizeQuantities;
  /** Label of the primary (first) product. */
  primaryLabel: string;
  /** Primary product color, or "Multiple" when >1 color run exists. */
  primaryColor: string;
}

/** Read-only summary for collapsed cards, detail views and documents. */
export function summarizeLineItemProducts(item: LineItem): LineItemProductsSummary {
  const products = getLineItemProducts(item);
  const aggregateSizes = aggregateSizesAcrossProducts(products);
  const totalQuantity = getTotalQuantity(aggregateSizes, item.serviceStyle === 'Promotional');
  const colorRunCount = products.reduce((n, cp) => n + (cp.colorVariants?.length ?? 0), 0);
  const primary = products[0];
  return {
    products,
    productCount: products.length,
    colorRunCount,
    totalQuantity,
    aggregateSizes,
    primaryLabel: primary ? productLabelOf(primary) : (item.product || ''),
    primaryColor:
      colorRunCount > 1
        ? 'Multiple'
        : (primary?.colorVariants?.[0]?.color ?? item.productColor ?? ''),
  };
}
