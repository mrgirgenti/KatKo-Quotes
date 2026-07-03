/**
 * Pricing Engine Regression Tests
 *
 * Protects the core pricing math against future regressions.
 * Run with: bun test
 *
 * Coverage:
 *   1. Legacy Compatibility         — single-product items produce identical totals via flat fields vs products[]
 *   2. Multi-Product Blended Math   — blended × totalQty is cent-exact vs Σ(productCost × productQty)
 *   3. Quantity Integrity           — flat/promotional qty preserved; no drift through sync
 *   4. Variant Grouping             — same product + multiple colors = one product/multiple colorVariants
 *   5. Adjustment Wiring            — PRODUCTION COSTS / OTHER CHARGES rows summed correctly
 *   6. Adjustment calcAdjustmentAmount — every calc type produces correct dollar value
 */

import { describe, test, expect } from 'bun:test';

import {
  calculateLineItemSubtotal,
  calculateLineItemTotals,
  getTotalQuantity,
  calcAdjustmentAmount,
  calculateQuote,
} from '../utils/quoteCalculations';
import {
  blendProductCostEach,
  syncLineItemFromProducts,
  summarizeLineItemProducts,
  getConfiguredProductQuantity,
  aggregateSizesAcrossProducts,
} from '../utils/lineItemProducts';
import {
  buildConfiguredProduct,
  getLineItemProducts,
} from '../utils/configuredProduct';
import type { LineItem, SizeQuantities, QuoteAdjustment } from '../types/quote';
import type { ConfiguredProduct, ConfiguredColorVariant } from '../types/configuredProduct';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ZERO_SIZES: SizeQuantities = {
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
};

function sizes(partial: Partial<SizeQuantities>): SizeQuantities {
  return { ...ZERO_SIZES, ...partial };
}

function makeColorVariant(color: string, s: Partial<SizeQuantities>): ConfiguredColorVariant {
  return { color, sizes: sizes(s) };
}

function makeProduct(
  opts: {
    productLabel?: string;
    productCostEach?: number;
    colorVariants?: ConfiguredColorVariant[];
    sizes?: Partial<SizeQuantities>;
    color?: string;
  } = {},
): ConfiguredProduct {
  const cv: ConfiguredColorVariant[] = opts.colorVariants ?? [
    makeColorVariant(opts.color ?? 'Black', opts.sizes ?? { m: 0 }),
  ];
  return {
    productSource: 'manual',
    decorationMethod: 'Screen Printing',
    colorVariants: cv,
    printLocations: ['Left Chest'],
    productLabel: opts.productLabel,
    productCostEach: opts.productCostEach ?? 0,
    serviceCostEach: 0,
    serviceFeeEach: 0,
    markupEach: 0,
  };
}

/** Minimal valid LineItem using only flat legacy fields (no products[]). */
function makeLegacyItem(opts: {
  productCostEach?: number;
  serviceCostEach?: number;
  serviceFeeEach?: number;
  markupEach?: number;
  sizes?: Partial<SizeQuantities>;
  serviceStyle?: LineItem['serviceStyle'];
  productionCosts?: QuoteAdjustment[];
  otherCharges?: QuoteAdjustment[];
}): LineItem {
  return {
    id: 'test-item',
    designName: 'Test Design',
    applicator: '',
    product: 'Adult Tee',
    productColor: 'Black',
    apparelProvider: '',
    serviceStyle: opts.serviceStyle ?? 'Screen Printing',
    location1: 'Left Chest',
    location2: '',
    locationDetails: '',
    sizes: sizes(opts.sizes ?? { m: 20 }),
    productCostEach: opts.productCostEach ?? 5.00,
    serviceCostEach: opts.serviceCostEach ?? 0,
    serviceFeeEach: opts.serviceFeeEach ?? 0,
    markupEach: opts.markupEach ?? 0,
    productionCosts: opts.productionCosts,
    otherCharges: opts.otherCharges,
  };
}

/** Build a LineItem from a products[] array via syncLineItemFromProducts. */
function makeItemFromProducts(
  products: ConfiguredProduct[],
  overrides: Partial<LineItem> = {},
): LineItem {
  const base = makeLegacyItem({});
  return syncLineItemFromProducts({ ...base, ...overrides }, products);
}

/** Round to cents (2 decimal places). */
function toCents(n: number): number {
  return Math.round(n * 100);
}

