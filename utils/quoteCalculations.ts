import { LineItem, QuoteCalculations, SizeQuantities, LineItemCalculations, ProductCostRow, QuoteAdjustment } from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';
import { getLineItemProducts } from '@/utils/configuredProduct';
import { ONLINE_FEE_PCT, ONLINE_FEE_FLAT, CARD_FEE_PCT, SALES_TAX_PCT } from '@/constants/fees';

/**
 * Fee rate overrides for the calculation engine.
 * All values are in decimal form (e.g. 0.083 for 8.3%).
 * When not provided, the compile-time constants from constants/fees.ts are used.
 */
export interface FeeRates {
  salesTaxPct:   number;
  cardFeePct:    number;
  onlineFeePct:  number;
  onlineFeeFlat: number;
}

/** Compute extra cost from size upcharges for one product's colorVariants. */
function computeSizeUpcharge(
  colorVariants: Array<{ sizes: SizeQuantities }>,
  upcharges: Record<string, number>,
): number {
  let total = 0;
  for (const cv of colorVariants) {
    total += (upcharges['2XL'] ?? 0) * (cv.sizes.xxl   ?? 0);
    total += (upcharges['3XL'] ?? 0) * (cv.sizes.xxxl  ?? 0);
    total += (upcharges['4XL'] ?? 0) * (cv.sizes.xxxxl ?? 0);
  }
  return total;
}

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
 * Builds a ProductCostRow label from a ConfiguredProduct.
 * Prefers styleNumber + styleName; falls back to productLabel or productType.
 */
function productLabel(cp: ConfiguredProduct): string {
  const parts = [cp.styleNumber, cp.styleName].filter(Boolean);
  if (parts.length) return parts.join(' — ');
  return cp.productLabel || cp.productType || cp.category || 'Product';
}

/**
 * Derive one adjustment row's dollar value from its inputs.
 *   flat        → rate
 *   hourly      → rate × quantity (hours)
 *   per_unit    → rate × quantity (units/pieces)
 *   percentage  → rate% × base
 *
 * Shared by the pricing engine AND the Quote Builder's PRODUCTION COSTS /
 * OTHER CHARGES tables + Add dialog, so the on-screen "Calculated" value always
 * equals the engine's contribution.
 */
export function calcAdjustmentAmount(
  adj: Pick<QuoteAdjustment, 'type' | 'rate' | 'quantity'>,
  base: number,
): number {
  switch (adj.type) {
    case 'flat':
      return adj.rate || 0;
    case 'hourly':
    case 'per_unit':
      return (adj.rate || 0) * (adj.quantity || 0);
    case 'percentage':
      return ((adj.rate || 0) / 100) * (base || 0);
    default:
      return 0;
  }
}

/** Σ of every adjustment row in a list, evaluated against `base`. */
function sumAdjustments(list: QuoteAdjustment[] | undefined, base: number): number {
  if (!list || list.length === 0) return 0;
  return list.reduce((sum, adj) => sum + calcAdjustmentAmount(adj, base), 0);
}

export function calculateLineItemTotals(
  lineItems: LineItem[],
  upcharges?: Record<string, number>,
): {
  totalQuantity: number;
  productCostTotal: number;
  serviceCostTotal: number;
  productionCostTotal: number;
  otherCostTotal: number;
  serviceFeeTotal: number;
  markupTotal: number;
} {
  let totalQuantity = 0;
  let productCostTotal = 0;
  let serviceCostTotal = 0;
  let productionCostTotal = 0;
  let otherCostTotal = 0;
  let markupTotal = 0;

  for (const item of lineItems) {
    const calcs = calculateLineItemSubtotal(item, upcharges);
    totalQuantity += calcs.quantity;
    productCostTotal += calcs.productCostTotal;
    serviceCostTotal += calcs.serviceCostTotal;
    productionCostTotal += calcs.productionCostTotal;
    otherCostTotal += calcs.otherCostTotal;
    markupTotal += calcs.markupTotal;
  }

  return {
    totalQuantity,
    productCostTotal,
    serviceCostTotal,
    productionCostTotal,
    otherCostTotal,
    serviceFeeTotal: productionCostTotal,
    markupTotal,
  };
}

