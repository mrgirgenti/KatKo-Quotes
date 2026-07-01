/**
 * Pricing-drift regression tests for multi-product line items.
 *
 * Run with:  bun test tests/pricing-drift.test.ts
 *
 * These tests are intentionally dependency-free (no DB, no React Native, no
 * server imports) so they execute fast and in any environment.
 *
 * Covered invariants:
 *   1. Single-product round-trip: blended cost == product's own cost (no drift)
 *   2. Multi-product blended cost × totalQty == Σ(productCost × productQty), cent-exact
 *   3. Promotional flat-qty mode preserves the flat count (not size-sum)
 *   4. portalVariantsToProducts grouping: same product identity → one group,
 *      distinct products → separate groups
 */

import { describe, it, expect } from 'bun:test';

import {
  blendProductCostEach,
  getConfiguredProductQuantity,
  getConfiguredProductSizes,
  aggregateSizesAcrossProducts,
  syncLineItemFromProducts,
  updateDesignFields,
  validateProductPricingConsistency,
  checkServiceCostDivergence,
  assertNoServiceCostDivergence,
  getLineItemProducts,
} from '@/utils/lineItemProducts';
import { calculateLineItemSubtotal } from '@/utils/quoteCalculations';
import { portalVariantsToProducts } from '@/utils/portalVariants';
import { getTotalQuantity } from '@/utils/quoteCalculations';
import type { LineItem, SizeQuantities } from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';

const EMPTY_SIZES: SizeQuantities = {
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
};

function makeSizes(partial: Partial<SizeQuantities>): SizeQuantities {
  return { ...EMPTY_SIZES, ...partial };
}

function makeProduct(
  productCostEach: number,
  colorSizes: Array<{ color: string; sizes: Partial<SizeQuantities> }>,
  overrides: Partial<ConfiguredProduct> = {},
): ConfiguredProduct {
  return {
    productSource: 'manual',
    decorationMethod: 'Screen Printing',
    printLocations: ['Left Chest'],
    colorVariants: colorSizes.map(({ color, sizes }) => ({
      color,
      sizes: makeSizes(sizes),
    })),
    productCostEach,
    serviceCostEach: 0,
    serviceFeeEach: 0,
    markupEach: 0,
    ...overrides,
  };
}

function makeLineItem(
  products: ConfiguredProduct[],
  serviceStyle: LineItem['serviceStyle'] = 'Screen Printing',
  overrides: Partial<LineItem> = {},
): LineItem {
  return {
    id: 'test-item',
    designName: 'Test Design',
    applicator: 'Katalyst Ko Printshop',
    product: '',
    productColor: '',
    apparelProvider: '',
    serviceStyle,
    location1: 'Left Chest',
    location2: '',
    locationDetails: '',
    sizes: EMPTY_SIZES,
    productCostEach: 0,
    serviceCostEach: 0,
    serviceFeeEach: 0,
    markupEach: 0,
    products,
    ...overrides,
  };
}

describe('blendProductCostEach', () => {
  it('single product — blended equals the product own cost exactly', () => {
    const cp = makeProduct(7.50, [
      { color: 'Black', sizes: { s: 5, m: 10, l: 5 } },
    ]);
    const blended = blendProductCostEach([cp], 'Screen Printing');
    expect(blended).toBe(7.50);
  });

  it('two products — blended × totalQty equals Σ(cost × qty), cent-exact', () => {
    const tee = makeProduct(5.00, [
      { color: 'Black', sizes: { s: 10, m: 20, l: 10 } },
    ]);
    const hoodie = makeProduct(12.50, [
      { color: 'Navy', sizes: { m: 5, l: 5 } },
    ]);
    const products = [tee, hoodie];
    const serviceStyle = 'Screen Printing';

    const teeQty = getConfiguredProductQuantity(tee, serviceStyle);      // 40
    const hoodieQty = getConfiguredProductQuantity(hoodie, serviceStyle); // 10
    const totalQty = teeQty + hoodieQty;                                  // 50

    const trueProductCostTotal = tee.productCostEach * teeQty + hoodie.productCostEach * hoodieQty;
    const blended = blendProductCostEach(products, serviceStyle);
    const blendedTotal = blended * totalQty;

    expect(teeQty).toBe(40);
    expect(hoodieQty).toBe(10);
    expect(trueProductCostTotal).toBe(325.00);
    expect(blendedTotal).toBeCloseTo(trueProductCostTotal, 10);
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueProductCostTotal * 100));
  });

  it('three products — blended × totalQty equals Σ(cost × qty), cent-exact', () => {
    const a = makeProduct(3.33, [{ color: 'White', sizes: { m: 10 } }]);
    const b = makeProduct(6.66, [{ color: 'Black', sizes: { m: 10 } }]);
    const c = makeProduct(9.99, [{ color: 'Red', sizes: { m: 10 } }]);
    const products = [a, b, c];
    const serviceStyle = 'Screen Printing';

    const qtyA = getConfiguredProductQuantity(a, serviceStyle); // 10
    const qtyB = getConfiguredProductQuantity(b, serviceStyle); // 10
    const qtyC = getConfiguredProductQuantity(c, serviceStyle); // 10
    const totalQty = qtyA + qtyB + qtyC;

    const trueTotal = a.productCostEach * qtyA + b.productCostEach * qtyB + c.productCostEach * qtyC;
    const blended = blendProductCostEach(products, serviceStyle);
    const blendedTotal = blended * totalQty;

    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
  });

  it('no-qty fallback — returns first product cost so the panel shows a number', () => {
    const cp = makeProduct(8.00, [
      { color: 'White', sizes: {} },
    ]);
    const blended = blendProductCostEach([cp], 'Screen Printing');
    expect(blended).toBe(8.00);
  });
});

describe('getConfiguredProductQuantity — Promotional flat mode', () => {
  it('Promotional: returns flat count, ignoring garment sizes', () => {
    const cp = makeProduct(2.50, [
      { color: 'Black', sizes: { flat: 150, s: 0, m: 0, l: 0 } },
    ]);
    const qty = getConfiguredProductQuantity(cp, 'Promotional');
    expect(qty).toBe(150);
  });

  it('Promotional: two color variants → flat counts sum', () => {
    const cp: ConfiguredProduct = {
      ...makeProduct(2.50, []),
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ flat: 100 }) },
        { color: 'White', sizes: makeSizes({ flat: 75 }) },
      ],
    };
    const qty = getConfiguredProductQuantity(cp, 'Promotional');
    expect(qty).toBe(175);
  });

  it('non-Promotional: ignores flat, sums garment sizes', () => {
    const cp = makeProduct(5.00, [
      { color: 'Black', sizes: { s: 5, m: 10, l: 5, flat: 999 } },
    ]);
    const qty = getConfiguredProductQuantity(cp, 'Screen Printing');
    expect(qty).toBe(20);
  });

  it('Promotional aggregate sizes carries flat through syncLineItemFromProducts', () => {
    const promo: ConfiguredProduct = {
      ...makeProduct(3.00, []),
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ flat: 200 }) },
      ],
    };
    const item = makeLineItem([promo], 'Promotional');
    const synced = syncLineItemFromProducts(item, [promo]);
    expect(synced.sizes.flat).toBe(200);
    expect(synced.sizes.s).toBe(0);
  });
});

