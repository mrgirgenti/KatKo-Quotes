import { ADJUSTMENT_CALC_TYPES, type QuoteAdjustment } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';

/**
 * calcAdjustmentAmount lives in the pricing engine (utils/quoteCalculations.ts)
 * so the engine and the Quote Builder tables/dialog share one implementation.
 * Re-exported here for the existing UI consumers that import it from this module.
 */
export { calcAdjustmentAmount } from '@/utils/quoteCalculations';

export function adjustmentTypeLabel(type: string): string {
  return ADJUSTMENT_CALC_TYPES.find((t) => t.value === type)?.label ?? 'Flat Rate';
}

/** Human-readable summary of an adjustment's inputs, for read-only table display. */
export function adjustmentDetails(adj: QuoteAdjustment): string {
  switch (adj.type) {
    case 'flat':
      return formatCurrency(adj.rate);
    case 'hourly':
      return `${adj.quantity || 0} hrs × ${formatCurrency(adj.rate)}`;
    case 'per_unit':
      return `${adj.quantity || 0} × ${formatCurrency(adj.rate)}`;
    case 'percentage':
      return `${adj.rate}% of Subtotal`;
    default:
      return '';
  }
}