// ─── 1. Legacy Compatibility ─────────────────────────────────────────────────

describe('Legacy Compatibility', () => {
  test('flat-field item and products[] item produce identical productCostTotal', () => {
    const qty = 20;
    const cost = 5.00;

    // Legacy: flat fields only, no configuredProduct
    const legacyItem = makeLegacyItem({ productCostEach: cost, sizes: { m: qty } });

    // Modern: single product in products[]
    const product = makeProduct({ productCostEach: cost, sizes: { m: qty } });
    const modernItem = makeItemFromProducts([product]);

    const legacyCalcs = calculateLineItemSubtotal(legacyItem);
    const modernCalcs = calculateLineItemSubtotal(modernItem);

    expect(legacyCalcs.productCostTotal).toBe(qty * cost);
    expect(modernCalcs.productCostTotal).toBe(qty * cost);
    expect(legacyCalcs.subtotal).toBe(modernCalcs.subtotal);
  });

  test('buildConfiguredProduct preserves productCostEach from flat fields', () => {
    const item = makeLegacyItem({ productCostEach: 7.25, sizes: { s: 5, m: 10 } });
    const cp = buildConfiguredProduct(item);

    expect(cp.productCostEach).toBe(7.25);
  });

  test('buildConfiguredProduct aggregates sizes from garmentVariants', () => {
    const item: LineItem = {
      ...makeLegacyItem({}),
      garmentVariants: [
        { product: 'Adult Tee', color: 'Black', sizes: sizes({ s: 5, m: 10 }) },
        { product: 'Adult Tee', color: 'White', sizes: sizes({ s: 3, m: 4 }) },
      ],
      sizes: sizes({ s: 8, m: 14 }),
    };
    const cp = buildConfiguredProduct(item);

    // Both colors become colorVariants of the same product
    expect(cp.colorVariants).toHaveLength(2);
    const total = cp.colorVariants.reduce(
      (sum, cv) => sum + getTotalQuantity(cv.sizes, false),
      0,
    );
    expect(total).toBe(22);
  });

  test('single-product sync round-trip does not change subtotal', () => {
    const item = makeLegacyItem({ productCostEach: 6.00, sizes: { m: 15 }, serviceCostEach: 1.50 });
    const cp = buildConfiguredProduct(item);
    const synced = syncLineItemFromProducts(item, [cp]);

    const beforeCalcs = calculateLineItemSubtotal(item);
    const afterCalcs = calculateLineItemSubtotal(synced);

    expect(afterCalcs.productCostTotal).toBe(beforeCalcs.productCostTotal);
    expect(afterCalcs.serviceCostTotal).toBe(beforeCalcs.serviceCostTotal);
    expect(afterCalcs.subtotal).toBe(beforeCalcs.subtotal);
  });

  test('getLineItemProducts falls back to [getConfiguredProduct] when products[] absent', () => {
    const item = makeLegacyItem({ productCostEach: 4.50, sizes: { m: 10 } });
    const products = getLineItemProducts(item);

    expect(products).toHaveLength(1);
    expect(products[0].productCostEach).toBe(4.50);
  });
});

// ─── 2. Multi-Product Blended Pricing ────────────────────────────────────────