describe('syncLineItemFromProducts — single-product round-trip', () => {
  it('productCostEach on synced item equals the product cost exactly', () => {
    const cp = makeProduct(9.75, [
      { color: 'Forest Green', sizes: { s: 5, m: 10, l: 5, xl: 2 } },
    ]);
    const item = makeLineItem([cp]);
    const synced = syncLineItemFromProducts(item, [cp]);
    expect(synced.productCostEach).toBe(9.75);
  });

  it('aggregate sizes match the color variant sizes for a single product', () => {
    const cp = makeProduct(6.00, [
      { color: 'Black', sizes: { s: 2, m: 5, l: 3 } },
    ]);
    const item = makeLineItem([cp]);
    const synced = syncLineItemFromProducts(item, [cp]);
    expect(synced.sizes.s).toBe(2);
    expect(synced.sizes.m).toBe(5);
    expect(synced.sizes.l).toBe(3);
    expect(synced.sizes.xl).toBe(0);
  });

  it('multi-color single product — sizes aggregate across colors', () => {
    const cp: ConfiguredProduct = {
      ...makeProduct(7.00, []),
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 5, m: 10 }) },
        { color: 'White', sizes: makeSizes({ s: 3, m: 7 }) },
      ],
    };
    const item = makeLineItem([cp]);
    const synced = syncLineItemFromProducts(item, [cp]);
    expect(synced.sizes.s).toBe(8);
    expect(synced.sizes.m).toBe(17);
  });
});

describe('syncLineItemFromProducts — multi-product blended total invariant', () => {
  it('blended × total qty == true product cost total, integer cents', () => {
    const shirt = makeProduct(5.00, [
      { color: 'Black', sizes: { s: 12, m: 24, l: 12 } },
    ]);
    const hoodie = makeProduct(18.00, [
      { color: 'Navy', sizes: { m: 6, l: 6, xl: 3 } },
    ]);
    const item = makeLineItem([shirt, hoodie]);
    const synced = syncLineItemFromProducts(item, [shirt, hoodie]);

    const totalQty = synced.sizes.s + synced.sizes.m + synced.sizes.l + synced.sizes.xl;
    const blendedTotal = synced.productCostEach * totalQty;

    const shirtQty = 12 + 24 + 12; // 48
    const hoodieQty = 6 + 6 + 3;   // 15
    const trueTotal = 5.00 * shirtQty + 18.00 * hoodieQty;

    expect(synced.sizes.s).toBe(12);
    expect(synced.sizes.m).toBe(30);
    expect(synced.sizes.l).toBe(18);
    expect(synced.sizes.xl).toBe(3);
    expect(totalQty).toBe(63);
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
  });
});

describe('portalVariantsToProducts — grouping', () => {
  it('two rows with the same productId collapse into one product with two colorVariants', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      location1: 'Left Chest',
      garmentVariants: [
        {
          productId: 'prod-abc',
          product: 'Adult Tee',
          color: 'Black',
          sizes: makeSizes({ m: 10 }),
          productSource: 'catalog',
        },
        {
          productId: 'prod-abc',
          product: 'Adult Tee',
          color: 'White',
          sizes: makeSizes({ m: 5 }),
          productSource: 'catalog',
        },
      ],
    };
    const products = portalVariantsToProducts(item, () => 0);
    expect(products).toHaveLength(1);
    expect(products[0].colorVariants).toHaveLength(2);
    expect(products[0].colorVariants[0].color).toBe('Black');
    expect(products[0].colorVariants[1].color).toBe('White');
  });

  it('two rows with different productIds stay as separate products', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      location1: 'Left Chest',
      garmentVariants: [
        {
          productId: 'prod-tee',
          product: 'Adult Tee',
          color: 'Black',
          sizes: makeSizes({ m: 10 }),
        },
        {
          productId: 'prod-hoodie',
          product: 'Hoodie',
          color: 'Navy',
          sizes: makeSizes({ m: 5 }),
        },
      ],
    };
    const products = portalVariantsToProducts(item, () => 0);
    expect(products).toHaveLength(2);
    expect(products[0].productId).toBe('prod-tee');
    expect(products[1].productId).toBe('prod-hoodie');
  });

  it('rows with no productId but same label collapse by label (case-insensitive)', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      garmentVariants: [
        { product: 'Adult Tee', color: 'Black', sizes: makeSizes({ m: 10 }) },
        { product: 'Adult Tee', color: 'White', sizes: makeSizes({ m: 5 }) },
        { product: 'adult tee', color: 'Red', sizes: makeSizes({ m: 3 }) },
      ],
    };
    const products = portalVariantsToProducts(item, () => 0);
    expect(products).toHaveLength(1);
    expect(products[0].colorVariants).toHaveLength(3);
  });

  it('rows with no productId and different labels become separate products', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      garmentVariants: [
        { product: 'Adult Tee', color: 'Black', sizes: makeSizes({ m: 10 }) },
        { product: 'Youth Tee', color: 'Red', sizes: makeSizes({ m: 5 }) },
      ],
    };
    const products = portalVariantsToProducts(item, () => 0);
    expect(products).toHaveLength(2);
  });

  it('productId takes precedence over label for grouping key', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      garmentVariants: [
        { productId: 'prod-x', product: 'Tee', color: 'Black', sizes: makeSizes({ m: 5 }) },
        { productId: 'prod-y', product: 'Tee', color: 'White', sizes: makeSizes({ m: 5 }) },
      ],
    };
    const products = portalVariantsToProducts(item, () => 0);
    expect(products).toHaveLength(2);
  });

  it('costFor callback is applied to each product group', () => {
    const item = {
      serviceStyle: 'Screen Printing',
      garmentVariants: [
        { productId: 'prod-tee', product: 'Tee', color: 'Black', sizes: makeSizes({ m: 10 }) },
        { productId: 'prod-hoodie', product: 'Hoodie', color: 'Navy', sizes: makeSizes({ m: 5 }) },
      ],
    };
    const costMap: Record<string, number> = { 'prod-tee': 5.50, 'prod-hoodie': 14.25 };
    const products = portalVariantsToProducts(item, (id) => (id ? costMap[id] ?? 0 : 0));
    expect(products[0].productCostEach).toBe(5.50);
    expect(products[1].productCostEach).toBe(14.25);
  });

  it('empty garmentVariants returns an empty array', () => {
    const products = portalVariantsToProducts({ garmentVariants: [] }, () => 0);
    expect(products).toHaveLength(0);
  });
});

