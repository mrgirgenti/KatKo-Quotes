import type { LineItem, GarmentVariant, SizeQuantities } from '@/types/quote';
import type { ConfiguredProduct, ConfiguredColorVariant } from '@/types/configuredProduct';

export { type ConfiguredProduct, type ConfiguredColorVariant };

const EMPTY_SIZES: SizeQuantities = {
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
};

/**
 * Build a ConfiguredProduct from the legacy top-level LineItem fields.
 * Used by the migration and as a fallback when configuredProduct is absent.
 */
export function buildConfiguredProduct(item: LineItem): ConfiguredProduct {
  const variants: GarmentVariant[] = item.garmentVariants?.length
    ? item.garmentVariants
    : [{ product: item.product || '', color: item.productColor || '', sizes: item.sizes ?? { ...EMPTY_SIZES } }];

  const primary = variants[0];

  const colorVariants: ConfiguredColorVariant[] = variants.map((v) => ({
    color: v.color || '',
    colorHex: undefined,
    sizes: v.sizes ?? { ...EMPTY_SIZES },
  }));

  const printLocations: string[] = [
    item.location1,
    item.location2,
    item.location3,
    item.location4,
  ].filter((l): l is string => !!l);

  return {
    category: primary.category,
    productType: primary.category,
    styleNumber: primary.styleNumber,
    styleName: primary.productName,
    brand: primary.brand,
    productId: primary.productId,
    productSource: primary.productSource === 'catalog' ? 'catalog' : 'manual',
    productLabel: primary.product || item.product || undefined,

    vendorName: item.apparelProvider || undefined,

    decorationMethod: item.serviceStyle || 'Screen Printing',

    colorVariants,

    printLocations,
    locationDetails: item.locationDetails || undefined,

    mockupUri: item.mockupUri,
    artworkLayers: [],
    templateSettings: {},

    productCostEach: item.productCostEach ?? 0,
    serviceCostEach: item.serviceCostEach ?? 0,
    serviceFeeEach: item.serviceFeeEach ?? 0,
    markupEach: item.markupEach ?? 0,
  };
}

/**
 * Return the canonical ConfiguredProduct for a line item.
 * If one already exists on the item, return it directly;
 * otherwise derive it from the legacy fields (backward-compat).
 */
export function getConfiguredProduct(item: LineItem): ConfiguredProduct {
  if (item.configuredProduct) return item.configuredProduct;
  return buildConfiguredProduct(item);
}

/**
 * Sync legacy top-level LineItem fields FROM a ConfiguredProduct.
 * Call this whenever the ConfiguredProduct is mutated so the rest
 * of the app (which may still read legacy fields) stays consistent.
 */
export function syncLegacyFields(item: LineItem, cp: ConfiguredProduct): LineItem {
  const primaryVariant = cp.colorVariants[0];

  const garmentVariants: GarmentVariant[] = cp.colorVariants.map((cv) => ({
    product: cp.productLabel || `${cp.styleNumber ?? ''} — ${cp.styleName ?? ''}`.replace(/^ — | — $/g, '').trim(),
    color: cv.color,
    sizes: cv.sizes,
    productId: cp.productId,
    styleNumber: cp.styleNumber,
    brand: cp.brand,
    productName: cp.styleName,
    productSource: cp.productSource,
    category: cp.category,
  }));

  const [loc1, loc2, loc3, loc4] = [
    cp.printLocations[0] ?? '',
    cp.printLocations[1] ?? '',
    cp.printLocations[2],
    cp.printLocations[3],
  ];

  const mergedSizes: SizeQuantities = cp.colorVariants.reduce(
    (acc, cv) => {
      (Object.keys(acc) as (keyof SizeQuantities)[]).forEach((k) => {
        acc[k] = (acc[k] ?? 0) + (cv.sizes[k] ?? 0);
      });
      return acc;
    },
    { ...EMPTY_SIZES },
  );

  return {
    ...item,
    configuredProduct: cp,
    product: cp.productLabel || `${cp.styleNumber ?? ''} — ${cp.styleName ?? ''}`.replace(/^ — | — $/g, '').trim() || item.product,
    productColor: cp.colorVariants.length === 1 ? (primaryVariant?.color ?? item.productColor) : 'Multiple',
    apparelProvider: cp.vendorName ?? item.apparelProvider,
    serviceStyle: cp.decorationMethod as LineItem['serviceStyle'],
    garmentVariants,
    sizes: mergedSizes,
    location1: loc1,
    location2: loc2,
    location3: loc3,
    location4: loc4,
    locationDetails: cp.locationDetails ?? item.locationDetails,
    mockupUri: cp.mockupUri ?? item.mockupUri,
    productCostEach: cp.productCostEach,
    serviceCostEach: cp.serviceCostEach,
    serviceFeeEach: cp.serviceFeeEach,
    markupEach: cp.markupEach,
  };
}

/**
 * Merge a partial update into a ConfiguredProduct and return
 * the updated object (immutable).
 */
export function updateConfiguredProduct(
  cp: ConfiguredProduct,
  partial: Partial<ConfiguredProduct>,
): ConfiguredProduct {
  return { ...cp, ...partial };
}