describe('Multi-Product Blended Pricing', () => {
  test('blended × totalQty is cent-exact vs true product-cost sum', () => {
    // Adult Tee:    23 × $4.50 = $103.50
    // Youth Tee:    12 × $3.20 =  $38.40
    // Women's Tee:   8 × $5.10 =  $40.80
    //              ─────────────────────
    //              43           $182.70
    const products = [
      makeProduct({ productLabel: 'Adult Tee',   productCostEach: 4.50, sizes: { m: 23 } }),
      makeProduct({ productLabel: 'Youth Tee',   productCostEach: 3.20, sizes: { m: 12 } }),
      makeProduct({ productLabel: "Women's Tee", productCostEach: 5.10, sizes: { m:  8 } }),
    ];

    const trueSum = 4.50 * 23 + 3.20 * 12 + 5.10 * 8; // 182.70
    const totalQty = 43;

    const blended = blendProductCostEach(products, 'Screen Printing');
    const blendedTotal = blended * totalQty;

    // Blended × qty must equal the true sum to the cent
    expect(toCents(blendedTotal)).toBe(toCents(trueSum));
  });

  test('calculateLineItemSubtotal sums per-product extended costs directly (not blended)', () => {
    const products = [
      makeProduct({ productLabel: 'Adult Tee',   productCostEach: 4.50, sizes: { m: 23 } }),
      makeProduct({ productLabel: 'Youth Tee',   productCostEach: 3.20, sizes: { m: 12 } }),
      makeProduct({ productLabel: "Women's Tee", productCostEach: 5.10, sizes: { m:  8 } }),
    ];
    const item = makeItemFromProducts(products);
    const calcs = calculateLineItemSubtotal(item);

    // 4.50×23 + 3.20×12 + 5.10×8 = 182.70
    expect(toCents(calcs.productCostTotal)).toBe(toCents(182.70));
    expect(calcs.quantity).toBe(43);
  });

  test('productCostRows are populated and correct for multi-product items', () => {
    const products = [
      makeProduct({ productLabel: 'Adult Tee', productCostEach: 4.50, sizes: { m: 23 } }),
      makeProduct({ productLabel: 'Youth Tee', productCostEach: 3.20, sizes: { m: 12 } }),
    ];
    const item = makeItemFromProducts(products);
    const calcs = calculateLineItemSubtotal(item);

    expect(calcs.productCostRows).toHaveLength(2);
    expect(calcs.productCostRows![0].productCostEach).toBe(4.50);
    expect(calcs.productCostRows![0].quantity).toBe(23);
    expect(toCents(calcs.productCostRows![0].extendedCost)).toBe(toCents(4.50 * 23));
    expect(calcs.productCostRows![1].productCostEach).toBe(3.20);
    expect(calcs.productCostRows![1].quantity).toBe(12);
    expect(toCents(calcs.productCostRows![1].extendedCost)).toBe(toCents(3.20 * 12));
  });

  test('single-product item has no productCostRows (not needed for display)', () => {
    const products = [makeProduct({ productCostEach: 5.00, sizes: { m: 20 } })];
    const item = makeItemFromProducts(products);
    const calcs = calculateLineItemSubtotal(item);

    expect(calcs.productCostRows).toBeUndefined();
  });

  test('different per-product costs are preserved independently', () => {
    const p1 = makeProduct({ productLabel: 'Basic Tee',    productCostEach: 3.00, sizes: { m: 10 } });
    const p2 = makeProduct({ productLabel: 'Premium Tee',  productCostEach: 8.00, sizes: { m: 10 } });
    const item = makeItemFromProducts([p1, p2]);

    const products = getLineItemProducts(item);
    expect(products[0].productCostEach).toBe(3.00);
    expect(products[1].productCostEach).toBe(8.00);

    const calcs = calculateLineItemSubtotal(item);
    // 3.00×10 + 8.00×10 = 110.00 (NOT the blended 5.50×20 which would also = 110.00, but the rows are separate)
    expect(toCents(calcs.productCostTotal)).toBe(toCents(110.00));
  });

  test('calculateLineItemTotals aggregates multiple line items correctly', () => {
    const item1 = makeItemFromProducts([
      makeProduct({ productCostEach: 5.00, sizes: { m: 10 } }),
    ]);
    const item2 = makeItemFromProducts([
      makeProduct({ productCostEach: 4.00, sizes: { m: 20 } }),
    ]);
    const totals = calculateLineItemTotals([item1, item2]);

    expect(totals.totalQuantity).toBe(30);
    expect(toCents(totals.productCostTotal)).toBe(toCents(5.00 * 10 + 4.00 * 20)); // 130.00
  });
});

// ─── 3. Quantity Integrity ───────────────────────────────────────────────────

