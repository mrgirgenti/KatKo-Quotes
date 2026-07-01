import { useQuery } from '@tanstack/react-query';

export interface ServiceStyleRecord {
  id: string;
  name: string;
  supplier?: string;
  defaultMargin?: number;
  defaultProductionDays?: number;
  defaultProductionCosts: string[];
  defaultArtworkRequirements?: string;
  defaultTaxBehavior: string;
  description?: string;
  enabled: boolean;
  sortOrder: number;
}

export function useServiceStyles() {
  const { data = [] } = useQuery<ServiceStyleRecord[]>({
    queryKey: ['service-styles'],
    queryFn: async () => {
      const r = await fetch('/api/service-styles');
      if (!r.ok) throw new Error('Failed to load service styles');
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });
  return data;
}

export function useEnabledServiceStyles() {
  const all = useServiceStyles();
  return all.filter((s) => s.enabled);
}
