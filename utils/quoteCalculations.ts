import { LineItem, QuoteCalculations, SizeQuantities, LineItemCalculations } from '@/types/quote';

export function getTotalQuantity(sizes: SizeQuantities, isPromotional: boolean): number {
  if (isPromotional) {
    return sizes.flat;
  }
  return sizes.xs + sizes.s + sizes.m + sizes.l + sizes.xl + sizes.xxl + sizes.xxxl + sizes.xxxxl;
}

export function calculateLineItemTotals(lineItems: LineItem[]): {
  totalQuantity: number;
  productCostTotal: number;
  serviceCostTotal: number;
  serviceFeeTotal: number;
  markupTotal: number;
} {
  let totalQuantity = 0;
  let productCostTotal = 0;
  let serviceCostTotal = 0;
  let serviceFeeTotal = 0;
  let markupTotal = 0;

  for (const item of lineItems) {
    const isPromotional = item.serviceStyle === 'Promotional';
    const qty = getTotalQuantity(item.sizes, isPromotional);
    totalQuantity += qty;
    productCostTotal += item.productCostEach * qty;
    serviceCostTotal += item.serviceCostEach * qty;
    serviceFeeTotal += item.serviceFeeEach;
    markupTotal += (item.markupEach || 0) * qty;
  }

  return { totalQuantity, productCostTotal, serviceCostTotal, serviceFeeTotal, markupTotal };
}

export function calculateQuote(
  lineItems: LineItem[],
  hasOnlineFee: boolean,
  hasSalesTax: boolean,
  hasCardFee: boolean
): QuoteCalculations | null {
  if (lineItems.length === 0) {
    return null;
  }

  const { totalQuantity, productCostTotal, serviceCostTotal, serviceFeeTotal, markupTotal } = 
    calculateLineItemTotals(lineItems);

  if (totalQuantity === 0) {
    return null;
  }

  const productCostEach = productCostTotal / totalQuantity;
  const serviceCostEach = serviceCostTotal / totalQuantity;
  const serviceFeeEach = serviceFeeTotal / totalQuantity;

  const cogTotal = productCostTotal + serviceCostTotal + serviceFeeTotal;
  const cogEach = cogTotal / totalQuantity;

  const markupAmount = markupTotal;
  const subtotal = cogTotal + markupAmount;
  
  const markupPercentage = cogTotal > 0 ? ((subtotal - cogTotal) / cogTotal) * 100 : 0;

  const onlineFee = hasOnlineFee ? (subtotal * 0.029) + 0.60 : 0;
  const salesTax = hasSalesTax ? subtotal * 0.083 : 0;
  const cardFee = hasCardFee ? subtotal * 0.0375 : 0;

  const total = subtotal + onlineFee + salesTax + cardFee;
  const totalPerPiece = total / totalQuantity;

  return {
    totalQuantity,
    productCostEach,
    productCostTotal,
    serviceCostEach,
    serviceCostTotal,
    serviceFeeEach,
    serviceFeeTotal,
    cogEach,
    cogTotal,
    markupAmount,
    markupPercentage,
    subtotal,
    onlineFee,
    salesTax,
    cardFee,
    total,
    totalPerPiece,
  };
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}${day}-${random}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateLineItemSubtotal(item: LineItem): LineItemCalculations {
  const isPromotional = item.serviceStyle === 'Promotional';
  const quantity = getTotalQuantity(item.sizes, isPromotional);
  
  const productCostTotal = item.productCostEach * quantity;
  const serviceCostTotal = item.serviceCostEach * quantity;
  const serviceFeeTotal = item.serviceFeeEach;
  const markupTotal = (item.markupEach || 0) * quantity;
  
  const cogTotal = productCostTotal + serviceCostTotal + serviceFeeTotal;
  const subtotal = cogTotal + markupTotal;
  const perPiece = quantity > 0 ? subtotal / quantity : 0;
  
  return {
    quantity,
    productCostTotal,
    serviceCostTotal,
    serviceFeeTotal,
    markupTotal,
    cogTotal,
    subtotal,
    perPiece,
  };
}
