import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { isDarkHex } from '@/utils/garmentPreview';

export interface NormalizedColor {
  name: string;
  hex: string;
  dark: boolean;
  colorId?: string;
}

export interface CatalogProductLite {
  id: string;
  styleNumber: string;
  brand: string;
  name: string;
  category?: string | null;
  defaultBlankCost?: string | number | null;
  /** Embedded colors (portal mode returns these inline). */
  colors?: NormalizedColor[];
}

export interface VendorSourceInfo {
  name: string;
  isPreferred: boolean;
}

interface RawColorRow {
  id?: string;
  colorName?: string;
  hex?: string | null;
}

function normalizeColors(rows: RawColorRow[] | undefined): NormalizedColor[] {
  if (!rows?.length) return [];
  return rows.map((c) => ({
    name: c.colorName ?? '',
    hex: c.hex || '#cccccc',
    dark: isDarkHex(c.hex),
    colorId: c.id,
  }));
}

/**
 * Maps a display-tile name (e.g. "T-Shirts") to a product by inspecting
 * product name keywords. DB uses broad categories ("Apparel", "Headwear"),
 * not the fine-grained tile names, so we keyword-match on product name.
 */
function matchesCategoryTile(p: CatalogProductLite, tile: string): boolean {
  const nameLow = (p.name ?? '').toLowerCase();
  const catLow  = (p.category ?? '').toLowerCase();
  switch (tile) {
    case 'T-Shirts':
      return nameLow.includes('tee') || nameLow.includes('t-shirt') || nameLow.includes('jersey');
    case 'Polos':
      return nameLow.includes('polo');
    case 'Crewnecks':
      return nameLow.includes('crewneck') || (nameLow.includes('crew') && !nameLow.includes('tee'));
    case 'Hoodies':
      return nameLow.includes('hoodie') ||
             nameLow.includes('sweatshirt') ||
             (nameLow.includes('pullover') && !nameLow.includes('polo')) ||
             (nameLow.includes('zip') && !nameLow.includes('polo'));
    case 'Hats':
      return catLow === 'headwear' ||
             nameLow.includes('hat') ||
             nameLow.includes('cap') ||
             nameLow.includes('trucker');
    default:
      return catLow.includes(tile.toLowerCase()) || nameLow.includes(tile.toLowerCase());
  }
}

export interface UseProductCatalogParams {
  /** 'internal' uses the Clerk-gated /api/products; 'portal' uses the customer-safe hub endpoint. */
  mode: 'internal' | 'portal';
  /** Required for portal mode. */
  orgId?: string;
  /** Current style/product search query. */
  searchTerm?: string;
  /** Optional category filter (tile name like "T-Shirts" or actual DB category). */
  category?: string;
  /** Active product whose colors/vendors should be loaded. */
  productId?: string;
  /** Master switch (e.g. disable while a section is collapsed). */
  enabled?: boolean;
}

export interface UseProductCatalogResult {
  categories: string[];
  results: CatalogProductLite[];
  /** Colors for the active `productId`. */
  colors: NormalizedColor[];
  /** Vendor sources for the active `productId` (internal mode only; portal = []). */
  vendors: VendorSourceInfo[];
  isSearching: boolean;
}

/**
 * Single catalog-access hook shared by the internal Quote, Client Hub, and
 * Mockup Designer surfaces.
 *
 * Both modes now load ALL products once and filter client-side:
 *   internal → /api/products (all active, Clerk-gated) + per-id colors/vendors
 *   portal   → /api/portal/{orgId}/products (all products + embedded colors, no costs)
 *
 * Category tiles (T-Shirts, Polos, etc.) are matched by product-name keywords
 * because the DB uses broad categories ("Apparel", "Headwear"), not the fine-
 * grained tile names.
 */
