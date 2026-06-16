import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/contexts/UserContext';
import type { ProductionFilters, SortField, SortDir } from '@/lib/production';
import { EMPTY_FILTERS } from '@/lib/production';

export type ProductionViewType = 'board' | 'queue' | 'calendar' | 'analytics';

export interface ProductionView {
  id: string;
  name: string;
  view: ProductionViewType;
  filters: ProductionFilters;
  sortField: SortField;
  sortDir: SortDir;
}

interface StoredState {
  views: ProductionView[];
  defaultViewId: string | null;
}

const KEY_PREFIX = 'production_views_';

function storageKey(userId: string | null): string {
  return `${KEY_PREFIX}${userId || 'default'}`;
}

export function useProductionViews() {
  const { currentUserId } = useUser();
  const [views, setViews] = useState<ProductionView[]>([]);
  const [defaultViewId, setDefaultViewId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(currentUserId));
        if (cancelled) return;
        if (raw) {
          const parsed: StoredState = JSON.parse(raw);
          setViews(Array.isArray(parsed.views) ? parsed.views : []);
          setDefaultViewId(parsed.defaultViewId ?? null);
        } else {
          setViews([]);
          setDefaultViewId(null);
        }
      } catch {
        setViews([]);
        setDefaultViewId(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const persist = useCallback(async (nextViews: ProductionView[], nextDefault: string | null) => {
    setViews(nextViews);
    setDefaultViewId(nextDefault);
    try {
      await AsyncStorage.setItem(
        storageKey(currentUserId),
        JSON.stringify({ views: nextViews, defaultViewId: nextDefault } as StoredState),
      );
    } catch {
      // best-effort; in-memory state already updated
    }
  }, [currentUserId]);

  const saveView = useCallback((view: Omit<ProductionView, 'id'>) => {
    const id = `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const next: ProductionView = { ...view, id };
    persist([...views, next], defaultViewId);
    return next;
  }, [views, defaultViewId, persist]);

  const deleteView = useCallback((id: string) => {
    persist(views.filter((v) => v.id !== id), defaultViewId === id ? null : defaultViewId);
  }, [views, defaultViewId, persist]);

  const setDefaultView = useCallback((id: string | null) => {
    persist(views, id);
  }, [views, persist]);

  const defaultView = views.find((v) => v.id === defaultViewId) ?? null;

  return {
    views,
    defaultView,
    defaultViewId,
    loaded,
    saveView,
    deleteView,
    setDefaultView,
  };
}

export const EMPTY_PRODUCTION_FILTERS = EMPTY_FILTERS;
