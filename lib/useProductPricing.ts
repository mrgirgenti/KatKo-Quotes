import { useQuery } from '@tanstack/react-query';

export interface ProductPricingSettings {
  upcharges: Record<string, number>;
  overrides: Array<{ id: string; product: string; size: string; amount: number }>;
}

const DEFAULTS: ProductPricingSettings = {
  upcharges: { '2XL': 2, '3XL': 4, '4XL': 6, '5XL': 8, '6XL': 10 },
  overrides: [],
};

/**
 * Loads Product Pricing settings (size upcharges + product overrides) from
 * AppSettings. Falls back to sensible defaults when no row is saved yet.
 */
export function useProductPricing(): ProductPricingSettings {
  const { data } = useQuery<ProductPricingSettings | null>({
    queryKey: ['app-settings', 'product_pricing'],
    queryFn: async () => {
      const r = await fetch('/api/app-settings/product_pricing');
      if (!r.ok) return null;
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });

  return {
    upcharges: data?.upcharges ?? DEFAULTS.upcharges,
    overrides: data?.overrides ?? DEFAULTS.overrides,
  };
}
