/**
 * Apparel Size Upcharge Regression Tests
 *
 * Protects computeSizeUpcharge (called inside calculateLineItemSubtotal) from
 * producing wrong totals when serviceStyle changes between garment-based and
 * flat-quantity modes.
 *
 * Run with:  bun test tests/upcharge-regression.test.ts
 *            bun test tests/               ← full suite
 *
 * Covered scenarios:
 *   1. computeSizeUpcharge — direct verification of per-size dollar amounts
 *   2. Screen Printing: 2XL/3XL/4XL upcharges applied to garment quantities
 *   3. Promotional → style switch: upcharges do NOT apply (flat-qty mode)
 *   4. Promotional → Screen Printing: upcharges reactivate for garment quantities
 *   5. Multi-product: blended cost + upcharges cent-exact after style switch
 */

import { describe, it, expect } from 'bun:test';

import { calculateLineItemSubtotal, getTotalQuantity } from '@/utils/quoteCalculations';
import { syncLineItemFromProducts, updateDesignFields } from '@/utils/lineItemProducts';
import type { LineItem, SizeQuantities } from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ZERO_SIZES: SizeQuantities = {
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
};

function sz(partial: Partial<SizeQuantities>): SizeQuantities {
  return { ...ZERO_SIZES, ...partial };
}

function makeProduct(
  productCostEach: number,
  sizes: Partial<SizeQuantities>,
  label = 'Test Product',
): ConfiguredProduct {
  return {
    productSource: 'manual',
    productLabel: label,
    decorationMethod: 'Screen Printing',
    printLocations: ['Left Chest'],
    colorVariants: [{ color: 'Black', sizes: sz(sizes) }],
    productCostEach,
    serviceCostEach: 0,
    serviceFeeEach: 0,
    markupEach: 0,
  };
}

function makeItem(
  products: ConfiguredProduct[],
  serviceStyle: LineItem['serviceStyle'],
): LineItem {
  const base: LineItem = {
    id: 'test',
    designName: 'Test Design',
    applicator: '',
    product: '',
    productColor: '',
    apparelProvider: '',
    serviceStyle,
    location1: 'Left Chest',
    location2: '',
    locationDetails: '',
    sizes: ZERO_SIZES,
    productCostEach: 0,
    serviceCostEach: 0,
    serviceFeeEach: 0,
    markupEach: 0,
    products,
  };
  return syncLineItemFromProducts(base, products);
}

/** Standard upcharge table used across all tests. */
const UPCHARGES = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00 };

// ─── 1. computeSizeUpcharge — indirect verification via calculateLineItemSubtotal
// computeSizeUpcharge is private; we verify its output through the public API.

describe('computeSizeUpcharge — upcharge amounts via calculateLineItemSubtotal', () => {
  it('no upcharge map → upchargeAmt is zero for any item', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3 });
    const item = makeItem([product], 'Screen Printing');

    // Without upcharges parameter, upchargeAmt should be 0
    const calcs = calculateLineItemSubtotal(item);
    // productCostTotal = 5.00 × (10+5+3) = 5.00 × 18 = 90.00 — no upcharge
    expect(Math.round(calcs.productCostTotal * 100)).toBe(9000);
  });

  it('2XL upcharge: $2/piece × 5 pieces = $10 added to productCostTotal', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, { '2XL': 2.00 });

    // baseCost = 5.00 × 15 = 75; upcharge = 2.00 × 5 = 10; total = 85
    expect(Math.round(calcs.productCostTotal * 100)).toBe(8500);
  });

  it('3XL upcharge: $3/piece × 3 pieces = $9 added to productCostTotal', () => {
    const product = makeProduct(5.00, { m: 10, xxxl: 3 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, { '3XL': 3.00 });

    // baseCost = 5.00 × 13 = 65; upcharge = 3.00 × 3 = 9; total = 74
    expect(Math.round(calcs.productCostTotal * 100)).toBe(7400);
  });

  it('4XL upcharge: $4/piece × 2 pieces = $8 added to productCostTotal', () => {
    const product = makeProduct(5.00, { m: 10, xxxxl: 2 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, { '4XL': 4.00 });

    // baseCost = 5.00 × 12 = 60; upcharge = 4.00 × 2 = 8; total = 68
    expect(Math.round(calcs.productCostTotal * 100)).toBe(6800);
  });

  it('all three upcharges together: 2XL×5 + 3XL×3 + 4XL×2 = $28 total upcharge', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, xxxxl: 2 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    // baseCost = 5.00 × 20 = 100
    // upcharge = 2×5 + 3×3 + 4×2 = 10+9+8 = 27
    // total = 127
    expect(Math.round(calcs.productCostTotal * 100)).toBe(12700);
  });

  it('standard sizes (s, m, l, xl) receive no upcharge', () => {
    // An item with ONLY standard sizes should have zero upcharge contribution.
    // An item with identical standard sizes PLUS xxl should cost exactly
    //   baseCost(xxl pieces) + upcharge(xxl pieces) more — not more.
    const standardOnly = makeProduct(5.00, { s: 10, m: 20, l: 10, xl: 5 });
    const item = makeItem([standardOnly], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    // qty = 45, baseCost = 5.00 × 45 = 225, upcharge = 0
    expect(calcs.quantity).toBe(45);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(22500);
  });
});