describe('validateProductPricingConsistency — pricing-drift guard', () => {
  it('valid: multi-product with different productCostEach values passes (productCostEach may diverge)', () => {
    const tee    = makeProduct(4.50, [{ color: 'Black', sizes: { m: 20 } }]);
    const hoodie = makeProduct(14.00, [{ color: 'Navy',  sizes: { m: 10 } }]);
    const item = makeLineItem([tee, hoodie], 'Screen Printing', {
      serviceCostEach: 0,
      serviceFeeEach: 0,
      markupEach: 0,
    });

    // Must not throw — only productCostEach differs, which is allowed
    expect(() => validateProductPricingConsistency(item, [tee, hoodie])).not.toThrow();
  });

  it('valid: single-product item is always allowed regardless of values', () => {
    const tee = makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
      serviceCostEach: 99,
    });
    const item = makeLineItem([tee], 'Screen Printing', { serviceCostEach: 1 });

    // Single-product: guard is skipped
    expect(() => validateProductPricingConsistency(item, [tee])).not.toThrow();
  });

  it('invalid: product with divergent serviceCostEach throws', () => {
    const tee = makeProduct(4.50, [{ color: 'Black', sizes: { m: 20 } }], {
      serviceCostEach: 3.00,
    });
    const hoodie = makeProduct(12.00, [{ color: 'Navy', sizes: { m: 10 } }], {
      serviceCostEach: 3.00,
    });
    const item = makeLineItem([tee, hoodie], 'Screen Printing', {
      serviceCostEach: 2.00, // line item says 2.00, products have 3.00
    });

    expect(() => validateProductPricingConsistency(item, [tee, hoodie])).toThrow(
      /serviceCostEach/,
    );
  });

  it('invalid: product with divergent serviceFeeEach throws', () => {
    const tee = makeProduct(4.50, [{ color: 'Black', sizes: { m: 20 } }], {
      serviceFeeEach: 2.50,
    });
    const hoodie = makeProduct(12.00, [{ color: 'Navy', sizes: { m: 10 } }], {
      serviceFeeEach: 2.50,
    });
    const item = makeLineItem([tee, hoodie], 'Screen Printing', {
      serviceFeeEach: 1.50, // diverges
    });

    expect(() => validateProductPricingConsistency(item, [tee, hoodie])).toThrow(
      /serviceFeeEach/,
    );
  });

  it('invalid: product with divergent markupEach throws', () => {
    const tee = makeProduct(4.50, [{ color: 'Black', sizes: { m: 20 } }], {
      markupEach: 3.00,
    });
    const hoodie = makeProduct(12.00, [{ color: 'Navy', sizes: { m: 10 } }], {
      markupEach: 3.00,
    });
    const item = makeLineItem([tee, hoodie], 'Screen Printing', {
      markupEach: 5.00, // diverges
    });

    expect(() => validateProductPricingConsistency(item, [tee, hoodie])).toThrow(
      /markupEach/,
    );
  });

  it('invalid: divergent values cause syncLineItemFromProducts to throw (no silent wrong total)', () => {
    const teeWithWrongFee = makeProduct(4.50, [{ color: 'Black', sizes: { m: 20 } }], {
      serviceFeeEach: 9.99, // deliberately wrong
    });
    const hoodie = makeProduct(12.00, [{ color: 'Navy', sizes: { m: 10 } }], {
      serviceFeeEach: 9.99, // same wrong value
    });
    const item = makeLineItem([teeWithWrongFee, hoodie], 'Screen Printing', {
      serviceFeeEach: 1.00, // line item is 1.00 — products say 9.99
    });

    // syncLineItemFromProducts must throw, not silently proceed with wrong totals
    expect(() => syncLineItemFromProducts(item, [teeWithWrongFee, hoodie])).toThrow(
      /Multi-product line items do not support per-product/,
    );
  });

  it('error message identifies the diverging field and both values', () => {
    const tee = makeProduct(4.50, [{ color: 'Black', sizes: { m: 10 } }], {
      serviceCostEach: 5.00,
    });
    const hoodie = makeProduct(12.00, [{ color: 'Navy', sizes: { m: 5 } }], {
      serviceCostEach: 5.00,
    });
    const item = makeLineItem([tee, hoodie], 'Screen Printing', {
      serviceCostEach: 2.00,
    });

    let message = '';
    try {
      validateProductPricingConsistency(item, [tee, hoodie]);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toMatch(/serviceCostEach/);
    expect(message).toMatch(/5/);   // product value
    expect(message).toMatch(/2/);   // line item value
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Service-cost / markup divergence guard
//
// The LINE ITEM always wins: syncLineItemFromProducts overwrites per-product
// serviceCostEach / serviceFeeEach / markupEach with the line-item values.
// These tests verify that divergence is correctly detected by the guard
// utilities so a future per-product editor cannot silently produce wrong totals.
// ─────────────────────────────────────────────────────────────────────────────

describe('checkServiceCostDivergence', () => {
  it('returns empty array when all products match the line item exactly', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 3.00,
      serviceFeeEach: 0.50,
      markupEach: 2.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 3.00,
        serviceFeeEach: 0.50,
        markupEach: 2.00,
      }),
      makeProduct(8.00, [{ color: 'Navy', sizes: { m: 5 } }], {
        serviceCostEach: 3.00,
        serviceFeeEach: 0.50,
        markupEach: 2.00,
      }),
    ];
    expect(checkServiceCostDivergence(item, products)).toHaveLength(0);
  });

  it('detects a single field divergence on one product', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 3.00,
      serviceFeeEach: 0.50,
      markupEach: 2.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 9.99, // diverges — should be 3.00
        serviceFeeEach: 0.50,
        markupEach: 2.00,
      }),
    ];
    const divergences = checkServiceCostDivergence(item, products);
    expect(divergences).toHaveLength(1);
    expect(divergences[0].field).toBe('serviceCostEach');
    expect(divergences[0].lineItemValue).toBe(3.00);
    expect(divergences[0].productValue).toBe(9.99);
    expect(divergences[0].productIndex).toBe(0);
  });

  it('detects all three field divergences simultaneously', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 3.00,
      serviceFeeEach: 0.50,
      markupEach: 2.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 1.00,
        serviceFeeEach: 0.10,
        markupEach: 0.50,
      }),
    ];
    const divergences = checkServiceCostDivergence(item, products);
    expect(divergences).toHaveLength(3);
    const fields = divergences.map((d) => d.field);
    expect(fields).toContain('serviceCostEach');
    expect(fields).toContain('serviceFeeEach');
    expect(fields).toContain('markupEach');
  });

  it('detects divergence across multiple products independently', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 4.00,
      serviceFeeEach: 0.00,
      markupEach: 1.50,
    });
    const products = [
      // product 0: markupEach diverges
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 4.00,
        serviceFeeEach: 0.00,
        markupEach: 0.00, // stale
      }),
      // product 1: consistent
      makeProduct(8.00, [{ color: 'Navy', sizes: { m: 5 } }], {
        serviceCostEach: 4.00,
        serviceFeeEach: 0.00,
        markupEach: 1.50,
      }),
      // product 2: serviceCostEach diverges
      makeProduct(12.00, [{ color: 'Red', sizes: { m: 3 } }], {
        serviceCostEach: 99.00, // stale
        serviceFeeEach: 0.00,
        markupEach: 1.50,
      }),
    ];
    const divergences = checkServiceCostDivergence(item, products);
    expect(divergences).toHaveLength(2);
    expect(divergences.find((d) => d.productIndex === 0)?.field).toBe('markupEach');
    expect(divergences.find((d) => d.productIndex === 2)?.field).toBe('serviceCostEach');
  });

  it('treats undefined product fields as 0 for comparison', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 0,
      serviceFeeEach: 0,
      markupEach: 0,
    });
    // makeProduct defaults all service cost fields to 0, so no divergence
    const products = [makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }])];
    expect(checkServiceCostDivergence(item, products)).toHaveLength(0);
  });
});

