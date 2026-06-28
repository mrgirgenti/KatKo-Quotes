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

export interface UseProductCatalogParams {
  /** 'internal' uses the Clerk-gated /api/products; 'portal' uses the customer-safe hub endpoint. */
  mode: 'internal' | 'portal';
  /** Required for portal mode. */
  orgId?: string;
  /** Current style/product search query. */
  searchTerm?: string;
  /** Optional category filter. */
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
 * Mockup Designer surfaces. It abstracts the two very different transports:
 *
 *   internal → /api/products?q=&category= (server search) + per-id colors/vendors
 *   portal   → /api/portal/{orgId}/products (all products + embedded colors, no costs/vendors)
 *
 * Consumers always read the same normalized shape regardless of mode.
 */
export function useProductCatalog(params: UseProductCatalogParams): UseProductCatalogResult {
  const { mode, orgId, searchTerm = '', category = '', productId, enabled = true } = params;
  const isPortal = mode === 'portal';

  // Debounce the search term so internal server search isn't hammered per keystroke.
  const [debounced, setDebounced] = useState(searchTerm.trim());
  useEffect(() => {
    const h = setTimeout(() => setDebounced(searchTerm.trim()), 250);
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

  // ── INTERNAL: distinct categories ──
  const categoriesQuery = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => apiFetch('/api/products/categories'),
    enabled: enabled && !isPortal,
    staleTime: 5 * 60 * 1000,
  });

  // ── INTERNAL: server-side product search ──
  const searchQuery = useQuery({
    queryKey: ['cpe-product-search', debounced, category],
    queryFn: () => {
      let url = `/api/products?q=${encodeURIComponent(debounced)}`;
      if (category) url += `&category=${encodeURIComponent(category)}`;
      return apiFetch(url);
    },
    enabled: enabled && !isPortal && (debounced.length >= 2 || !!category),
    staleTime: 30000,
  });

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
  const categories: string[] = useMemo(() => {
    if (isPortal) {
      return Array.from(
        new Set(portalProducts.map((p) => p.category).filter((c): c is string => !!c)),
      ).sort();
    }
    return (categoriesQuery.data?.categories as string[] | undefined) ?? [];
  }, [isPortal, portalProducts, categoriesQuery.data]);

  const results: CatalogProductLite[] = useMemo(() => {
    if (isPortal) {
      const term = debounced.toLowerCase();
      return portalProducts.filter((p) => {
        if (category && (p.category || '') !== category) return false;
        if (!term) return true;
        const styleLabel = [p.styleNumber, p.name].filter(Boolean).join(' — ').toLowerCase();
        return (
          p.styleNumber?.toLowerCase().includes(term) ||
          p.name?.toLowerCase().includes(term) ||
          p.brand?.toLowerCase().includes(term) ||
          styleLabel.includes(term)
        );
      });
    }
    return (searchQuery.data?.products as CatalogProductLite[] | undefined) ?? [];
  }, [isPortal, portalProducts, debounced, category, searchQuery.data]);

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

  const isSearching = isPortal ? portalQuery.isFetching : searchQuery.isFetching;

  return { categories, results, colors, vendors, isSearching };
}
