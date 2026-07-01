import { useQuery } from '@tanstack/react-query';
import {
  ONLINE_FEE_PCT,
  ONLINE_FEE_FLAT,
  CARD_FEE_PCT,
  SALES_TAX_PCT,
} from '@/constants/fees';
import type { FeeRates } from '@/utils/quoteCalculations';

interface TaxesFeesSettings {
  salesTaxPct: number;
  cardFeePct: number;
  onlineFeePct: number;
  onlineFeeFlat: number;
}

/**
 * Loads the Taxes & Fees settings from AppSettings (DB) and returns them in
 * the decimal form expected by the calculation engine.
 * Falls back to the compile-time constants when the DB row is not yet saved.
 */
export function useFeeRates(): FeeRates {
  const { data } = useQuery<TaxesFeesSettings | null>({
    queryKey: ['app-settings', 'taxes_fees'],
    queryFn: async () => {
      const r = await fetch('/api/app-settings/taxes_fees');
      if (!r.ok) return null;
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });

  return {
    salesTaxPct:   data?.salesTaxPct   != null ? data.salesTaxPct   / 100 : SALES_TAX_PCT,
    cardFeePct:    data?.cardFeePct     != null ? data.cardFeePct     / 100 : CARD_FEE_PCT,
    onlineFeePct:  data?.onlineFeePct   != null ? data.onlineFeePct   / 100 : ONLINE_FEE_PCT,
    onlineFeeFlat: data?.onlineFeeFlat  != null ? data.onlineFeeFlat        : ONLINE_FEE_FLAT,
  };
}

/**
 * Returns display-friendly percentage labels derived from the current DB rates
 * (or compile-time constants as fallback), so UI toggle labels stay in sync with
 * the actual math.
 */
export function useFeeLabels(): { salesTaxLabel: string; cardFeeLabel: string; onlineFeeLabel: string } {
  const rates = useFeeRates();
  return {
    salesTaxLabel: `${(rates.salesTaxPct * 100).toFixed(1)}%`,
    cardFeeLabel:  `${(rates.cardFeePct  * 100).toFixed(2)}%`,
    onlineFeeLabel: `${(rates.onlineFeePct * 100).toFixed(1)}% + $${rates.onlineFeeFlat.toFixed(2)}`,
  };
}