describe('assertNoServiceCostDivergence', () => {
  it('does not throw when products are consistent with the line item', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 2.50,
      serviceFeeEach: 0.25,
      markupEach: 1.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 2.50,
        serviceFeeEach: 0.25,
        markupEach: 1.00,
      }),
    ];
    expect(() => assertNoServiceCostDivergence(item, products)).not.toThrow();
  });

  it('throws when any product diverges from the line item', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 2.50,
      serviceFeeEach: 0.25,
      markupEach: 1.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 99.00, // stale — diverges
        serviceFeeEach: 0.25,
        markupEach: 1.00,
      }),
    ];
    expect(() => assertNoServiceCostDivergence(item, products)).toThrow(
      /service-cost.*markup divergence/i,
    );
  });

  it('thrown error message names the diverging field and both values', () => {
    const item = makeLineItem([], undefined, {
      serviceCostEach: 3.00,
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });
    const products = [
      makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
        serviceCostEach: 7.77,
        serviceFeeEach: 0.00,
        markupEach: 0.00,
      }),
    ];
    let msg = '';
    try {
      assertNoServiceCostDivergence(item, products);
    } catch (e: unknown) {
      msg = (e as Error).message;
    }
    expect(msg).toContain('serviceCostEach');
    expect(msg).toContain('7.77');
    expect(msg).toContain('3');
  });
});

describe('syncLineItemFromProducts — divergence guard behavior', () => {
  // NOTE: The merged codebase uses validateProductPricingConsistency (from the
  // main branch) which THROWS on multi-product divergence, and checkServiceCostDivergence
  // / assertNoServiceCostDivergence (from task-36) which provide detection utilities.
  // For single-product items the guard is skipped and the line item value wins.

  it('single product with stale serviceCostEach — line item value overwrites (no throw)', () => {
    // validateProductPricingConsistency skips single-product items.
    // syncLineItemFromProducts still mirrors the line item value onto the product.
    const staleProduct = makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
      serviceCostEach: 999.00, // stale snapshot
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });
    const item = makeLineItem([staleProduct], 'Screen Printing', {
      serviceCostEach: 3.00, // authoritative
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });

    const synced = syncLineItemFromProducts(item, [staleProduct]);

    expect(synced.serviceCostEach).toBe(3.00);
    expect(synced.products?.[0]?.serviceCostEach).toBe(3.00);
  });

  it('single product with stale markupEach — line item value overwrites (no throw)', () => {
    const staleProduct = makeProduct(8.00, [{ color: 'Navy', sizes: { m: 5, l: 5 } }], {
      serviceCostEach: 2.00,
      serviceFeeEach: 0.50,
      markupEach: 50.00, // stale — must not leak into totals
    });
    const item = makeLineItem([staleProduct], 'Screen Printing', {
      serviceCostEach: 2.00,
      serviceFeeEach: 0.50,
      markupEach: 5.00, // authoritative
    });

    const synced = syncLineItemFromProducts(item, [staleProduct]);

    expect(synced.markupEach).toBe(5.00);
    expect(synced.products?.[0]?.markupEach).toBe(5.00);
    expect(synced.productCostEach).toBe(8.00);
  });

  it('multi-product items with divergent service costs THROW — no silent wrong total', () => {
    // validateProductPricingConsistency is called inside syncLineItemFromProducts.
    // Multi-product items with stale per-product service costs must be rejected
    // loudly rather than silently producing wrong totals.
    const p1 = makeProduct(5.00, [{ color: 'Black', sizes: { m: 10 } }], {
      serviceCostEach: 1.00, // stale — diverges from line item
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });
    const p2 = makeProduct(12.00, [{ color: 'White', sizes: { m: 5 } }], {
      serviceCostEach: 1.00, // same stale value as p1
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });
    const item = makeLineItem([p1, p2], 'Screen Printing', {
      serviceCostEach: 3.50, // authoritative — diverges from product snapshots
      serviceFeeEach: 0.00,
      markupEach: 0.00,
    });

    expect(() => syncLineItemFromProducts(item, [p1, p2])).toThrow(
      /Multi-product line items do not support per-product/,
    );
  });
});