export function calculateQuote(
  lineItems: LineItem[],
  hasOnlineFee: boolean,
  hasSalesTax: boolean,
  hasCardFee: boolean,
  feeRates?: Partial<FeeRates>,
  upcharges?: Record<string, number>,
  discount?: { type: 'percentage' | 'dollar'; value: number } | null,
): QuoteCalculations | null {
  if (lineItems.length === 0) {
    return null;
  }

  const {
    totalQuantity,
    productCostTotal,
    serviceCostTotal,
    productionCostTotal,
    otherCostTotal,
    markupTotal,
  } = calculateLineItemTotals(lineItems, upcharges);

  if (totalQuantity === 0) {
    return null;
  }

  // Per-each display-only averages across the full quote.
  const productCostEach = productCostTotal / totalQuantity;
  const serviceCostEach = serviceCostTotal / totalQuantity;
  const productionCostEach = totalQuantity > 0 ? productionCostTotal / totalQuantity : 0;
  const otherCostEach = totalQuantity > 0 ? otherCostTotal / totalQuantity : 0;

  // Production Cost base = Product + Service + Production
  const cogTotal = productCostTotal + serviceCostTotal + productionCostTotal;
  const cogEach = cogTotal / totalQuantity;

  const markupAmount = markupTotal;
  // Markup percentage is calculated over the production cost base (excludes Other Charges)
  const markupPercentage = cogTotal > 0 ? (markupAmount / cogTotal) * 100 : 0;

  // Subtotal includes all five buckets
  const subtotal = cogTotal + otherCostTotal + markupAmount;

  const _onlineFeePct  = feeRates?.onlineFeePct  ?? ONLINE_FEE_PCT;
  const _onlineFeeFlat = feeRates?.onlineFeeFlat ?? ONLINE_FEE_FLAT;
  const _salesTaxPct   = feeRates?.salesTaxPct   ?? SALES_TAX_PCT;
  const _cardFeePct    = feeRates?.cardFeePct     ?? CARD_FEE_PCT;

  const discountAmount = discount
    ? discount.type === 'percentage'
      ? subtotal * Math.max(0, Math.min(discount.value, 100)) / 100
      : Math.max(0, Math.min(discount.value, subtotal))
    : 0;
  const discountedSubtotal = subtotal - discountAmount;

  const onlineFee = hasOnlineFee ? (discountedSubtotal * _onlineFeePct) + _onlineFeeFlat : 0;
  const salesTax  = hasSalesTax  ? discountedSubtotal * _salesTaxPct : 0;
  const cardFee   = hasCardFee   ? discountedSubtotal * _cardFeePct  : 0;

  const total = discountedSubtotal + onlineFee + salesTax + cardFee;
  const totalPerPiece = total / totalQuantity;

  return {
    totalQuantity,
    productCostEach,
    productCostTotal,
    serviceCostEach,
    serviceCostTotal,
    serviceFeeEach: productionCostEach,
    serviceFeeTotal: productionCostTotal,
    productionCostEach,
    productionCostTotal,
    otherCostEach,
    otherCostTotal,
    cogEach,
    cogTotal,
    markupAmount,
    markupPercentage,
    subtotal,
    discountAmount,
    discountedSubtotal,
    discountType: discount?.type,
    discountValue: discount?.value,
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
 * PRICING MODEL (5 buckets):
 *   productCostTotal    = Σ (product.productCostEach × product.qty) for every product
 *   serviceCostTotal    = item.serviceCostEach × totalQty   (shared service, per piece)
 *   productionCostTotal = Σ item.productionCosts[]          (itemized PRODUCTION COSTS — Design Fee, Digitizing, etc.)
 *   otherCostTotal      = Σ item.otherCharges[]             (itemized OTHER CHARGES — Rush, Shipping, etc.)
 *   markupTotal         = item.markupEach × totalQty        (shared markup, per piece)
 *
 * Production / Other buckets are the sum of their itemized adjustment rows.
 * Legacy quotes with no itemized rows fall back to the flat scalar fields
 * (item.serviceFeeEach / item.otherCostEach) so old data still prices correctly.
 *
 * Production Cost base  = productCostTotal + serviceCostTotal + productionCostTotal
 * Subtotal              = Production Cost base + otherCostTotal + markupTotal
 *
 * There is no weighted average of product cost. Each product's extended cost
 * is computed independently. productCostTotal is the exact dollar sum.
 *
 * When the line item has multiple products, productCostRows contains the
 * per-product breakdown for display in the LINE ITEM COSTS panel.
 */
export function calculateLineItemSubtotal(
  item: LineItem,
  upcharges?: Record<string, number>,
): LineItemCalculations {
  const isPromotional = item.serviceStyle === 'Promotional';

  const products = getLineItemProducts(item);

  let productCostTotal = 0;
  let quantity = 0;
  const rows: ProductCostRow[] = [];

  if (products.length > 0) {
    for (const cp of products) {
      const cpQty = getProductQty(cp, isPromotional);
      const baseCost = cp.productCostEach * cpQty;
      const upchargeAmt =
        upcharges && cp.colorVariants?.length && !isPromotional
          ? computeSizeUpcharge(cp.colorVariants as Array<{ sizes: SizeQuantities }>, upcharges)
          : 0;
      const extendedCost = baseCost + upchargeAmt;
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
  const markupTotal = (item.markupEach || 0) * quantity;

  // Percentage adjustments are evaluated against the line subtotal BEFORE
  // adjustments (Product + Service + Markup). This base is stable and avoids a
  // circular dependency (subtotal → adjustment → subtotal). The Quote Builder
  // adjustment tables/dialog are handed this exact value so their on-screen
  // "Calculated" column matches the engine's contribution.
  const adjustmentBase = productCostTotal + serviceCostTotal + markupTotal;

  // Production bucket = Σ itemized PRODUCTION COSTS rows.
  // Other Charges bucket = Σ itemized OTHER CHARGES rows.
  // Fall back to the legacy flat scalar fields when a line item has no rows.
  const productionCostTotal =
    item.productionCosts && item.productionCosts.length > 0
      ? sumAdjustments(item.productionCosts, adjustmentBase)
      : item.serviceFeeEach ?? 0;
  const otherCostTotal =
    item.otherCharges && item.otherCharges.length > 0
      ? sumAdjustments(item.otherCharges, adjustmentBase)
      : item.otherCostEach ?? 0;

  // Production Cost base = Product + Service + Production
  const cogTotal = productCostTotal + serviceCostTotal + productionCostTotal;
  const subtotal = cogTotal + otherCostTotal + markupTotal;
  const perPiece = quantity > 0 ? subtotal / quantity : 0;

  return {
    quantity,
    productCostTotal,
    productCostRows: rows.length > 1 ? rows : undefined,
    serviceCostTotal,
    productionCostTotal,
    otherCostTotal,
    serviceFeeTotal: productionCostTotal,
    markupTotal,
    cogTotal,
    adjustmentBase,
    subtotal,
    perPiece,
  };
}
