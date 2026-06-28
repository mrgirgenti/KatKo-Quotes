import { GARMENTS, type GarmentType } from '@/components/MockupDesigner/garmentData';

/**
 * Map a Products-catalog category string (e.g. "T-Shirts", "Hoodies") to the
 * internal GarmentType used by the SVG silhouette renderer. Defaults to
 * 'tshirt' so a manual / unknown category still renders a sensible preview.
 */
export function categoryToGarmentType(category?: string | null): GarmentType {
  const c = (category || '').toLowerCase();
  if (c.includes('polo')) return 'polo';
  if (c.includes('crew')) return 'crewneck';
  if (c.includes('hood') || c.includes('sweat') || c.includes('fleece')) return 'hoodie';
  if (c.includes('hat') || c.includes('cap') || c.includes('beanie')) return 'hat';
  if (c.includes('long')) return 'longsleeve';
  return 'tshirt';
}

/** Luminance check so overlaid icons/labels contrast against a swatch color. */
export function isDarkHex(hex?: string | null): boolean {
  if (!hex) return false;
  const m = hex.replace('#', '');
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.5;
}

export interface PreviewResult {
  /** 'image' → render <Image uri>; 'svg' → render tinted garment silhouette. */
  kind: 'image' | 'svg';
  uri?: string;
  garmentType: GarmentType;
  /** Fill color for the SVG silhouette (or background tint behind an image). */
  hex: string;
  frontPath: string;
  backPath: string;
}

/**
 * Resolve the garment preview source. Priority (per architecture plan):
 *   1. an explicit per-color asset image (colorAssetUri)
 *   2. the catalog product image (productImageUrl)
 *   3. a tinted SVG silhouette derived from the category + selected color hex
 */
export function resolvePreview(opts: {
  category?: string | null;
  productImageUrl?: string | null;
  colorAssetUri?: string | null;
  colorHex?: string | null;
}): PreviewResult {
  const garmentType = categoryToGarmentType(opts.category);
  const def = GARMENTS[garmentType];
  const hex = opts.colorHex || def.defaultColor;
  const base = { garmentType, hex, frontPath: def.frontPath, backPath: def.backPath };
  if (opts.colorAssetUri) return { kind: 'image', uri: opts.colorAssetUri, ...base };
  if (opts.productImageUrl) return { kind: 'image', uri: opts.productImageUrl, ...base };
  return { kind: 'svg', ...base };
}

/** Curated top-level product categories surfaced as large clickable tiles. */
export const PRIMARY_CATEGORY_TILES: string[] = [
  'T-Shirts',
  'Polos',
  'Crewnecks',
  'Hoodies',
  'Hats',
];