describe('Quantity Integrity', () => {
  test('standard garment sizes count correctly', () => {
    const s = sizes({ xs: 2, s: 5, m: 10, l: 8, xl: 5, xxl: 3 });
    expect(getTotalQuantity(s, false)).toBe(33);
  });

  test('promotional mode counts flat quantity, not garment sizes', () => {
    const s = sizes({ s: 10, m: 20, flat: 150 });
    expect(getTotalQuantity(s, true)).toBe(150);
    expect(getTotalQuantity(s, false)).toBe(30);
  });

  test('promotional flat qty preserved through syncLineItemFromProducts', () => {
    const product = makeProduct({ productCostEach: 2.00, sizes: { flat: 100 } });
    const item = makeItemFromProducts([product], { serviceStyle: 'Promotional' });

    const calcs = calculateLineItemSubtotal(item);
    expect(calcs.quantity).toBe(100);
  });

  test('garment sizes do not drift during single-product sync round-trip', () => {
    const product = makeProduct({ productCostEach: 5.00, sizes: { s: 5, m: 10, l: 7 } });
    const item = makeItemFromProducts([product]);

    const synced = syncLineItemFromProducts(item, getLineItemProducts(item));
    const calcs = calculateLineItemSubtotal(synced);

    expect(calcs.quantity).toBe(22);
  });

  test('aggregate sizes across multiple products sum correctly', () => {
    const products = [
      makeProduct({ sizes: { s: 10, m: 10 } }),
      makeProduct({ sizes: { s:  5, m:  5 } }),
    ];
    const item = makeItemFromProducts(products);
    const calcs = calculateLineItemSubtotal(item);

    expect(calcs.quantity).toBe(30);
    expect(item.sizes.s).toBe(15);
    expect(item.sizes.m).toBe(15);
  });

  test('multi-color product quantities accumulate across color variants', () => {
    const product = makeProduct({
      productCostEach: 4.50,
      colorVariants: [
        makeColorVariant('Black', { m: 10, l: 5 }),
        makeColorVariant('White', { m:  8, l: 4 }),
      ],
    });
    const item = makeItemFromProducts([product]);
    const calcs = calculateLineItemSubtotal(item);

    // 10+5+8+4 = 27 pieces, all at $4.50
    expect(calcs.quantity).toBe(27);
    expect(toCents(calcs.productCostTotal)).toBe(toCents(4.50 * 27));
  });

  test('aggregateSizesAcrossProducts matches item.sizes after sync', () => {
    const products = [
      makeProduct({ sizes: { s: 3, m: 7 } }),
      makeProduct({ sizes: { m: 5, l: 2 } }),
    ];
    const item = makeItemFromProducts(products);
    const aggregated = aggregateSizesAcrossProducts(getLineItemProducts(item));

    expect(aggregated.s).toBe(item.sizes.s);
    expect(aggregated.m).toBe(item.sizes.m);
    expect(aggregated.l).toBe(item.sizes.l);
  });
});

// ─── 4. Variant Grouping ─────────────────────────────────────────────────────

describe('Variant Grouping', () => {
  test('one product with multiple colors is a single products[] entry', () => {
    const product = makeProduct({
      productLabel: 'NL6210 Adult Tee',
      productCostEach: 4.50,
      colorVariants: [
        makeColorVariant('Black', { m: 10 }),
        makeColorVariant('White', { m:  8 }),
      ],
    });

    const item = makeItemFromProducts([product]);
    const products = getLineItemProducts(item);

    expect(products).toHaveLength(1);
    expect(products[0].colorVariants).toHaveLength(2);
  });

  test('same product/same colors contributes one shared productCostEach to the total', () => {
    const product = makeProduct({
      productLabel: 'Adult Tee',
      productCostEach: 4.50,
      colorVariants: [
        makeColorVariant('Black', { m: 10 }),
        makeColorVariant('White', { m:  8 }),
      ],
    });
    const item = makeItemFromProducts([product]);
    const calcs = calculateLineItemSubtotal(item);

    // 18 pieces all at $4.50 — single productCostEach
    expect(calcs.quantity).toBe(18);
    expect(toCents(calcs.productCostTotal)).toBe(toCents(4.50 * 18));
  });

  test('different garments remain as separate products[] entries', () => {
    const adultTee = makeProduct({ productLabel: 'Adult Tee',  productCostEach: 4.50, sizes: { m: 20 } });
    const youthTee = makeProduct({ productLabel: 'Youth Tee',  productCostEach: 3.20, sizes: { m: 10 } });
    const hoodie   = makeProduct({ productLabel: 'Hoodie',     productCostEach: 9.00, sizes: { m:  5 } });

    const item = makeItemFromProducts([adultTee, youthTee, hoodie]);
    const products = getLineItemProducts(item);

    expect(products).toHaveLength(3);
    expect(products[0].productLabel).toBe('Adult Tee');
    expect(products[1].productLabel).toBe('Youth Tee');
    expect(products[2].productLabel).toBe('Hoodie');
  });

  test('summarizeLineItemProducts colorRunCount reflects total color variants across all products', () => {
    const teeWithTwoColors = makeProduct({
      productLabel: 'Adult Tee',
      colorVariants: [
        makeColorVariant('Black', { m: 5 }),
        makeColorVariant('White', { m: 5 }),
      ],
    });
    const youthTeeOneColor = makeProduct({
      productLabel: 'Youth Tee',
      colorVariants: [makeColorVariant('Black', { m: 5 })],
    });

    const item = makeItemFromProducts([teeWithTwoColors, youthTeeOneColor]);
    const summary = summarizeLineItemProducts(item);

    expect(summary.productCount).toBe(2);
    expect(summary.colorRunCount).toBe(3); // 2 + 1
    expect(summary.primaryColor).toBe('Multiple');
  });

  test('single product single color shows that color (not Multiple)', () => {
    const product = makeProduct({
      productLabel: 'Adult Tee',
      colorVariants: [makeColorVariant('Black', { m: 10 })],
    });
    const item = makeItemFromProducts([product]);
    const summary = summarizeLineItemProducts(item);

    expect(summary.primaryColor).toBe('Black');
    expect(summary.colorRunCount).toBe(1);
  });

  test('garmentVariants contains one entry per color run across all products', () => {
    const adultTee = makeProduct({
      productLabel: 'Adult Tee',
      colorVariants: [
        makeColorVariant('Black', { m: 10 }),
        makeColorVariant('White', { m:  8 }),
      ],
    });
    const youthTee = makeProduct({
      productLabel: 'Youth Tee',
      colorVariants: [makeColorVariant('Black', { m: 5 })],
    });

    const item = makeItemFromProducts([adultTee, youthTee]);

    // garmentVariants = flat list: Adult Black, Adult White, Youth Black
    expect(item.garmentVariants).toHaveLength(3);
    expect(item.garmentVariants?.[0].product).toBe('Adult Tee');
    expect(item.garmentVariants?.[0].color).toBe('Black');
    expect(item.garmentVariants?.[1].product).toBe('Adult Tee');
    expect(item.garmentVariants?.[1].color).toBe('White');
    expect(item.garmentVariants?.[2].product).toBe('Youth Tee');
    expect(item.garmentVariants?.[2].color).toBe('Black');
  });
});