// ─── 2. Screen Printing: upcharges apply to garment quantities ────────────────

describe('Screen Printing — size upcharges apply to garment quantities', () => {
  it('qty is garment-size sum (not flat)', () => {
    // sizes: { m: 10, xxl: 5, xxxl: 3, flat: 200 }
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 200 });
    const item = makeItem([product], 'Screen Printing');

    expect(item.sizes.flat).toBe(200);               // flat is stored
    expect(getTotalQuantity(item.sizes, false)).toBe(18); // garment = 10+5+3
  });

  it('upcharges applied to xxl/xxxl garment sizes, not to flat', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 200 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    // baseCost = 5.00 × 18 = 90
    // upcharge = 2.00×5 + 3.00×3 = 10 + 9 = 19
    // productCostTotal = 109
    expect(calcs.quantity).toBe(18);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(10900);
  });

  it('blended cost × garment qty is cent-exact when upcharges present', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3 });
    const item = makeItem([product], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    // With upcharges, productCostTotal = baseCost + upchargeAmt
    // This is NOT blended×qty; it's the exact dollar sum. Verify it's cent-exact.
    const expected = 5.00 * 18 + 2.00 * 5 + 3.00 * 3; // 90 + 19 = 109
    expect(Math.round(calcs.productCostTotal * 100)).toBe(Math.round(expected * 100));
  });
});

// ─── 3. Promotional: upcharges must NOT apply ────────────────────────────────
//
// Promotional mode uses the flat quantity field for all pricing. Garment sizes
// (xxl, xxxl, xxxxl) may coexist in the data (e.g. after a style switch), but
// they must NOT drive size upcharges when isPromotional=true. Doing so would
// produce wrong totals: the base cost is flat-qty-weighted while the upcharge
// would reference stale garment-size quantities.

describe('Promotional — upcharges must NOT apply (flat-qty mode)', () => {
  it('Promotional qty uses flat field only', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 100 });
    const item = makeItem([product], 'Promotional');

    expect(getTotalQuantity(item.sizes, true)).toBe(100);
  });

  it('Promotional: productCostTotal = cost × flat qty, no upcharge (zero garment-size upcharge)', () => {
    // This is the critical anti-regression test.
    // A Promotional item with xxl/xxxl garment sizes alongside a flat count must
    // NOT have those garment sizes drive additional upcharges. The flat count is
    // the authoritative quantity; the garment sizes are stale / coexisting data.
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 100 });
    const item = makeItem([product], 'Promotional');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    // Expected: 5.00 × 100 = 500.00 — no upcharge added
    // Bug case: 5.00 × 100 + (2.00×5 + 3.00×3) = 500 + 19 = 519.00 ← wrong
    expect(calcs.quantity).toBe(100);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(50000); // $500.00
  });

  it('Promotional with only flat qty (no garment sizes): productCostTotal = cost × flat', () => {
    const product = makeProduct(3.00, { flat: 200 });
    const item = makeItem([product], 'Promotional');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    expect(calcs.quantity).toBe(200);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(60000); // 3.00 × 200 = 600
  });

  it('Promotional: stale garment sizes from a prior SP sync do not produce upcharges', () => {
    // Simulate: item created in Screen Printing (garment sizes stored), then
    // switched to Promotional mid-edit. The garment sizes survive in sizes[] but
    // must not trigger upcharges.
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 100 });
    const spItem   = makeItem([product], 'Screen Printing');
    const promoItem = updateDesignFields(spItem, { serviceStyle: 'Promotional' });

    const calcs = calculateLineItemSubtotal(promoItem, UPCHARGES);

    // garment sizes survive the switch but must not produce upcharges
    expect(promoItem.sizes.xxl).toBe(5);   // still in sizes
    expect(promoItem.sizes.flat).toBe(100); // flat is the counting mode
    expect(calcs.quantity).toBe(100);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(50000); // $500 only
  });
});

