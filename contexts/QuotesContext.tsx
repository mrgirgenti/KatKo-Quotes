import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Quote, SalesData, LineItemActualCosts, QuoteStatus } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';

const QUOTES_STORAGE_KEY = 'printshop_quotes';

function migrateQuote(q: any): Quote {
  let status: QuoteStatus = q.status;
  if ((q.status as string) === 'submitted') status = 'quoted';
  if ((q.status as string) === 'sale') {
    status = q.salesData?.completedDate ? 'completed' : 'active';
  }
  return { ...q, status };
}

function nowDateStr(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

export const [QuotesProvider, useQuotes] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { currentUserId, currentUser } = useUser();

  const quotesQuery = useQuery<Quote[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      try {
        const serverQuotes: Quote[] = await apiFetch('/api/projects');
        if (serverQuotes.length === 0) {
          const localData = await AsyncStorage.getItem(QUOTES_STORAGE_KEY).catch(() => null);
          if (localData) {
            const raw: any[] = JSON.parse(localData);
            const localQuotes = raw.map(migrateQuote);
            if (localQuotes.length > 0) {
              await apiFetch('/api/migrate', {
                method: 'POST',
                body: JSON.stringify({ quotes: localQuotes }),
              }).catch(() => null);
              return apiFetch('/api/projects');
            }
          }
        }
        return serverQuotes;
      } catch (err) {
        console.error('[QuotesContext] loadQuotes failed', err);
        return [];
      }
    },
    staleTime: 1000 * 30,
  });

  const invalidateQuotes = () => queryClient.invalidateQueries({ queryKey: ['quotes'] });

  const addQuoteMutation = useMutation({
    mutationFn: async (newQuote: Quote) => {
      const quoteWithUser = { ...newQuote, userId: currentUserId ?? undefined };
      return apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(quoteWithUser) });
    },
    onSuccess: (savedQuote: Quote) => {
      // Immediately inject the server-returned quote into the cache so the detail
      // screen can find it the instant we navigate — no "Quote not found" flash.
      queryClient.setQueryData<Quote[]>(['quotes'], (old) => [savedQuote, ...(old || [])]);
      // Then mark stale so a background refetch keeps everything consistent.
      invalidateQuotes();
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (updatedQuote: Quote) => {
      return apiFetch(`/api/projects/${updatedQuote.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedQuote),
      });
    },
    onSuccess: (savedQuote: Quote) => {
      queryClient.setQueryData<Quote[]>(['quotes'], (old) =>
        (old || []).map((q) => (q.id === savedQuote.id ? savedQuote : q)),
      );
      invalidateQuotes();
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiFetch(`/api/projects/${quoteId}`, { method: 'DELETE' });
    },
    onSuccess: invalidateQuotes,
  });

  const convertToActiveMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const lineItemCosts: LineItemActualCosts[] = q.lineItems.map((item) => {
        const itemQty = Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
        return {
          lineItemId: item.id,
          actualProductCost: item.productCostEach * itemQty,
          productVendor: item.apparelProvider,
          actualServiceCost: item.serviceCostEach * itemQty,
          applicator: item.applicator || 'Katalyst Ko Printshop',
          actualServiceFeesCost: item.serviceFeeEach,
          actualServiceFeesProfit: 0,
          actualOtherCosts: 0,
          otherCostsDescription: '',
        };
      });
      const updated: Quote = {
        ...q,
        status: 'active',
        activeDate: dateStr,
        operationalStatus: q.operationalStatus || 'Accepted',
        salesData: {
          convertedDate: dateStr,
          completedDate: '',
          actualProductCost: q.calculations.productCostTotal,
          productVendors: [...new Set(q.lineItems.map((item) => item.apparelProvider))],
          actualServiceCost: q.calculations.serviceCostTotal,
          applicator: q.lineItems[0]?.applicator || 'Katalyst Ko Printshop',
          actualServiceFeesCost: q.calculations.serviceFeeTotal,
          actualServiceFeesProfit: 0,
          actualOtherCosts: 0,
          otherCostsDescription: '',
          actualOnlineFee: q.hasOnlineFee ? q.calculations.onlineFee : 0,
          actualSalesTax: q.hasSalesTax ? q.calculations.salesTax : 0,
          actualCardFee: q.hasCardFee ? q.calculations.cardFee : 0,
          amountCollected: q.calculations.total,
          notes: '',
          lineItemCosts,
        },
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const markProjectCompleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = {
        ...q,
        status: 'completed',
        lineItems: q.lineItems.map((item) => ({ ...item, completedAt: item.completedAt || dateStr })),
        salesData: q.salesData ? { ...q.salesData, completedDate: dateStr } : undefined,
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const markLineItemCompleteMutation = useMutation({
    mutationFn: async ({ quoteId, lineItemId }: { quoteId: string; lineItemId: string }) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updatedItems = q.lineItems.map((item) =>
        item.id === lineItemId ? { ...item, completedAt: dateStr } : item,
      );
      const allDone = updatedItems.every((item) => !!item.completedAt);
      const updated: Quote = {
        ...q,
        lineItems: updatedItems,
        status: allDone ? 'completed' : q.status,
        salesData: allDone && q.salesData ? { ...q.salesData, completedDate: dateStr } : q.salesData,
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const unmarkLineItemCompleteMutation = useMutation({
    mutationFn: async ({ quoteId, lineItemId }: { quoteId: string; lineItemId: string }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updatedItems = q.lineItems.map((item) =>
        item.id === lineItemId ? { ...item, completedAt: undefined } : item,
      );
      const revertStatus: QuoteStatus = q.status === 'completed' ? 'production_started' : q.status;
      const updated: Quote = {
        ...q,
        lineItems: updatedItems,
        status: revertStatus,
        salesData: q.salesData ? { ...q.salesData, completedDate: '' } : q.salesData,
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const startProductionMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      if (q.status !== 'paid' && q.status !== 'active' && q.status !== 'production_started') {
        throw new Error('Project must be marked as Paid before entering production.');
      }
      let updated: Quote;
      if (q.salesData) {
        updated = { ...q, status: 'production_started' };
      } else {
        const lineItemCosts: LineItemActualCosts[] = q.lineItems.map((item) => {
          const itemQty = Object.values(item.sizes).reduce((sum, qty) => sum + qty, 0);
          return {
            lineItemId: item.id,
            actualProductCost: item.productCostEach * itemQty,
            productVendor: item.apparelProvider,
            actualServiceCost: item.serviceCostEach * itemQty,
            applicator: item.applicator || 'Katalyst Ko Printshop',
            actualServiceFeesCost: item.serviceFeeEach,
            actualServiceFeesProfit: 0,
            actualOtherCosts: 0,
            otherCostsDescription: '',
          };
        });
        updated = {
          ...q,
          status: 'production_started',
          activeDate: dateStr,
          salesData: {
            convertedDate: dateStr,
            completedDate: '',
            actualProductCost: q.calculations.productCostTotal,
            productVendors: [...new Set(q.lineItems.map((item) => item.apparelProvider))],
            actualServiceCost: q.calculations.serviceCostTotal,
            applicator: q.lineItems[0]?.applicator || 'Katalyst Ko Printshop',
            actualServiceFeesCost: q.calculations.serviceFeeTotal,
            actualServiceFeesProfit: 0,
            actualOtherCosts: 0,
            otherCostsDescription: '',
            actualOnlineFee: q.hasOnlineFee ? q.calculations.onlineFee : 0,
            actualSalesTax: q.hasSalesTax ? q.calculations.salesTax : 0,
            actualCardFee: q.hasCardFee ? q.calculations.cardFee : 0,
            amountCollected: q.calculations.total,
            notes: '',
            lineItemCosts,
          },
        };
      }
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const updateSalesDataMutation = useMutation({
    mutationFn: async ({
      quoteId,
      salesData,
      updatedLineItems,
    }: { quoteId: string; salesData: SalesData; updatedLineItems?: Quote['lineItems'] }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = {
        ...q,
        salesData,
        lineItems: updatedLineItems || q.lineItems,
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const revertToQuotedMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, status: 'quoted', salesData: undefined, activeDate: undefined };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const lockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, isLocked: true, lockedDate: nowDateStr() };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const unlockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, isLocked: false, lockedDate: undefined };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const markExportedToSheetsMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const dateStr = nowDateStr();
      const updated: Quote = {
        ...q,
        exportedToSheets: true,
        exportedToSheetsDate: dateStr,
        isLocked: true,
        lockedDate: dateStr,
      };
      return apiFetch(`/api/projects/${quoteId}`, { method: 'PUT', body: JSON.stringify(updated) });
    },
    onSuccess: invalidateQuotes,
  });

  const actorName = currentUser?.name || 'Someone';

  const setOperationalStatusMutation = useMutation({
    mutationFn: async ({
      quoteId,
      status,
      holdReason,
      holdNotes,
    }: {
      quoteId: string;
      status: import('@/types/quote').OperationalProjectStatus;
      holdReason?: string | null;
      holdNotes?: string | null;
    }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const goingOnHold = status === 'On Hold';
      const updated: Quote = {
        ...q,
        operationalStatus: status,
        holdReason: goingOnHold ? (holdReason ?? null) : null,
        holdNotes: goingOnHold ? (holdNotes ?? null) : null,
        holdPlacedAt: goingOnHold ? new Date().toISOString() : null,
        holdPlacedBy: goingOnHold ? actorName : null,
      };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  const setDeliveryMethodMutation = useMutation({
    mutationFn: async ({
      quoteId,
      deliveryMethod,
    }: { quoteId: string; deliveryMethod: import('@/types/quote').DeliveryMethod | null }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, deliveryMethod };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  const setIndicatorMutation = useMutation({
    mutationFn: async ({
      quoteId,
      key,
      value,
    }: { quoteId: string; key: 'paymentReceived' | 'artworkReceived' | 'proofApproved'; value: boolean }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, [key]: value };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  const setPriorityMutation = useMutation({
    mutationFn: async ({
      quoteId,
      priority,
    }: { quoteId: string; priority: import('@/types/quote').ProjectPriority }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, priority };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  const setAssigneeMutation = useMutation({
    mutationFn: async ({
      quoteId,
      assignedToUserId,
    }: { quoteId: string; assignedToUserId: string | null }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, assignedToUserId };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  const setRushMutation = useMutation({
    mutationFn: async ({
      quoteId,
      rush,
    }: { quoteId: string; rush: boolean }) => {
      const current = quotesQuery.data || [];
      const q = current.find((x) => x.id === quoteId);
      if (!q) throw new Error('Quote not found');
      const updated: Quote = { ...q, rush };
      return apiFetch(`/api/projects/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updated, actorName }),
      });
    },
    onSuccess: invalidateQuotes,
  });

  // Treat "no user loaded yet" as admin so quotes are visible during initialization.
  // Only enforce per-user filtering once a real non-admin user is confirmed.
  const isAdmin = !currentUser || currentUser.role === 'org_admin';
  const userQuotes = isAdmin
    ? (quotesQuery.data || [])
    : (quotesQuery.data || []).filter((q) => q.userId === currentUserId);

  const projects = userQuotes.filter((q) => q.status !== 'draft');
  const quotes = userQuotes.filter((q) => q.status !== 'draft');
  const sales = userQuotes.filter(
    (q) => q.status === 'active' || q.status === 'production_started' || q.status === 'completed',
  );
  // Production lens: only projects that have entered the operational workflow.
  const productionProjects = userQuotes.filter((q) => !!q.operationalStatus);

  return {
    quotes,
    projects,
    allQuotes: quotesQuery.data || [],
    sales,
    productionProjects,
    isLoading: quotesQuery.isLoading,
    addQuote: addQuoteMutation.mutate,
    updateQuote: updateQuoteMutation.mutate,
    updateQuoteAsync: updateQuoteMutation.mutateAsync,
    deleteQuote: deleteQuoteMutation.mutate,
    convertToSale: convertToActiveMutation.mutate,
    convertToActive: convertToActiveMutation.mutate,
    convertToQuote: revertToQuotedMutation.mutate,
    startProduction: startProductionMutation.mutate,
    markProjectComplete: markProjectCompleteMutation.mutate,
    markLineItemComplete: markLineItemCompleteMutation.mutate,
    unmarkLineItemComplete: unmarkLineItemCompleteMutation.mutate,
    updateSalesData: updateSalesDataMutation.mutate,
    lockSale: lockSaleMutation.mutate,
    unlockSale: unlockSaleMutation.mutate,
    markExportedToSheets: markExportedToSheetsMutation.mutate,
    setOperationalStatus: setOperationalStatusMutation.mutate,
    setOperationalStatusAsync: setOperationalStatusMutation.mutateAsync,
    isSettingOperationalStatus: setOperationalStatusMutation.isPending,
    setDeliveryMethod: setDeliveryMethodMutation.mutate,
    setIndicator: setIndicatorMutation.mutate,
    setPriority: setPriorityMutation.mutate,
    setPriorityAsync: setPriorityMutation.mutateAsync,
    isSettingPriority: setPriorityMutation.isPending,
    setAssignee: setAssigneeMutation.mutate,
    setAssigneeAsync: setAssigneeMutation.mutateAsync,
    setRush: setRushMutation.mutate,
    setRushAsync: setRushMutation.mutateAsync,
    isSettingRush: setRushMutation.isPending,
    isAdding: addQuoteMutation.isPending,
    isConverting: convertToActiveMutation.isPending,
    isLocking: lockSaleMutation.isPending,
    isCompletingProject: markProjectCompleteMutation.isPending,
  };
});