// ─── 5. Adjustment Wiring ────────────────────────────────────────────────────

describe('Adjustment Wiring', () => {
  test('flat production cost is added to productionCostTotal', () => {
    const item = makeLegacyItem({
      productCostEach: 5.00,
      sizes: { m: 20 },
      productionCosts: [
        { id: '1', name: 'Design Fee', type: 'flat', rate: 50, quantity: 0 },
      ],
    });
    const calcs = calculateLineItemSubtotal(item);

    expect(toCents(calcs.productionCostTotal)).toBe(toCents(50));
  });

  test('multiple production cost rows are summed', () => {
    const item = makeLegacyItem({
      productionCosts: [
        { id: '1', name: 'Design Fee',   type: 'flat',     rate: 50, quantity: 0  },
        { id: '2', name: 'Screen Setup', type: 'per_unit', rate: 2,  quantity: 10 },
        { id: '3', name: 'Digitizing',   type: 'hourly',   rate: 40, quantity: 1  },
      ],
    });
    const calcs = calculateLineItemSubtotal(item);

    // 50 + (2 × 10) + (40 × 1) = 110
    expect(toCents(calcs.productionCostTotal)).toBe(toCents(110));
  });

  test('percentage production cost is evaluated against adjustmentBase (product + service + markup)', () => {
    // productCostTotal = 5.00 × 20 = 100; serviceCostEach = 0; markupEach = 0
    // adjustmentBase = 100 + 0 + 0 = 100
    // 10% × 100 = 10
    const item = makeLegacyItem({
      productCostEach: 5.00,
      sizes: { m: 20 },
      productionCosts: [
        { id: '1', name: 'Percent Fee', type: 'percentage', rate: 10, quantity: 0 },
      ],
    });
    const calcs = calculateLineItemSubtotal(item);

    expect(toCents(calcs.productionCostTotal)).toBe(toCents(10));
    expect(toCents(calcs.adjustmentBase)).toBe(toCents(100));
  });

  test('other charges rows are summed into otherCostTotal', () => {
    const item = makeLegacyItem({
      otherCharges: [
        { id: '1', name: 'Rush Fee',  type: 'flat', rate: 25, quantity: 0 },
        { id: '2', name: 'Shipping',  type: 'flat', rate: 15, quantity: 0 },
      ],
    });
    const calcs = calculateLineItemSubtotal(item);

    expect(toCents(calcs.otherCostTotal)).toBe(toCents(40));
  });

  test('falls back to serviceFeeEach when no productionCosts rows exist', () => {
    const item = makeLegacyItem({ serviceFeeEach: 35 });
    const calcs = calculateLineItemSubtotal(item);

    expect(toCents(calcs.productionCostTotal)).toBe(toCents(35));
  });

  test('falls back to otherCostEach when no otherCharges rows exist', () => {
    const item: LineItem = { ...makeLegacyItem({}), otherCostEach: 20 };
    const calcs = calculateLineItemSubtotal(item);

    expect(toCents(calcs.otherCostTotal)).toBe(toCents(20));
  });

  test('productionCosts + otherCharges both contribute to subtotal', () => {
    const item = makeLegacyItem({
      productCostEach: 5.00,
      sizes: { m: 10 },
      serviceCostEach: 1.00,
      markupEach: 2.00,
      productionCosts: [{ id: '1', name: 'Design Fee', type: 'flat', rate: 30, quantity: 0 }],
      otherCharges:    [{ id: '2', name: 'Rush',       type: 'flat', rate: 20, quantity: 0 }],
    });
    const calcs = calculateLineItemSubtotal(item);

    // product: 5×10=50, service: 1×10=10, production: 30, other: 20, markup: 2×10=20
    // cogTotal = 50+10+30 = 90
    // subtotal = 90+20+20 = 130
    expect(toCents(calcs.productCostTotal)).toBe(toCents(50));
    expect(toCents(calcs.serviceCostTotal)).toBe(toCents(10));
    expect(toCents(calcs.productionCostTotal)).toBe(toCents(30));
    expect(toCents(calcs.otherCostTotal)).toBe(toCents(20));
    expect(toCents(calcs.markupTotal)).toBe(toCents(20));
    expect(toCents(calcs.cogTotal)).toBe(toCents(90));
    expect(toCents(calcs.subtotal)).toBe(toCents(130));
  });
});

