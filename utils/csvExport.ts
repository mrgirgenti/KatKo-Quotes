import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Quote } from '@/types/quote';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  clientName?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: 'all' | 'quote' | 'sale';
}

export function filterQuotes(quotes: Quote[], filters: ReportFilters): Quote[] {
  return quotes.filter(quote => {
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'quote' && quote.status === 'sale') return false;
      if (filters.status === 'sale' && quote.status !== 'sale') return false;
    }

    if (filters.clientName) {
      const search = filters.clientName.toLowerCase();
      if (!quote.personOrganization.toLowerCase().includes(search) &&
          !quote.projectName.toLowerCase().includes(search)) {
        return false;
      }
    }

    if (filters.minPrice !== undefined && quote.calculations.total < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== undefined && quote.calculations.total > filters.maxPrice) {
      return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      const quoteDate = parseDate(quote.orderDate);
      if (quoteDate) {
        if (filters.dateFrom) {
          const fromDate = parseDate(filters.dateFrom);
          if (fromDate && quoteDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const toDate = parseDate(filters.dateTo);
          if (toDate && quoteDate > toDate) return false;
        }
      }
    }

    return true;
  });
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
}

function escapeCSV(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateQuotesCSV(quotes: Quote[]): string {
  const headers = [
    'Invoice Number',
    'Client/Organization',
    'Project Name',
    'Order Type',
    'Order Date',
    'In-Hands Date',
    'Status',
    'Service Style',
    'Total Quantity',
    'Product Cost',
    'Service Cost',
    'Service Fees',
    'Cost of Goods',
    'Markup',
    'Markup %',
    'Subtotal',
    'Online Fee',
    'Card Fee',
    'Sales Tax',
    'Total',
    'Per Piece',
    'Line Items Count',
  ];

  const rows = quotes.map(quote => [
    escapeCSV(quote.invoiceNumber),
    escapeCSV(quote.personOrganization),
    escapeCSV(quote.projectName),
    escapeCSV(quote.orderType),
    escapeCSV(quote.orderDate),
    escapeCSV(quote.inHandsDate),
    escapeCSV(quote.status === 'sale' ? 'Sale' : 'Quote'),
    escapeCSV(quote.lineItems[0]?.serviceStyle || ''),
    escapeCSV(quote.calculations.totalQuantity),
    escapeCSV(quote.calculations.productCostTotal.toFixed(2)),
    escapeCSV(quote.calculations.serviceCostTotal.toFixed(2)),
    escapeCSV(quote.calculations.serviceFeeTotal.toFixed(2)),
    escapeCSV(quote.calculations.cogTotal.toFixed(2)),
    escapeCSV(quote.calculations.markupAmount.toFixed(2)),
    escapeCSV(quote.calculations.markupPercentage.toFixed(1)),
    escapeCSV(quote.calculations.subtotal.toFixed(2)),
    escapeCSV(quote.calculations.onlineFee.toFixed(2)),
    escapeCSV(quote.calculations.cardFee.toFixed(2)),
    escapeCSV(quote.calculations.salesTax.toFixed(2)),
    escapeCSV(quote.calculations.total.toFixed(2)),
    escapeCSV(quote.calculations.totalPerPiece.toFixed(2)),
    escapeCSV(quote.lineItems.length),
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function generateSalesCSV(quotes: Quote[]): string {
  const sales = quotes.filter(q => q.status === 'sale' && q.salesData);
  
  const headers = [
    'Invoice Number',
    'Client/Organization',
    'Project Name',
    'Order Date',
    'Converted Date',
    'Completed Date',
    'Quoted Total',
    'Amount Collected',
    'Actual Product Cost',
    'Actual Service Cost',
    'Actual Service Fees',
    'Actual Other Costs',
    'Actual Online Fee',
    'Actual Card Fee',
    'Actual Sales Tax',
    'Actual COG',
    'Actual Profit',
    'Profit Margin %',
    'Vendors',
    'Applicators',
    'Notes',
  ];

  const rows = sales.map(quote => {
    const sd = quote.salesData!;
    const actualCOG = sd.actualProductCost + sd.actualServiceCost + 
                      (sd.actualServiceFeesCost || 0) + sd.actualOtherCosts + 
                      (sd.actualOnlineFee || 0) + (sd.actualSalesTax || 0) + 
                      (sd.actualCardFee || 0);
    const actualProfit = sd.amountCollected - actualCOG + (sd.actualServiceFeesProfit || 0);
    const profitMargin = sd.amountCollected > 0 ? (actualProfit / sd.amountCollected) * 100 : 0;

    return [
      escapeCSV(quote.invoiceNumber),
      escapeCSV(quote.personOrganization),
      escapeCSV(quote.projectName),
      escapeCSV(quote.orderDate),
      escapeCSV(sd.convertedDate),
      escapeCSV(sd.completedDate),
      escapeCSV(quote.calculations.total.toFixed(2)),
      escapeCSV(sd.amountCollected.toFixed(2)),
      escapeCSV(sd.actualProductCost.toFixed(2)),
      escapeCSV(sd.actualServiceCost.toFixed(2)),
      escapeCSV((sd.actualServiceFeesCost || 0).toFixed(2)),
      escapeCSV(sd.actualOtherCosts.toFixed(2)),
      escapeCSV((sd.actualOnlineFee || 0).toFixed(2)),
      escapeCSV((sd.actualCardFee || 0).toFixed(2)),
      escapeCSV((sd.actualSalesTax || 0).toFixed(2)),
      escapeCSV(actualCOG.toFixed(2)),
      escapeCSV(actualProfit.toFixed(2)),
      escapeCSV(profitMargin.toFixed(1)),
      escapeCSV(sd.productVendors?.join('; ') || ''),
      escapeCSV(sd.lineItemCosts?.map(c => c.applicator).filter((v, i, a) => a.indexOf(v) === i).join('; ') || sd.applicator || ''),
      escapeCSV(sd.notes),
    ];
  });

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function generateLineItemsCSV(quotes: Quote[]): string {
  const headers = [
    'Invoice Number',
    'Client/Organization',
    'Project Name',
    'Line Item #',
    'Design Name',
    'Service Style',
    'Product',
    'Color',
    'Apparel Provider',
    'Service Applicator',
    'Location 1',
    'Location 2',
    'Location Details',
    'Total Quantity',
    'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Flat',
    'Product Cost/ea',
    'Service Cost/ea',
    'Service Fee/ea',
    'Markup/ea',
    'Line Item Total',
  ];

  const rows: string[][] = [];
  quotes.forEach(quote => {
    quote.lineItems.forEach((item, idx) => {
      const qty = Object.values(item.sizes).reduce((s, q) => s + q, 0);
      const itemTotal = (item.productCostEach + item.serviceCostEach + item.serviceFeeEach + (item.markupEach || 0)) * qty;
      
      rows.push([
        escapeCSV(quote.invoiceNumber),
        escapeCSV(quote.personOrganization),
        escapeCSV(quote.projectName),
        escapeCSV(idx + 1),
        escapeCSV(item.designName),
        escapeCSV(item.serviceStyle),
        escapeCSV(item.product),
        escapeCSV(item.productColor),
        escapeCSV(item.apparelProvider),
        escapeCSV(item.applicator),
        escapeCSV(item.location1),
        escapeCSV(item.location2),
        escapeCSV(item.locationDetails),
        escapeCSV(qty),
        escapeCSV(item.sizes.xs),
        escapeCSV(item.sizes.s),
        escapeCSV(item.sizes.m),
        escapeCSV(item.sizes.l),
        escapeCSV(item.sizes.xl),
        escapeCSV(item.sizes.xxl),
        escapeCSV(item.sizes.xxxl),
        escapeCSV(item.sizes.xxxxl),
        escapeCSV(item.sizes.flat),
        escapeCSV(item.productCostEach.toFixed(2)),
        escapeCSV(item.serviceCostEach.toFixed(2)),
        escapeCSV(item.serviceFeeEach.toFixed(2)),
        escapeCSV((item.markupEach || 0).toFixed(2)),
        escapeCSV(itemTotal.toFixed(2)),
      ]);
    });
  });

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export async function exportCSV(csvContent: string, filename: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      return true;
    }

    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(csvContent);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
      return true;
    }
    
    console.log('Sharing not available on this device');
    return false;
  } catch (error) {
    console.log('Error exporting CSV:', error);
    return false;
  }
}