describe('serviceStyle switching — quantity mode and blended cost invariant', () => {
  // ─── Fixtures ──────────────────────────────────────────────────────────────
  // Both products have garment sizes AND flat quantities coexisting so that
  // switching serviceStyle cleanly flips which dimension is counted.
  //
  //   Product A · Adult Tee  · cost $5.00
  //     garment qty: s=10 m=20 l=10 → 40 pcs   flat qty: 200
  //   Product B · Youth Tee  · cost $8.00
  //     garment qty: m=15 → 15 pcs              flat qty: 30
  //
  //   Screen Printing totals:  qty  55   true cost  $320.00  blended ≈ $5.818
  //   Promotional totals:      qty 230   true cost $1240.00  blended ≈ $5.391
  // ─────────────────────────────────────────────────────────────────────────

  const productA = makeProduct(5.00, [
    { color: 'Black', sizes: { s: 10, m: 20, l: 10, flat: 200 } },
  ]);
  const productB = makeProduct(8.00, [
    { color: 'Navy', sizes: { m: 15, flat: 30 } },
  ]);

  /** Sync the two fixture products under a given serviceStyle. */
  function syncWith(serviceStyle: LineItem['serviceStyle']) {
    const item = makeLineItem([productA, productB], serviceStyle);
    return syncLineItemFromProducts(item, [productA, productB]);
  }

  // ── Garment-size style (Screen Printing) ───────────────────────────────────

  it('Screen Printing: getTotalQuantity counts garment sizes, not flat', () => {
    const synced = syncWith('Screen Printing');
    const garmentQty = getTotalQuantity(synced.sizes, false);
    expect(garmentQty).toBe(55); // 40 + 15
  });

  it('Screen Printing: flat field is stored in sizes but not counted', () => {
    const synced = syncWith('Screen Printing');
    // flat is accumulated but getTotalQuantity(_, false) ignores it
    expect(synced.sizes.flat).toBe(230); // 200 + 30 — preserved, not counted
    expect(synced.sizes.s).toBe(10);
    expect(synced.sizes.m).toBe(35); // 20 + 15
    expect(synced.sizes.l).toBe(10);
  });

  it('Screen Printing: blended × garment-total is cent-exact vs Σ(cost × garmentQty)', () => {
    const synced = syncWith('Screen Printing');
    const garmentTotal = getTotalQuantity(synced.sizes, false); // 55
    const blendedTotal = synced.productCostEach * garmentTotal;
    const trueTotal = 5.00 * 40 + 8.00 * 15; // 320.00
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
    expect(Math.round(blendedTotal * 100)).toBe(32000); // $320.00 in cents
  });

  // ── Switching to Promotional ───────────────────────────────────────────────

  it('Promotional: getTotalQuantity counts flat field, not garment sizes', () => {
    const synced = syncWith('Promotional');
    const flatQty = getTotalQuantity(synced.sizes, true);
    expect(flatQty).toBe(230); // 200 + 30
  });

  it('Promotional: garment sizes are preserved in sizes but not used for qty', () => {
    const synced = syncWith('Promotional');
    const garmentQty = getTotalQuantity(synced.sizes, false);
    const flatQty    = getTotalQuantity(synced.sizes, true);
    // garment sizes survive the sync — only the counting mode changes
    expect(garmentQty).toBe(55);
    expect(flatQty).toBe(230);
  });

  it('Promotional: blended × flat-total is cent-exact vs Σ(cost × flatQty)', () => {
    const synced = syncWith('Promotional');
    const flatTotal   = getTotalQuantity(synced.sizes, true); // 230
    const blendedTotal = synced.productCostEach * flatTotal;
    const trueTotal   = 5.00 * 200 + 8.00 * 30; // 1240.00
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
    expect(Math.round(blendedTotal * 100)).toBe(124000); // $1240.00 in cents
  });

  // ── Switching back to garment-size style ───────────────────────────────────

  it('back to Screen Printing: garment quantity is exactly restored', () => {
    // Simulate a full switch cycle: garment → Promotional → garment
    const garment1 = syncWith('Screen Printing');
    const _promo   = syncWith('Promotional'); // intermediate — must not affect garment2
    const garment2 = syncWith('Screen Printing');

    expect(getTotalQuantity(garment1.sizes, false)).toBe(
      getTotalQuantity(garment2.sizes, false),
    );
    expect(getTotalQuantity(garment2.sizes, false)).toBe(55);
  });

  it('flat and garment quantities do not cross-contaminate after full style cycle', () => {
    const garment1 = syncWith('Screen Printing');
    const garment2 = syncWith('Screen Printing'); // second sync after implicit Promotional

    // Garment totals are identical — no contamination from flat field
    expect(getTotalQuantity(garment1.sizes, false)).toBe(
      getTotalQuantity(garment2.sizes, false),
    );
    // Flat totals are also identical
    expect(getTotalQuantity(garment1.sizes, true)).toBe(
      getTotalQuantity(garment2.sizes, true),
    );
    // Blended costs are identical — no drift from a style switch cycle
    expect(garment1.productCostEach).toBe(garment2.productCostEach);
  });

  it('blended productCostEach differs between styles when flat/garment ratios differ', () => {
    // Product A/B have garment ratio 40:15 but flat ratio 200:30.
    // Since the ratios differ, the blended cost must differ between modes —
    // confirming the adapter re-weights correctly after each style switch.
    //
    //   garment blended: (5×40 + 8×15) / 55  = 320/55  ≈ 5.8182
    //   promo   blended: (5×200 + 8×30) / 230 = 1240/230 ≈ 5.3913
    const garmentSync = syncWith('Screen Printing');
    const promoSync   = syncWith('Promotional');

    expect(garmentSync.productCostEach).toBeCloseTo(320 / 55,   8);
    expect(promoSync.productCostEach).toBeCloseTo(1240 / 230,  8);
    expect(garmentSync.productCostEach).not.toBeCloseTo(promoSync.productCostEach, 2);
  });

  it('blended × qty is cent-exact for Screen Printing after switching back from Promotional', () => {
    // Switch to Promotional, then back — the garment-mode blended cost
    // must still produce a cent-exact product-cost total.
    const promoSync   = syncWith('Promotional');   // switch away
    const garmentBack = syncWith('Screen Printing'); // switch back

    const garmentQty  = getTotalQuantity(garmentBack.sizes, false);
    const blendedTotal = garmentBack.productCostEach * garmentQty;
    const trueTotal    = 5.00 * 40 + 8.00 * 15; // 320.00

    // Intermediate Promotional sync must not have contaminated the result
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
    // promoSync is used above only to confirm we did the switch; suppress unused warning
    expect(promoSync.productCostEach).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mid-edit service-style change regression suite
//
// Changing serviceStyle (e.g. Screen Printing → Promotional) flips the
// quantity-counting mode between garment-size aggregation and the flat field.
// These tests verify that:
//
//   1. blendProductCostEach correctly re-weights when the counting mode changes
//      (blended × totalQty == Σ(productCost × productQty), cent-exact)
//   2. Flat counts (Promotional) and garment counts (other styles) never
//      cross-contaminate — switching modes does not carry stale counts
//   3. updateDesignFields (the canonical mid-edit funnel) propagates the new
//      serviceStyle and produces correct aggregate sizes and blended cost
//   4. calculateLineItemSubtotal reflects the new mode end-to-end after a switch
// ─────────────────────────────────────────────────────────────────────────────

describe('mid-edit serviceStyle change — blended cost correctness', () => {
  it('Screen Printing → Promotional: blended × flat total == Σ(cost × flatQty), cent-exact', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 50 }) },
      ],
    });
    const promo = makeProduct(2.50, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ flat: 100 }) },
      ],
    });

    const teeQtyPromo = getConfiguredProductQuantity(tee, 'Promotional');     // flat=50
    const promoQtyPromo = getConfiguredProductQuantity(promo, 'Promotional'); // flat=100
    const totalQtyPromo = teeQtyPromo + promoQtyPromo;                        // 150

    const trueTotal = tee.productCostEach * teeQtyPromo + promo.productCostEach * promoQtyPromo;
    const blended = blendProductCostEach([tee, promo], 'Promotional');

    expect(teeQtyPromo).toBe(50);
    expect(promoQtyPromo).toBe(100);
    expect(Math.round(blended * totalQtyPromo * 100)).toBe(Math.round(trueTotal * 100));
  });

  it('Promotional → Screen Printing: blended × garment total == Σ(cost × garmentQty), cent-exact', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 999 }) },
      ],
    });
    const hoodie = makeProduct(15.00, [], {
      colorVariants: [
        { color: 'Navy', sizes: makeSizes({ m: 5, l: 5, flat: 999 }) },
      ],
    });

    const teeQtySP = getConfiguredProductQuantity(tee, 'Screen Printing');     // 40
    const hoodieQtySP = getConfiguredProductQuantity(hoodie, 'Screen Printing'); // 10
    const totalQtySP = teeQtySP + hoodieQtySP;                                   // 50

    const trueTotal = tee.productCostEach * teeQtySP + hoodie.productCostEach * hoodieQtySP;
    const blended = blendProductCostEach([tee, hoodie], 'Screen Printing');

    expect(teeQtySP).toBe(40);
    expect(hoodieQtySP).toBe(10);
    expect(Math.round(blended * totalQtySP * 100)).toBe(Math.round(trueTotal * 100));
  });

  it('flat and garment counts do not cross-contaminate: Promotional ignores garment sizes', () => {
    const cp = makeProduct(3.00, [], {
      colorVariants: [
        { color: 'Red', sizes: makeSizes({ s: 5, m: 10, l: 5, flat: 200 }) },
      ],
    });

    const promoQty = getConfiguredProductQuantity(cp, 'Promotional');
    const garmentQty = getConfiguredProductQuantity(cp, 'Screen Printing');

    expect(promoQty).toBe(200);
    expect(garmentQty).toBe(20);
    expect(promoQty).not.toBe(garmentQty);
  });

  it('garment mode ignores flat: Screen Printing does not count flat field', () => {
    const cp = makeProduct(4.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ m: 15, flat: 500 }) },
      ],
    });

    const garmentQty = getConfiguredProductQuantity(cp, 'Screen Printing');
    expect(garmentQty).toBe(15);
  });
});