// ─── 6. calcAdjustmentAmount ─────────────────────────────────────────────────

describe('calcAdjustmentAmount', () => {
  test('flat type returns rate directly', () => {
    expect(calcAdjustmentAmount({ type: 'flat', rate: 75, quantity: 0 }, 1000)).toBe(75);
  });

  test('hourly type returns rate × quantity (hours)', () => {
    expect(calcAdjustmentAmount({ type: 'hourly', rate: 60, quantity: 2.5 }, 0)).toBe(150);
  });

  test('per_unit type returns rate × quantity (units)', () => {
    expect(calcAdjustmentAmount({ type: 'per_unit', rate: 1.50, quantity: 43 }, 0)).toBeCloseTo(64.5, 2);
  });

  test('percentage type returns rate% × base', () => {
    expect(calcAdjustmentAmount({ type: 'percentage', rate: 15, quantity: 0 }, 200)).toBeCloseTo(30, 2);
  });

  test('zero rate produces zero output', () => {
    expect(calcAdjustmentAmount({ type: 'flat',       rate: 0, quantity: 5 }, 100)).toBe(0);
    expect(calcAdjustmentAmount({ type: 'hourly',     rate: 0, quantity: 5 }, 100)).toBe(0);
    expect(calcAdjustmentAmount({ type: 'per_unit',   rate: 0, quantity: 5 }, 100)).toBe(0);
    expect(calcAdjustmentAmount({ type: 'percentage', rate: 0, quantity: 0 }, 100)).toBe(0);
  });

  test('zero base for percentage yields zero', () => {
    expect(calcAdjustmentAmount({ type: 'percentage', rate: 10, quantity: 0 }, 0)).toBe(0);
  });
});

// ─── 7. calculateQuote — discount ────────────────────────────────────────────
//
// Base item: qty=20, productCostEach=$10 → productCostTotal=$200
//            markupEach=$5 → markupAmount=$100
//            subtotal = $300
//
// Default fee constants (from constants/fees.ts):
//   onlineFeePct=0.029, onlineFeeFlat=$0.60, salesTaxPct=0.083, cardFeePct=0.0375