export function useProductCatalog(params: UseProductCatalogParams): UseProductCatalogResult {
  const { mode, orgId, searchTerm = '', category = '', productId, enabled = true } = params;
  const isPortal = mode === 'portal';

  // Debounce the search term for a snappy but not-spammy client-side filter.
  const [debounced, setDebounced] = useState(searchTerm.trim());
  useEffect(() => {
    const h = setTimeout(() => setDebounced(searchTerm.trim()), 150);
    return () => clearTimeout(h);
  }, [searchTerm]);

  // ── PORTAL: one fetch of all products (colors embedded), filtered client-side ──
  const portalQuery = useQuery({
    queryKey: ['portal-catalog-products', orgId],
    queryFn: async () => {
      const res = await fetch(`/api/portal/${orgId}/products`);
      if (!res.ok) throw new Error('Failed to load products');
      return res.json();
    },
    enabled: enabled && isPortal && !!orgId,
    staleTime: 5 * 60 * 1000,
  });
  const portalProducts: CatalogProductLite[] = useMemo(() => {
    const rows = (portalQuery.data?.products as any[] | undefined) ?? [];
    return rows.map((p) => ({
      id: p.id,
      styleNumber: p.styleNumber,
      brand: p.brand,
      name: p.name,
      category: p.category,
      colors: normalizeColors(p.colors),
    }));
  }, [portalQuery.data]);

  // ── INTERNAL: load all active products once, filter client-side ──
  const internalAllQuery = useQuery({
    queryKey: ['internal-all-products'],
    queryFn: () => apiFetch('/api/products'),
    enabled: enabled && !isPortal,
    staleTime: 5 * 60 * 1000,
  });
  const internalAllProducts: CatalogProductLite[] = useMemo(() => {
    const rows = (internalAllQuery.data?.products as any[] | undefined) ?? [];
    return rows.map((p) => ({
      id: p.id,
      styleNumber: p.styleNumber ?? '',
      brand: p.brand ?? '',
      name: p.name ?? '',
      category: p.category ?? null,
      defaultBlankCost: p.defaultBlankCost,
    }));
  }, [internalAllQuery.data]);

  // ── INTERNAL: colors for the active product ──
  const colorsQuery = useQuery({
    queryKey: ['product-colors', productId],
    queryFn: () => apiFetch(`/api/products/${productId}/colors`),
    enabled: enabled && !isPortal && !!productId,
    staleTime: 60000,
  });

  // ── INTERNAL: vendor sources for the active product ──
  const vendorsQuery = useQuery({
    queryKey: ['product-vendor-sources', productId],
    queryFn: () => apiFetch(`/api/products/${productId}/vendor-sources`),
    enabled: enabled && !isPortal && !!productId,
    staleTime: 60000,
  });

  // ── Derive unified outputs ──
  const allProducts = isPortal ? portalProducts : internalAllProducts;

  const categories: string[] = useMemo(() => {
    return Array.from(
      new Set(allProducts.map((p) => p.category).filter((c): c is string => !!c)),
    ).sort();
  }, [allProducts]);

  const results: CatalogProductLite[] = useMemo(() => {
    const term = debounced.toLowerCase();
    return allProducts.filter((p) => {
      if (category) {
        if (isPortal) {
          if ((p.category || '') !== category) return false;
        } else {
          if (!matchesCategoryTile(p, category)) return false;
        }
      }
      if (!term) return true;
      return (
        p.styleNumber?.toLowerCase().includes(term) ||
        p.name?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term)
      );
    });
  }, [allProducts, debounced, category, isPortal]);

  const colors: NormalizedColor[] = useMemo(() => {
    if (isPortal) {
      if (!productId) return [];
      return portalProducts.find((p) => p.id === productId)?.colors ?? [];
    }
    return normalizeColors(colorsQuery.data?.colors as RawColorRow[] | undefined);
  }, [isPortal, productId, portalProducts, colorsQuery.data]);

  const vendors: VendorSourceInfo[] = useMemo(() => {
    if (isPortal) return [];
    const rows = (vendorsQuery.data?.sources as any[] | undefined) ?? [];
    return rows
      .filter((s) => s.isActive !== false)
      .map((s) => ({ name: s.vendorName as string, isPreferred: !!s.isPreferred }));
  }, [isPortal, vendorsQuery.data]);

  const isSearching = isPortal ? portalQuery.isFetching : internalAllQuery.isFetching;

  return { categories, results, colors, vendors, isSearching };
}