// ─── 4. Style switch back: upcharges reactivate ───────────────────────────────

describe('Promotional → garment style — size upcharges reactivate', () => {
  it('switching back to Screen Printing reactivates 2XL/3XL upcharges', () => {
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 100 });
    const spItem    = makeItem([product], 'Screen Printing');
    const promoItem = updateDesignFields(spItem,  { serviceStyle: 'Promotional' });
    const backItem  = updateDesignFields(promoItem, { serviceStyle: 'Screen Printing' });

    const calcs = calculateLineItemSubtotal(backItem, UPCHARGES);

    // qty = 18 (garment), baseCost = 90, upcharge = 19, total = 109
    expect(calcs.quantity).toBe(18);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(10900);
  });

  it('switching SP → Promotional → Embroidery restores garment upcharges on return', () => {
    const product = makeProduct(6.00, { m: 8, xxl: 4, xxxxl: 2, flat: 50 });
    const sp1   = makeItem([product], 'Screen Printing');
    const promo = updateDesignFields(sp1, { serviceStyle: 'Promotional' });
    const emb   = updateDesignFields(promo, { serviceStyle: 'Embroidery' });

    const calcs = calculateLineItemSubtotal(emb, UPCHARGES);

    // qty = 8+4+2 = 14 (garment)
    // baseCost = 6.00 × 14 = 84
    // upcharge = 2.00×4 + 4.00×2 = 8+8 = 16
    // total = 100
    expect(calcs.quantity).toBe(14);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(10000);
  });

  it('Screen Printing upcharges identical before and after Promotional round-trip', () => {
    // SP → Promotional → SP must produce the same productCostTotal as the initial SP
    const product = makeProduct(5.00, { m: 10, xxl: 5, xxxl: 3, flat: 100 });
    const initial = makeItem([product], 'Screen Printing');
    const promo   = updateDesignFields(initial, { serviceStyle: 'Promotional' });
    const final_  = updateDesignFields(promo,   { serviceStyle: 'Screen Printing' });

    const calcsInitial = calculateLineItemSubtotal(initial, UPCHARGES);
    const calcsFinal   = calculateLineItemSubtotal(final_,  UPCHARGES);

    expect(calcsInitial.productCostTotal).toBe(calcsFinal.productCostTotal);
    expect(calcsInitial.quantity).toBe(calcsFinal.quantity);
  });
});

// ─── 5. Multi-product: blended + upcharges cent-exact ────────────────────────

