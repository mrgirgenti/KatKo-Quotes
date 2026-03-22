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

async function loadQuotes(): Promise<Quote[]> {
  try {
    const stored = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
    if (!stored) return [];
    const raw: any[] = JSON.parse(stored);
    return raw.map(migrateQuote);
  } catch (error) {
    console.log('Error loading quotes:', error);
    return [];
  }
}

async function saveQuotes(quotes: Quote[]): Promise<Quote[]> {
  try {
    await AsyncStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
    return quotes;
  } catch (error) {
    console.log('Error saving quotes:', error);
    throw error;
  }
}

function nowDateStr(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
}

export const [QuotesProvider, useQuotes] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { currentUserId } = useUser();

  const quotesQuery = useQuery({
    queryKey: ['quotes'],
    queryFn: loadQuotes,
  });

  const addQuoteMutation = useMutation({
    mutationFn: async (newQuote: Quote) => {
      const current = quotesQuery.data || [];
      const quoteWithUser = { ...newQuote, userId: currentUserId || 'default' };
      const updated = [quoteWithUser, ...current];
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (updatedQuote: Quote) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => q.id === updatedQuote.id ? updatedQuote : q);
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.filter(q => q.id !== quoteId);
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const convertToActiveMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q => {
        if (q.id === quoteId) {
          const lineItemCosts: LineItemActualCosts[] = q.lineItems.map(item => {
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
          return {
            ...q,
            status: 'active' as QuoteStatus,
            activeDate: dateStr,
            salesData: {
              convertedDate: dateStr,
              completedDate: '',
              actualProductCost: q.calculations.productCostTotal,
              productVendors: [...new Set(q.lineItems.map(item => item.apparelProvider))],
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
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const markProjectCompleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q => {
        if (q.id === quoteId) {
          const completedItems = q.lineItems.map(item => ({
            ...item,
            completedAt: item.completedAt || dateStr,
          }));
          return {
            ...q,
            status: 'completed' as QuoteStatus,
            lineItems: completedItems,
            salesData: q.salesData
              ? { ...q.salesData, completedDate: dateStr }
              : undefined,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const markLineItemCompleteMutation = useMutation({
    mutationFn: async ({ quoteId, lineItemId }: { quoteId: string; lineItemId: string }) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q => {
        if (q.id !== quoteId) return q;
        const updatedItems = q.lineItems.map(item =>
          item.id === lineItemId ? { ...item, completedAt: dateStr } : item
        );
        const allDone = updatedItems.every(item => !!item.completedAt);
        return {
          ...q,
          lineItems: updatedItems,
          status: allDone ? ('completed' as QuoteStatus) : q.status,
          salesData: allDone && q.salesData
            ? { ...q.salesData, completedDate: dateStr }
            : q.salesData,
        };
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const unmarkLineItemCompleteMutation = useMutation({
    mutationFn: async ({ quoteId, lineItemId }: { quoteId: string; lineItemId: string }) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => {
        if (q.id !== quoteId) return q;
        const updatedItems = q.lineItems.map(item =>
          item.id === lineItemId ? { ...item, completedAt: undefined } : item
        );
        const revertStatus: QuoteStatus = q.status === 'completed' ? 'production_started' : q.status;
        return {
          ...q,
          lineItems: updatedItems,
          status: revertStatus,
          salesData: q.salesData ? { ...q.salesData, completedDate: '' } : q.salesData,
        };
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const startProductionMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q => {
        if (q.id !== quoteId) return q;
        if (q.salesData) {
          return { ...q, status: 'production_started' as QuoteStatus };
        }
        const lineItemCosts: LineItemActualCosts[] = q.lineItems.map(item => {
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
        return {
          ...q,
          status: 'production_started' as QuoteStatus,
          activeDate: dateStr,
          salesData: {
            convertedDate: dateStr,
            completedDate: '',
            actualProductCost: q.calculations.productCostTotal,
            productVendors: [...new Set(q.lineItems.map(item => item.apparelProvider))],
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
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const updateSalesDataMutation = useMutation({
    mutationFn: async ({ quoteId, salesData, updatedLineItems }: { quoteId: string; salesData: SalesData; updatedLineItems?: Quote['lineItems'] }) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            salesData,
            lineItems: updatedLineItems || q.lineItems,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const revertToQuotedMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            status: 'quoted' as QuoteStatus,
            salesData: undefined,
            activeDate: undefined,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const lockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q =>
        q.id === quoteId ? { ...q, isLocked: true, lockedDate: dateStr } : q
      );
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const unlockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q =>
        q.id === quoteId ? { ...q, isLocked: false, lockedDate: undefined } : q
      );
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const markExportedToSheetsMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const dateStr = nowDateStr();
      const updated = current.map(q =>
        q.id === quoteId
          ? { ...q, exportedToSheets: true, exportedToSheetsDate: dateStr, isLocked: true, lockedDate: dateStr }
          : q
      );
      return saveQuotes(updated);
    },
    onSuccess: (data) => { queryClient.setQueryData(['quotes'], data); },
  });

  const userQuotes = (quotesQuery.data || []).filter(q =>
    !q.userId || q.userId === currentUserId || q.userId === 'default'
  );

  const projects = userQuotes.filter(q => q.status !== 'draft');
  const quotes = userQuotes.filter(q => q.status !== 'draft');
  const sales = userQuotes.filter(q => q.status === 'active' || q.status === 'production_started' || q.status === 'completed');

  return {
    quotes,
    projects,
    allQuotes: quotesQuery.data || [],
    sales,
    isLoading: quotesQuery.isLoading,
    addQuote: addQuoteMutation.mutate,
    updateQuote: updateQuoteMutation.mutate,
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
    isAdding: addQuoteMutation.isPending,
    isConverting: convertToActiveMutation.isPending,
    isLocking: lockSaleMutation.isPending,
    isCompletingProject: markProjectCompleteMutation.isPending,
  };
});