describe('calculateQuote — discount', () => {
  const item = makeLegacyItem({ productCostEach: 10, markupEach: 5, sizes: { m: 20 } });

  test('no discount: discountAmount is 0 and discountedSubtotal equals subtotal', () => {
    const r = calculateQuote([item], false, false, false);
    expect(r).not.toBeNull();
    expect(toCents(r!.discountAmount ?? 0)).toBe(0);
    expect(toCents(r!.discountedSubtotal ?? r!.subtotal)).toBe(toCents(300));
    expect(toCents(r!.total)).toBe(toCents(300));
  });

  test('calculateQuote without discount argument is backward compatible', () => {
    const withoutArg = calculateQuote([item], false, false, false);
    const withUndefined = calculateQuote([item], false, false, false, undefined, undefined, undefined);
    const withNull = calculateQuote([item], false, false, false, undefined, undefined, null);
    expect(withoutArg).not.toBeNull();
    expect(toCents(withoutArg!.total)).toBe(toCents(withUndefined!.total));
    expect(toCents(withoutArg!.total)).toBe(toCents(withNull!.total));
    expect(toCents(withoutArg!.subtotal)).toBe(toCents(300));
  });

  test('percentage discount: discountAmount = subtotal × pct / 100', () => {
    const r = calculateQuote([item], false, false, false, undefined, undefined, { type: 'percentage', value: 10 });
    expect(r).not.toBeNull();
    // 10% of $300 = $30
    expect(toCents(r!.discountAmount!)).toBe(toCents(30));
    expect(toCents(r!.discountedSubtotal!)).toBe(toCents(270));
    expect(toCents(r!.total)).toBe(toCents(270));
  });

  test('dollar discount: discountAmount = value, discountedSubtotal = subtotal − value', () => {
    const r = calculateQuote([item], false, false, false, undefined, undefined, { type: 'dollar', value: 50 });
    expect(r).not.toBeNull();
    expect(toCents(r!.discountAmount!)).toBe(toCents(50));
    expect(toCents(r!.discountedSubtotal!)).toBe(toCents(250));
    expect(toCents(r!.total)).toBe(toCents(250));
  });

  test('percentage discount clamps at 100%: discountAmount = subtotal, total = 0', () => {
    const r = calculateQuote([item], false, false, false, undefined, undefined, { type: 'percentage', value: 150 });
    expect(r).not.toBeNull();
    // 150% clamped to 100% → full discount
    expect(toCents(r!.discountAmount!)).toBe(toCents(300));
    expect(toCents(r!.discountedSubtotal!)).toBe(0);
    expect(toCents(r!.total)).toBe(0);
  });

  test('dollar discount clamps at subtotal: discountAmount ≤ subtotal, total ≥ 0', () => {
    const r = calculateQuote([item], false, false, false, undefined, undefined, { type: 'dollar', value: 9999 });
    expect(r).not.toBeNull();
    // $9999 clamped to subtotal $300
    expect(toCents(r!.discountAmount!)).toBe(toCents(300));
    expect(toCents(r!.discountedSubtotal!)).toBe(0);
    expect(toCents(r!.total)).toBe(0);
  });

  test('discount + online fee + sales tax + card fee: all fees apply to discountedSubtotal', () => {
    // subtotal=$300, 10% discount → discountedSubtotal=$270
    // online fee = 270 × 0.029 + 0.60 = 7.83 + 0.60 = 8.43
    // sales tax  = 270 × 0.083       = 22.41
    // card fee   = 270 × 0.0375      = 10.125
    // total      = 270 + 8.43 + 22.41 + 10.125 = 310.965
    const feeRates = { onlineFeePct: 0.029, onlineFeeFlat: 0.60, salesTaxPct: 0.083, cardFeePct: 0.0375 };
    const r = calculateQuote([item], true, true, true, feeRates, undefined, { type: 'percentage', value: 10 });
    expect(r).not.toBeNull();
    const ds = 270;
    expect(toCents(r!.discountedSubtotal!)).toBe(toCents(ds));
    expect(toCents(r!.onlineFee)).toBe(toCents(ds * 0.029 + 0.60));
    expect(toCents(r!.salesTax)).toBe(toCents(ds * 0.083));
    expect(toCents(r!.cardFee)).toBe(toCents(ds * 0.0375));
    const expectedTotal = ds + (ds * 0.029 + 0.60) + (ds * 0.083) + (ds * 0.0375);
    expect(toCents(r!.total)).toBe(toCents(expectedTotal));
  });
});
