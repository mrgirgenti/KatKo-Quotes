import type { SizeQuantities } from '@/types/quote';
import type { ConfiguredProduct, ConfiguredColorVariant } from '@/types/configuredProduct';

const EMPTY_SIZES: SizeQuantities = {
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
};

/** Coerce a loose sizes record from portal JSON into a full SizeQuantities shape. */
function normalizeSizes(raw: Record<string, number> | SizeQuantities | undefined): SizeQuantities {
  if (!raw) return { ...EMPTY_SIZES };
  return {
    xs:    typeof raw.xs    === 'number' ? raw.xs    : 0,
    s:     typeof raw.s     === 'number' ? raw.s     : 0,
    m:     typeof raw.m     === 'number' ? raw.m     : 0,
    l:     typeof raw.l     === 'number' ? raw.l     : 0,
    xl:    typeof raw.xl    === 'number' ? raw.xl    : 0,
    xxl:   typeof raw.xxl   === 'number' ? raw.xxl   : 0,
    xxxl:  typeof raw.xxxl  === 'number' ? raw.xxxl  : 0,
    xxxxl: typeof raw.xxxxl === 'number' ? raw.xxxxl : 0,
    flat:  typeof raw.flat  === 'number' ? raw.flat  : 0,
  };
}

/**
 * A portal line item shape (subset) — only the fields needed for grouping.
 * Keeping this minimal so the function is easily unit-testable without importing
 * the full server environment.
 */
export interface PortalLineItemShape {
  garmentVariants?: Array<{
    productId?: string;
    product?: string;
    color?: string;
    sizes?: Record<string, number> | SizeQuantities;
    productSource?: string;
    styleNumber?: string;
    productName?: string;
    brand?: string;
    category?: string;
  }>;
  location1?: string;
  location2?: string;
  location3?: string;
  location4?: string;
  locationDetails?: string;
  mockupUri?: string;
  serviceStyle?: string;
}

/**
 * Convert the Client Hub's variant-based line item (each "Add Another Product /
 * Color" row is a garmentVariant) into the canonical multi-product products[].
 * Rows that share a product identity (same productId, else same product label)
 * are grouped into ONE product with multiple colorVariants — exactly how the staff
 * expanded editor models a design — so no per-garment identity is lost. Pricing is
 * always zeroed; `costFor` supplies the internal blank-cost (COGS) reference only.
 */
export function portalVariantsToProducts(
  item: PortalLineItemShape,
  costFor: (productId?: string) => number,
): ConfiguredProduct[] {
  const variants = Array.isArray(item?.garmentVariants) ? item.garmentVariants : [];
  if (variants.length === 0) return [];

  const printLocations = [item?.location1, item?.location2, item?.location3, item?.location4]
    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0);

  const groups = new Map<string, ConfiguredProduct>();
  for (const v of variants) {
    const key =
      (v?.productId && `id:${String(v.productId)}`) ||
      `label:${String(v?.product ?? '').trim().toLowerCase()}`;
    const color = typeof v?.color === 'string' ? v.color : '';
    const sizes = normalizeSizes(v?.sizes);
    const colorVariant: ConfiguredColorVariant = { color, sizes };
    const existing = groups.get(key);
    if (existing) {
      existing.colorVariants.push(colorVariant);
    } else {
      groups.set(key, {
        productSource: v?.productSource === 'catalog' ? 'catalog' : 'manual',
        productId: v?.productId,
        productLabel: v?.product || undefined,
        styleNumber: v?.styleNumber,
        styleName: v?.productName,
        brand: v?.brand,
        category: v?.category,
        productType: v?.category,
        decorationMethod: item?.serviceStyle || 'Screen Printing',
        colorVariants: [colorVariant],
        printLocations,
        locationDetails: item?.locationDetails || undefined,
        mockupUri: item?.mockupUri || undefined,
        artworkLayers: [],
        templateSettings: {},
        productCostEach: costFor(v?.productId),
        serviceCostEach: 0,
        serviceFeeEach: 0,
        markupEach: 0,
      });
    }
  }
  return Array.from(groups.values());
}