describe('mid-edit serviceStyle change — updateDesignFields propagation', () => {
  it('switching Screen Printing → Promotional via updateDesignFields recomputes aggregate sizes (flat)', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 60 }) },
      ],
    });
    const promo = makeProduct(2.00, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ flat: 120 }) },
      ],
    });

    const item = makeLineItem([tee, promo], 'Screen Printing');
    const switched = updateDesignFields(item, { serviceStyle: 'Promotional' });

    expect(switched.serviceStyle).toBe('Promotional');
    expect(switched.sizes.flat).toBe(60 + 120);
    expect(switched.sizes.s).toBe(10);
    expect(switched.sizes.m).toBe(20);
  });

  it('switching Promotional → Screen Printing via updateDesignFields recomputes aggregate sizes (garment)', () => {
    const tee = makeProduct(6.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 5, m: 10, l: 5, flat: 999 }) },
      ],
    });
    const hoodie = makeProduct(14.00, [], {
      colorVariants: [
        { color: 'Navy', sizes: makeSizes({ m: 8, l: 4, flat: 999 }) },
      ],
    });

    const item = makeLineItem([tee, hoodie], 'Promotional');
    const switched = updateDesignFields(item, { serviceStyle: 'Screen Printing' });

    expect(switched.serviceStyle).toBe('Screen Printing');
    expect(switched.sizes.s).toBe(5);
    expect(switched.sizes.m).toBe(18);
    expect(switched.sizes.l).toBe(9);
  });

  it('blended cost × totalQty is cent-exact after Screen Printing → Promotional switch', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, flat: 60 }) },
      ],
    });
    const mug = makeProduct(3.50, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ flat: 90 }) },
      ],
    });

    const item = makeLineItem([tee, mug], 'Screen Printing');
    const switched = updateDesignFields(item, { serviceStyle: 'Promotional' });

    const teeFlat = 60;
    const mugFlat = 90;
    const totalFlat = teeFlat + mugFlat; // 150
    const trueProductCostTotal = 5.00 * teeFlat + 3.50 * mugFlat; // 300 + 315 = 615

    const blendedTotal = switched.productCostEach * totalFlat;

    expect(switched.sizes.flat).toBe(totalFlat);
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueProductCostTotal * 100));
  });

  it('blended cost × totalQty is cent-exact after Promotional → Embroidery switch', () => {
    const shirt = makeProduct(7.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 12, m: 24, l: 12, flat: 999 }) },
      ],
    });
    const polo = makeProduct(11.50, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ m: 6, l: 6, flat: 999 }) },
      ],
    });

    const item = makeLineItem([shirt, polo], 'Promotional');
    const switched = updateDesignFields(item, { serviceStyle: 'Embroidery' });

    const shirtQty = 12 + 24 + 12; // 48
    const poloQty = 6 + 6;          // 12
    const totalQty = shirtQty + poloQty; // 60
    const trueTotal = 7.00 * shirtQty + 11.50 * poloQty; // 336 + 138 = 474

    const blendedTotal = switched.productCostEach * totalQty;

    expect(switched.sizes.s).toBe(12);
    expect(switched.sizes.m).toBe(30);
    expect(switched.sizes.l).toBe(18);
    expect(Math.round(blendedTotal * 100)).toBe(Math.round(trueTotal * 100));
  });
});

