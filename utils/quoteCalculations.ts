import { LineItem, QuoteCalculations, SizeQuantities, LineItemCalculations, ProductCostRow } from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';
import { ONLINE_FEE_PCT, ONLINE_FEE_FLAT, CARD_FEE_PCT, SALES_TAX_PCT } from '@/constants/fees';

export function getTotalQuantity(sizes: SizeQuantities, isPromotional: boolean): number {
  if (isPromotional) {
    return sizes.flat;
  }
  return sizes.xs + sizes.s + sizes.m + sizes.l + sizes.xl + sizes.xxl + sizes.xxxl + sizes.xxxxl;
}

/**
 * Returns the total quantity for a single ConfiguredProduct
 * by summing across all of its colorVariants.
 */
function getProductQty(cp: ConfiguredProduct, isPromotional: boolean): number {
  if (!cp.colorVariants || cp.colorVariants.length === 0) return 0;
  return cp.colorVariants.reduce(
    (total, cv) => total + getTotalQuantity(cv.sizes, isPromotional),
    0,
  );
}

/**
 * Returns the canonical products array for a line item.
 *
 * Priority:
 *  1. configuredProducts[] (multi-product canonical form)
 *  2. configuredProduct  (legacy single-product)
 *  3. [] — empty; callers fall back to flat legacy fields
 */
function getLineItemProducts(item: LineItem): ConfiguredProduct[] {
  if (item.configuredProducts && item.configuredProducts.length > 0) {
    return item.configuredProducts;
  }
  if (item.configuredProduct) {
    return [item.configuredProduct];
  }
  return [];
}

/**
 * Builds a ProductCostRow label from a ConfiguredProduct.
 * Prefers styleNumber + styleName; falls back to productLabel or productType.
 */
function productLabel(cp: ConfiguredProduct): string {
  const parts = [cp.styleNumber, cp.styleName].filter(Boolean);
  if (parts.length) return parts.join(' — ');
  return cp.productLabel || cp.productType || cp.category || 'Product';
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
    const calcs = calculateLineItemSubtotal(item);
    totalQuantity += calcs.quantity;
    productCostTotal += calcs.productCostTotal;
    serviceCostTotal += calcs.serviceCostTotal;
    serviceFeeTotal += calcs.serviceFeeTotal;
    markupTotal += calcs.markupTotal;
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

  // These per-each values are display-only summary averages across the full quote.
  // They are never used to drive further calculations — productCostTotal is the source of truth.
  const productCostEach = productCostTotal / totalQuantity;
  const serviceCostEach = serviceCostTotal / totalQuantity;
  const serviceFeeEach = serviceFeeTotal / totalQuantity;

  const cogTotal = productCostTotal + serviceCostTotal + serviceFeeTotal;
  const cogEach = cogTotal / totalQuantity;

  const markupAmount = markupTotal;
  const subtotal = cogTotal + markupAmount;
  
  const markupPercentage = cogTotal > 0 ? ((subtotal - cogTotal) / cogTotal) * 100 : 0;

  const onlineFee = hasOnlineFee ? (subtotal * ONLINE_FEE_PCT) + ONLINE_FEE_FLAT : 0;
  const salesTax = hasSalesTax ? subtotal * SALES_TAX_PCT : 0;
  const cardFee = hasCardFee ? subtotal * CARD_FEE_PCT : 0;

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

export function formatCurrency(value: number | null | undefined): string {
  return `$${(value ?? 0).toFixed(2)}`;
}

export function formatPercentage(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`;
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

/**
 * Calculate the true cost breakdown for one line item (one Design).
 *
 * PRICING MODEL:
 *   productCostTotal = Σ (product.productCostEach × product.qty) for every product
 *   serviceCostTotal = item.serviceCostEach × totalQty   (shared service, per piece)
 *   serviceFeeTotal  = item.serviceFeeEach               (flat design/setup fee)
 *   markupTotal      = item.markupEach × totalQty        (shared markup, per piece)
 *
 * There is no weighted average of product cost. Each product's extended cost
 * is computed independently. productCostTotal is the exact dollar sum.
 *
 * When the line item has multiple products, productCostRows contains the
 * per-product breakdown for display in the LINE ITEM COSTS panel.
 */
export function calculateLineItemSubtotal(item: LineItem): LineItemCalculations {
  const isPromotional = item.serviceStyle === 'Promotional';

  const products = getLineItemProducts(item);

  let productCostTotal = 0;
  let quantity = 0;
  const rows: ProductCostRow[] = [];

  if (products.length > 0) {
    for (const cp of products) {
      const cpQty = getProductQty(cp, isPromotional);
      const extendedCost = cp.productCostEach * cpQty;
      productCostTotal += extendedCost;
      quantity += cpQty;
      rows.push({
        productLabel: productLabel(cp),
        productCostEach: cp.productCostEach,
        quantity: cpQty,
        extendedCost,
      });
    }
  } else {
    // Legacy single-product fallback (no configuredProduct on the item at all)
    quantity = getTotalQuantity(item.sizes, isPromotional);
    productCostTotal = item.productCostEach * quantity;
  }

  const serviceCostTotal = item.serviceCostEach * quantity;
  const serviceFeeTotal = item.serviceFeeEach;
  const markupTotal = (item.markupEach || 0) * quantity;

  const cogTotal = productCostTotal + serviceCostTotal + serviceFeeTotal;
  const subtotal = cogTotal + markupTotal;
  const perPiece = quantity > 0 ? subtotal / quantity : 0;

  return {
    quantity,
    productCostTotal,
    // Only surface the breakdown when there are multiple products — single-product
    // items don't need a breakdown row.
    productCostRows: rows.length > 1 ? rows : undefined,
    serviceCostTotal,
    serviceFeeTotal,
    markupTotal,
    cogTotal,
    subtotal,
    perPiece,
  };
}
