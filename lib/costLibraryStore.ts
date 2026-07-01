import { useQuery } from '@tanstack/react-query';
import type { CostLibraryEntry } from '@/components/CostLibraryTable';

export type LibraryKind = 'production' | 'other';

/**
 * Reactive hook for a single library's ENABLED items only (dialog picker source).
 * Data is fetched from the API and cached by React Query.
 * Used by AddAdjustmentModal — do not remove.
 */
export function useEnabledLibraryItems(kind: LibraryKind): CostLibraryEntry[] {
  const { data = [] } = useQuery<CostLibraryEntry[]>({
    queryKey: ['cost-library', kind],
    queryFn: async () => {
      const r = await fetch(`/api/cost-library?category=${kind}`);
      if (!r.ok) return [];
      return r.json();
    },
    networkMode: 'always',
    staleTime: 30_000,
  });
  return data.filter((i) => i.enabled);
}