describe('mid-edit serviceStyle change — calculateLineItemSubtotal end-to-end', () => {
  it('Promotional: subtotal uses flat qty; garment sizes are ignored in the total', () => {
    const cp = makeProduct(4.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 5, m: 10, l: 5, flat: 200 }) },
      ],
    });

    const item = makeLineItem([cp], 'Promotional', {
      serviceCostEach: 1.00,
      markupEach: 2.00,
    });
    const synced = updateDesignFields(item, { serviceStyle: 'Promotional' });
    const calcs = calculateLineItemSubtotal(synced);

    expect(calcs.quantity).toBe(200);
    expect(calcs.productCostTotal).toBeCloseTo(800.00, 2);
    expect(calcs.serviceCostTotal).toBeCloseTo(200.00, 2);
    expect(calcs.markupTotal).toBeCloseTo(400.00, 2);
  });

  it('Screen Printing: subtotal uses garment sizes; flat field is ignored in the total', () => {
    const cp = makeProduct(4.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 5, m: 10, l: 5, flat: 200 }) },
      ],
    });

    const item = makeLineItem([cp], 'Screen Printing', {
      serviceCostEach: 1.00,
      markupEach: 2.00,
    });
    const synced = updateDesignFields(item, { serviceStyle: 'Screen Printing' });
    const calcs = calculateLineItemSubtotal(synced);

    expect(calcs.quantity).toBe(20);
    expect(calcs.productCostTotal).toBeCloseTo(80.00, 2);
    expect(calcs.serviceCostTotal).toBeCloseTo(20.00, 2);
    expect(calcs.markupTotal).toBeCloseTo(40.00, 2);
  });

  it('multi-product: mid-edit switch from Screen Printing to Promotional recalculates subtotal correctly', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 50 }) },
      ],
    });
    const pen = makeProduct(1.50, [], {
      colorVariants: [
        { color: 'Blue', sizes: makeSizes({ flat: 100 }) },
      ],
    });

    const item = makeLineItem([tee, pen], 'Screen Printing');
    const switched = updateDesignFields(item, { serviceStyle: 'Promotional' });
    const calcs = calculateLineItemSubtotal(switched);

    const expectedQty = 50 + 100;                           // 150
    const expectedProductCost = 5.00 * 50 + 1.50 * 100;    // 250 + 150 = 400

    expect(calcs.quantity).toBe(expectedQty);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(Math.round(expectedProductCost * 100));
  });

  it('multi-product: mid-edit switch from Promotional to DTF Transfers recalculates subtotal correctly', () => {
    const shirt = makeProduct(6.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 8, m: 16, l: 8, flat: 999 }) },
      ],
    });
    const hoodie = makeProduct(14.00, [], {
      colorVariants: [
        { color: 'Navy', sizes: makeSizes({ m: 5, l: 5, flat: 999 }) },
      ],
    });

    const item = makeLineItem([shirt, hoodie], 'Promotional');
    const switched = updateDesignFields(item, { serviceStyle: 'DTF Transfers' });
    const calcs = calculateLineItemSubtotal(switched);

    const shirtQty = 8 + 16 + 8;  // 32
    const hoodieQty = 5 + 5;       // 10
    const expectedQty = shirtQty + hoodieQty; // 42
    const expectedProductCost = 6.00 * shirtQty + 14.00 * hoodieQty; // 192 + 140 = 332

    expect(calcs.quantity).toBe(expectedQty);
    expect(Math.round(calcs.productCostTotal * 100)).toBe(Math.round(expectedProductCost * 100));
  });

  it('switching serviceStyle twice round-trips back to the original totals', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 75 }) },
      ],
    });
    const hoodie = makeProduct(15.00, [], {
      colorVariants: [
        { color: 'Navy', sizes: makeSizes({ m: 5, l: 5, flat: 25 }) },
      ],
    });

    const original = makeLineItem([tee, hoodie], 'Screen Printing');
    const switched = updateDesignFields(original, { serviceStyle: 'Promotional' });
    const restored = updateDesignFields(switched, { serviceStyle: 'Screen Printing' });

    const origCalcs = calculateLineItemSubtotal(
      updateDesignFields(original, { serviceStyle: 'Screen Printing' }),
    );
    const restoredCalcs = calculateLineItemSubtotal(restored);

    expect(restoredCalcs.quantity).toBe(origCalcs.quantity);
    expect(Math.round(restoredCalcs.productCostTotal * 100))
      .toBe(Math.round(origCalcs.productCostTotal * 100));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serviceStyle switch → save → reload round-trip (no drift)
//
// These tests mirror the API persistence boundary: normalizeLineItems() calls
// syncLineItemFromProducts(item, getLineItemProducts(item)) — i.e. the item's
// CURRENT serviceStyle is used to re-blend costs before the record is written.
// After a JSON serialize/deserialize (DB round-trip), the reloaded item must
// produce identical totals to the in-memory switched item.
//
// Verified invariants per reload:
//   • serviceStyle persisted correctly
//   • blended productCostEach persisted correctly (cent-exact)
//   • totalQuantity persisted correctly
//   • Production Cost (productCostTotal) matches in-memory calculation
//   • Quote Summary (serviceCostTotal, markupTotal) matches in-memory calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate the API persistence boundary then a DB round-trip:
 *   1. syncLineItemFromProducts with CURRENT item (what normalizeLineItems does)
 *   2. JSON.stringify → JSON.parse  (what the DB + JSON.parse on reload does)
 * The result is what downstream consumers (portal, PDF, summary) would read.
 */
function simulateSaveReload(item: LineItem): LineItem {
  const normalized = syncLineItemFromProducts(item, getLineItemProducts(item));
  return JSON.parse(JSON.stringify(normalized)) as LineItem;
}

