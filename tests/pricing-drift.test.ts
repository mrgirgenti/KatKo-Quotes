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
} from '@/utils/lineItemProducts';
import { portalVariantsToProducts } from '@/utils/portalVariants';
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