describe('Multi-product — blended cost + upcharges cent-exact after style switch', () => {
  // Product A: Adult Tee  cost=$5.00  m=20  xxl=5  xxxl=3  flat=200
  // Product B: Hoodie     cost=$9.00  m=10  xxl=2           flat=50
  //
  //   Screen Printing:  A qty=28  B qty=12  total=40
  //     baseCost A = 5.00×28 = 140  upcharge A = 2×5+3×3 = 19   extA = 159
  //     baseCost B = 9.00×12 = 108  upcharge B = 2×2     =  4   extB = 112
  //     productCostTotal = 271
  //
  //   Promotional:  A qty=200  B qty=50  total=250
  //     baseCost A = 5.00×200 = 1000  upcharge A = 0   extA = 1000
  //     baseCost B = 9.00×50  =  450  upcharge B = 0   extB =  450
  //     productCostTotal = 1450

  const productA = makeProduct(5.00, { m: 20, xxl: 5, xxxl: 3, flat: 200 }, 'Adult Tee');
  const productB = makeProduct(9.00, { m: 10, xxl: 2,           flat:  50 }, 'Hoodie');

  it('Screen Printing: per-product upcharges and total are cent-exact', () => {
    const item  = makeItem([productA, productB], 'Screen Printing');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    expect(calcs.quantity).toBe(40); // 28 + 12
    // extA = 5×28 + 2×5 + 3×3 = 140+10+9 = 159
    // extB = 9×12 + 2×2       = 108+4     = 112
    // total = 271
    expect(Math.round(calcs.productCostTotal * 100)).toBe(27100);
    expect(calcs.productCostRows).toHaveLength(2);
    expect(Math.round(calcs.productCostRows![0].extendedCost * 100)).toBe(15900); // $159
    expect(Math.round(calcs.productCostRows![1].extendedCost * 100)).toBe(11200); // $112
  });

  it('Promotional: no upcharges; productCostTotal = Σ(cost × flatQty), cent-exact', () => {
    const item  = makeItem([productA, productB], 'Promotional');
    const calcs = calculateLineItemSubtotal(item, UPCHARGES);

    expect(calcs.quantity).toBe(250); // 200 + 50
    // extA = 5×200 = 1000, extB = 9×50 = 450, total = 1450
    expect(Math.round(calcs.productCostTotal * 100)).toBe(145000);
    expect(calcs.productCostRows).toHaveLength(2);
    expect(Math.round(calcs.productCostRows![0].extendedCost * 100)).toBe(100000); // $1000
    expect(Math.round(calcs.productCostRows![1].extendedCost * 100)).toBe(45000);  // $450
  });

  it('SP → Promotional switch: productCostTotal recalculates to flat-qty total', () => {
    const spItem    = makeItem([productA, productB], 'Screen Printing');
    const promoItem = updateDesignFields(spItem, { serviceStyle: 'Promotional' });

    const spCalcs    = calculateLineItemSubtotal(spItem,    UPCHARGES);
    const promoCalcs = calculateLineItemSubtotal(promoItem, UPCHARGES);

    // SP total is less than Promo total (different qty modes + much larger flat count)
    expect(spCalcs.quantity).toBe(40);
    expect(promoCalcs.quantity).toBe(250);
    expect(Math.round(spCalcs.productCostTotal    * 100)).toBe(27100);
    expect(Math.round(promoCalcs.productCostTotal * 100)).toBe(145000);
  });

  it('Promotional → SP switch: upcharges reactivate and total is cent-exact', () => {
    const promoItem = makeItem([productA, productB], 'Promotional');
    const spItem    = updateDesignFields(promoItem, { serviceStyle: 'Screen Printing' });

    const calcs = calculateLineItemSubtotal(spItem, UPCHARGES);

    expect(calcs.quantity).toBe(40);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(27100);
  });

  it('total quantity is correct after each switch (no stale quantity leaks)', () => {
    const sp1   = makeItem([productA, productB], 'Screen Printing');
    const promo = updateDesignFields(sp1, { serviceStyle: 'Promotional' });
    const sp2   = updateDesignFields(promo, { serviceStyle: 'Screen Printing' });

    const c1 = calculateLineItemSubtotal(sp1,   UPCHARGES);
    const c2 = calculateLineItemSubtotal(promo,  UPCHARGES);
    const c3 = calculateLineItemSubtotal(sp2,    UPCHARGES);

    expect(c1.quantity).toBe(40);   // garment
    expect(c2.quantity).toBe(250);  // flat
    expect(c3.quantity).toBe(40);   // garment restored
    expect(c1.productCostTotal).toBe(c3.productCostTotal); // round-trip identical
  });
});
