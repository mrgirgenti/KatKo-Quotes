import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { QuoteCalculations, LineItem } from '@/types/quote';
import { formatCurrency, formatPercentage, calculateLineItemSubtotal } from '@/utils/quoteCalculations';
import { ONLINE_FEE_LABEL, CARD_FEE_LABEL, SALES_TAX_LABEL } from '@/constants/fees';

interface CalculationDisplayProps {
  calculations: QuoteCalculations | null;
  lineItems?: LineItem[];
  hasOnlineFee: boolean;
  hasSalesTax: boolean;
  hasCardFee: boolean;
}

export function CalculationDisplay({
  calculations,
  lineItems = [],
  hasOnlineFee,
  hasSalesTax,
  hasCardFee,
}: CalculationDisplayProps) {
  if (!calculations) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>⚠️ Incomplete Information</Text>
        <Text style={styles.errorSubtext}>
          Add line items with quantities to calculate the quote
        </Text>
      </View>
    );
  }

  const qty = calculations.totalQuantity;

  return (
    <View style={styles.container}>

      {/* ── QUOTE SUMMARY header ── */}
      <Text style={styles.sectionTitle}>QUOTE SUMMARY</Text>

      {/* ── Cost breakdown: Product / Service / Production ── */}
      <View style={styles.tableHeader}>
        <Text style={styles.headerCell} />
        <Text style={styles.headerCellRight}>Each</Text>
        <Text style={styles.headerCellRight}>Total</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.cell}>Product</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.productCostEach)}</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.productCostTotal)}</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.cell}>Service</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.serviceCostEach)}</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.serviceCostTotal)}</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.cell}>Production</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.productionCostEach)}</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.productionCostTotal)}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── Aggregated buckets ── */}
      <View style={[styles.tableRow, styles.cogRow]}>
        <Text style={styles.cogCell}>Production Cost</Text>
        <Text style={styles.cogCellRight}>{formatCurrency(calculations.cogEach)}</Text>
        <Text style={styles.cogCellRight}>{formatCurrency(calculations.cogTotal)}</Text>
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.cell}>Other Charges</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.otherCostEach)}</Text>
        <Text style={styles.cellRight}>{formatCurrency(calculations.otherCostTotal)}</Text>
      </View>

      <View style={[styles.tableRow, styles.markupRow]}>
        <Text style={styles.markupCell}>
          Markup ({formatPercentage(calculations.markupPercentage)})
        </Text>
        <Text style={styles.markupCellRight}>
          {formatCurrency(qty > 0 ? calculations.markupAmount / qty : 0)}
        </Text>
        <Text style={styles.markupCellRight}>{formatCurrency(calculations.markupAmount)}</Text>
      </View>

      {/* ── Per-line-item subtotals (multi-design quotes) ── */}
      {lineItems.length > 1 && (
        <>
          <View style={styles.divider} />
          <View style={styles.lineItemsSubtotalsSection}>
            <Text style={styles.lineItemsSubtotalsTitle}>Line Item Subtotals</Text>
            {lineItems.map((item, index) => {
              const itemCalcs = calculateLineItemSubtotal(item);
              return (
                <View key={item.id} style={styles.lineItemSubtotalRow}>
                  <View style={styles.lineItemSubtotalInfo}>
                    <Text style={styles.lineItemSubtotalIndex}>{`${index + 1}.`}</Text>
                    <Text style={styles.lineItemSubtotalName} numberOfLines={1}>
                      {item.designName || 'Untitled Design'}
                    </Text>
                    <Text style={styles.lineItemSubtotalQty}>({itemCalcs.quantity} pcs)</Text>
                  </View>
                  <Text style={styles.lineItemSubtotalValue}>{formatCurrency(itemCalcs.subtotal)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.divider} />

      {/* ── CLIENT QUOTE PRICE ── */}
      <View style={styles.clientQuoteSection}>
        <Text style={styles.clientQuoteSectionTitle}>Client Quote Price</Text>
        <View style={styles.clientQuoteTableHeader}>
          <Text style={styles.clientQuoteHeaderCell} />
          <Text style={styles.clientQuoteHeaderCellRight}>Each</Text>
          <Text style={styles.clientQuoteHeaderCellRight}>Total</Text>
        </View>
        <View style={styles.clientQuoteRow}>
          <Text style={styles.clientQuoteLabel}>Subtotal</Text>
          <Text style={styles.clientQuoteValue}>
            {formatCurrency(qty > 0 ? calculations.subtotal / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteValue}>{formatCurrency(calculations.subtotal)}</Text>
        </View>
        <View style={styles.clientQuoteRow}>
          <Text style={styles.clientQuoteLabel}>{`Online Fee (${ONLINE_FEE_LABEL})`}</Text>
          <Text style={styles.clientQuoteValue}>
            {formatCurrency(qty > 0 ? calculations.onlineFee / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteValue}>{formatCurrency(calculations.onlineFee)}</Text>
        </View>
        <View style={styles.clientQuoteTotalRow}>
          <Text style={styles.clientQuoteTotalLabel}>Quote Total</Text>
          <Text style={styles.clientQuoteTotalValue}>
            {formatCurrency(qty > 0 ? (calculations.subtotal + calculations.onlineFee) / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteTotalValue}>
            {formatCurrency(calculations.subtotal + calculations.onlineFee)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── ADDITIONAL FEES ── */}
      <View style={styles.feesSection}>
        <Text style={styles.feesSectionTitle}>Additional Fees (when applicable)</Text>
        <View style={styles.feesTableHeader}>
          <Text style={styles.feesHeaderCell} />
          <Text style={styles.feesHeaderCellRight}>Each</Text>
          <Text style={styles.feesHeaderCellRight}>Total</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>{`Card Fee (${CARD_FEE_LABEL})`}</Text>
          <Text style={styles.feeValue}>
            {formatCurrency(qty > 0 ? calculations.cardFee / qty : 0)}
          </Text>
          <Text style={styles.feeValue}>{formatCurrency(calculations.cardFee)}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>{`Sales Tax (${SALES_TAX_LABEL})`}</Text>
          <Text style={styles.feeValue}>
            {formatCurrency(qty > 0 ? calculations.salesTax / qty : 0)}
          </Text>
          <Text style={styles.feeValue}>{formatCurrency(calculations.salesTax)}</Text>
        </View>
      </View>

      {/* ── Grand Total ── */}
      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>{formatCurrency(calculations.total)}</Text>
        </View>
        <View style={styles.perPieceRow}>
          <Text style={styles.perPieceLabel}>
            Total Per Piece ({calculations.totalQuantity} items)
          </Text>
          <Text style={styles.perPieceValue}>{formatCurrency(calculations.totalPerPiece)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorContainer: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.error,
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  headerCellRight: {
    width: 80,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  cell: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  cellRight: {
    width: 80,
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  cogRow: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
  },
  cogCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  cogCellRight: {
    width: 80,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  markupRow: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
  },
  markupCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  markupCellRight: {
    width: 80,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  lineItemsSubtotalsSection: {
    gap: 8,
  },
  lineItemsSubtotalsTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lineItemSubtotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 6,
  },
  lineItemSubtotalInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    marginRight: 12,
  },
  lineItemSubtotalIndex: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginRight: 6,
  },
  lineItemSubtotalName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    flex: 1,
  },
  lineItemSubtotalQty: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  lineItemSubtotalValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  clientQuoteSection: {
    gap: 0,
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  clientQuoteSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.highlight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  clientQuoteTableHeader: {
    flexDirection: 'row' as const,
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  clientQuoteHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.highlight,
    textTransform: 'uppercase' as const,
  },
  clientQuoteHeaderCellRight: {
    width: 70,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.highlight,
    textAlign: 'right' as const,
    textTransform: 'uppercase' as const,
  },
  clientQuoteRow: {
    flexDirection: 'row' as const,
    paddingVertical: 4,
  },
  clientQuoteLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  clientQuoteValue: {
    width: 70,
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  clientQuoteTotalRow: {
    flexDirection: 'row' as const,
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  clientQuoteTotalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.highlight,
  },
  clientQuoteTotalValue: {
    width: 70,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.highlight,
    textAlign: 'right' as const,
  },
  feesSection: {
    gap: 0,
  },
  feesSectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  feesTableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  feesHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  feesHeaderCellRight: {
    width: 70,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
    textTransform: 'uppercase' as const,
  },
  feeRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  feeLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  feeValue: {
    width: 70,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
  },
  totalSection: {
    backgroundColor: Colors.light.tint,
    marginHorizontal: -16,
    marginBottom: -16,
    padding: 16,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    marginTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
  },
  perPieceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  perPieceLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  perPieceValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
