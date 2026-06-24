import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { getClerkToken } from '@/lib/clerkToken';
import { ACTION_CATEGORY } from '@/types/actions';
import type { ActionCategory, ActionItemWithContext } from '@/types/actions';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getClerkToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export const [ActionsProvider, useActions] = createContextHook(() => {
  const queryClient = useQueryClient();

  const actionsQuery = useQuery<ActionItemWithContext[]>({
    queryKey: ['actions'],
    queryFn: () => apiFetch('/api/actions'),
    staleTime: 30_000,
    networkMode: 'always',
  });

  const actions = actionsQuery.data ?? [];

  const unresolvedCount = actions.filter(a => a.status !== 'RESOLVED').length;

  const countByCategory = (category: ActionCategory) =>
    actions.filter(a => ACTION_CATEGORY[a.type] === category && a.status !== 'RESOLVED').length;

  const markViewedMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/actions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'VIEWED' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });

  const markResolvedMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/actions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'RESOLVED' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });

  return {
    actions,
    isLoading: actionsQuery.isLoading,
    unresolvedCount,
    needsReviewCount: countByCategory('NEEDS_REVIEW'),
    customerRequestsCount: countByCategory('CUSTOMER_REQUESTS'),
    productionIssuesCount: countByCategory('PRODUCTION_ISSUES'),
    systemAlertsCount: countByCategory('SYSTEM_ALERTS'),
    markViewed: (id: string) => markViewedMutation.mutate(id),
    markResolved: (id: string) => markResolvedMutation.mutate(id),
    refetch: () => queryClient.invalidateQueries({ queryKey: ['actions'] }),
  };
});
