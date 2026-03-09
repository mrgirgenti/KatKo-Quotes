import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Quote, SalesData, LineItemActualCosts } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';

const QUOTES_STORAGE_KEY = 'printshop_quotes';

async function loadQuotes(): Promise<Quote[]> {
  try {
    const stored = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
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
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (updatedQuote: Quote) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => q.id === updatedQuote.id ? updatedQuote : q);
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.filter(q => q.id !== quoteId);
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const convertToSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
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
            status: 'sale' as const,
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
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
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
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const convertToQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            status: 'draft' as const,
            salesData: undefined,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const lockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            isLocked: true,
            lockedDate: dateStr,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const unlockSaleMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            isLocked: false,
            lockedDate: undefined,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const markExportedToSheetsMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const current = quotesQuery.data || [];
      const now = new Date();
      const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`;
      const updated = current.map(q => {
        if (q.id === quoteId) {
          return {
            ...q,
            exportedToSheets: true,
            exportedToSheetsDate: dateStr,
            isLocked: true,
            lockedDate: dateStr,
          };
        }
        return q;
      });
      return saveQuotes(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['quotes'], data);
    },
  });

  const userQuotes = (quotesQuery.data || []).filter(q => 
    !q.userId || q.userId === currentUserId || q.userId === 'default'
  );
  const pendingQuotes = userQuotes.filter(q => q.status !== 'sale');
  const sales = userQuotes.filter(q => q.status === 'sale');

  return {
    quotes: pendingQuotes,
    allQuotes: quotesQuery.data || [],
    sales,
    isLoading: quotesQuery.isLoading,
    addQuote: addQuoteMutation.mutate,
    updateQuote: updateQuoteMutation.mutate,
    deleteQuote: deleteQuoteMutation.mutate,
    convertToSale: convertToSaleMutation.mutate,
    convertToQuote: convertToQuoteMutation.mutate,
    updateSalesData: updateSalesDataMutation.mutate,
    lockSale: lockSaleMutation.mutate,
    unlockSale: unlockSaleMutation.mutate,
    markExportedToSheets: markExportedToSheetsMutation.mutate,
    isAdding: addQuoteMutation.isPending,
    isConverting: convertToSaleMutation.isPending,
    isLocking: lockSaleMutation.isPending,
  };
});