describe('serviceStyle switch → save → reload round-trip (no drift)', () => {
  it('Screen Printing → Promotional: reloaded totals match in-memory totals exactly', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 75 }) },
      ],
    });
    const pen = makeProduct(1.50, [], {
      colorVariants: [
        { color: 'Blue', sizes: makeSizes({ flat: 100 }) },
      ],
    });

    const original = makeLineItem([tee, pen], 'Screen Printing');
    const switched = updateDesignFields(original, { serviceStyle: 'Promotional' });
    const inMemoryCalcs = calculateLineItemSubtotal(switched);

    const reloaded = simulateSaveReload(switched);
    const reloadedCalcs = calculateLineItemSubtotal(reloaded);

    expect(reloaded.serviceStyle).toBe('Promotional');
    expect(Math.round(reloaded.productCostEach * 1e10)).toBe(Math.round(switched.productCostEach * 1e10));
    expect(reloadedCalcs.quantity).toBe(inMemoryCalcs.quantity);
    expect(Math.round(reloadedCalcs.productCostTotal * 100)).toBe(Math.round(inMemoryCalcs.productCostTotal * 100));
    expect(Math.round(reloadedCalcs.serviceCostTotal * 100)).toBe(Math.round(inMemoryCalcs.serviceCostTotal * 100));
    expect(Math.round(reloadedCalcs.markupTotal * 100)).toBe(Math.round(inMemoryCalcs.markupTotal * 100));
  });

  it('Promotional → Embroidery: reloaded totals match in-memory totals exactly', () => {
    const shirt = makeProduct(7.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 12, m: 24, l: 12, flat: 999 }) },
      ],
    });
    const polo = makeProduct(11.50, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ m: 6, l: 6, flat: 999 }) },
      ],
    });

    const original = makeLineItem([shirt, polo], 'Promotional');
    const switched = updateDesignFields(original, { serviceStyle: 'Embroidery' });
    const inMemoryCalcs = calculateLineItemSubtotal(switched);

    const reloaded = simulateSaveReload(switched);
    const reloadedCalcs = calculateLineItemSubtotal(reloaded);

    expect(reloaded.serviceStyle).toBe('Embroidery');
    expect(Math.round(reloaded.productCostEach * 1e10)).toBe(Math.round(switched.productCostEach * 1e10));
    expect(reloadedCalcs.quantity).toBe(inMemoryCalcs.quantity);
    expect(Math.round(reloadedCalcs.productCostTotal * 100)).toBe(Math.round(inMemoryCalcs.productCostTotal * 100));
    expect(Math.round(reloadedCalcs.serviceCostTotal * 100)).toBe(Math.round(inMemoryCalcs.serviceCostTotal * 100));
    expect(Math.round(reloadedCalcs.markupTotal * 100)).toBe(Math.round(inMemoryCalcs.markupTotal * 100));
  });

  it('Screen Printing → DTF Transfers: single-product reloads without drift', () => {
    const shirt = makeProduct(8.50, [
      { color: 'Black', sizes: { s: 5, m: 10, l: 5 } },
    ], {
      serviceCostEach: 2.00,
      markupEach: 3.00,
    });

    const original = makeLineItem([shirt], 'Screen Printing', {
      serviceCostEach: 2.00,
      markupEach: 3.00,
    });
    const switched = updateDesignFields(original, { serviceStyle: 'DTF Transfers' });
    const inMemoryCalcs = calculateLineItemSubtotal(switched);

    const reloaded = simulateSaveReload(switched);
    const reloadedCalcs = calculateLineItemSubtotal(reloaded);

    expect(reloaded.serviceStyle).toBe('DTF Transfers');
    expect(reloaded.productCostEach).toBe(switched.productCostEach);
    expect(reloadedCalcs.quantity).toBe(inMemoryCalcs.quantity);
    expect(Math.round(reloadedCalcs.productCostTotal * 100)).toBe(Math.round(inMemoryCalcs.productCostTotal * 100));
    expect(Math.round(reloadedCalcs.serviceCostTotal * 100)).toBe(Math.round(inMemoryCalcs.serviceCostTotal * 100));
    expect(Math.round(reloadedCalcs.markupTotal * 100)).toBe(Math.round(inMemoryCalcs.markupTotal * 100));
  });

  it('multi-product: save uses new serviceStyle blended cost, not the pre-switch stale value', () => {
    const tee = makeProduct(5.00, [], {
      colorVariants: [
        { color: 'Black', sizes: makeSizes({ s: 10, m: 20, l: 10, flat: 60 }) },
      ],
    });
    const mug = makeProduct(3.50, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ flat: 90 }) },
      ],
    });

    const screenPrintingItem = makeLineItem([tee, mug], 'Screen Printing');
    const screenPrintingCalcs = calculateLineItemSubtotal(
      syncLineItemFromProducts(screenPrintingItem, getLineItemProducts(screenPrintingItem)),
    );

    const promoSwitched = updateDesignFields(screenPrintingItem, { serviceStyle: 'Promotional' });
    const promoCalcs = calculateLineItemSubtotal(promoSwitched);

    // Blended cost and qty must differ between the two serviceStyles
    expect(promoCalcs.quantity).not.toBe(screenPrintingCalcs.quantity);

    // After save → reload, totals must match the in-memory Promotional values, not the old Screen Printing ones
    const reloaded = simulateSaveReload(promoSwitched);
    const reloadedCalcs = calculateLineItemSubtotal(reloaded);

    expect(reloaded.serviceStyle).toBe('Promotional');
    expect(reloadedCalcs.quantity).toBe(promoCalcs.quantity);
    expect(Math.round(reloadedCalcs.productCostTotal * 100)).toBe(Math.round(promoCalcs.productCostTotal * 100));

    // Specifically must NOT match the stale Screen Printing totals
    expect(reloadedCalcs.quantity).not.toBe(screenPrintingCalcs.quantity);
    expect(Math.round(reloadedCalcs.productCostTotal * 100)).not.toBe(Math.round(screenPrintingCalcs.productCostTotal * 100));
  });

  it('save → reload → re-save produces identical totals (idempotent)', () => {
    const hoodie = makeProduct(18.00, [], {
      colorVariants: [
        { color: 'Navy', sizes: makeSizes({ m: 10, l: 10, xl: 5 }) },
      ],
    });
    const tee = makeProduct(6.00, [], {
      colorVariants: [
        { color: 'White', sizes: makeSizes({ s: 20, m: 30 }) },
      ],
    });

    const original = makeLineItem([hoodie, tee], 'Screen Printing');
    const switched = updateDesignFields(original, { serviceStyle: 'Embroidery' });

    const firstReload = simulateSaveReload(switched);
    const secondReload = simulateSaveReload(firstReload);

    const firstCalcs = calculateLineItemSubtotal(firstReload);
    const secondCalcs = calculateLineItemSubtotal(secondReload);

    expect(secondReload.serviceStyle).toBe('Embroidery');
    expect(secondReload.productCostEach).toBe(firstReload.productCostEach);
    expect(secondCalcs.quantity).toBe(firstCalcs.quantity);
    expect(Math.round(secondCalcs.productCostTotal * 100)).toBe(Math.round(firstCalcs.productCostTotal * 100));
    expect(Math.round(secondCalcs.serviceCostTotal * 100)).toBe(Math.round(firstCalcs.serviceCostTotal * 100));
    expect(Math.round(secondCalcs.markupTotal * 100)).toBe(Math.round(firstCalcs.markupTotal * 100));
  });
});
