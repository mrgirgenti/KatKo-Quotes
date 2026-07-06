import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { QuoteCalculations, LineItem } from '@/types/quote';
import { formatCurrency, formatPercentage, calculateLineItemSubtotal } from '@/utils/quoteCalculations';
import { ONLINE_FEE_LABEL, CARD_FEE_LABEL, SALES_TAX_LABEL } from '@/constants/fees';
import OverlayMenu from '@/components/OverlayMenu';

export const DISCOUNT_REASONS = [
  { key: 'repeat_customer', label: 'Repeat Customer' },
  { key: 'nonprofit', label: 'Nonprofit' },
  { key: 'church', label: 'Church' },
  { key: 'school', label: 'School' },
  { key: 'employee', label: 'Employee' },
  { key: 'family', label: 'Family' },
  { key: 'marketing_promotion', label: 'Marketing Promotion' },
  { key: 'price_match', label: 'Price Match' },
  { key: 'sales_adjustment', label: 'Sales Adjustment' },
  { key: 'customer_service', label: 'Customer Service' },
  { key: 'other', label: 'Other' },
  { key: 'custom', label: 'Custom…' },
];

export function discountReasonLabel(key: string, customReason?: string): string {
  if (key === 'custom') return customReason || 'Custom';
  return DISCOUNT_REASONS.find(r => r.key === key)?.label ?? key;
}

export interface DiscountEntry {
  type: 'percentage' | 'dollar';
  value: string;
  reason: string;
  customReason: string;
}

interface CalculationDisplayProps {
  calculations: QuoteCalculations | null;
  lineItems?: LineItem[];
  hasOnlineFee: boolean;
  hasSalesTax: boolean;
  hasCardFee: boolean;
  upcharges?: Record<string, number>;
  discountEntry?: DiscountEntry | null;
  onDiscountChange?: (entry: DiscountEntry | null) => void;
}

export function CalculationDisplay({
  calculations,
  lineItems = [],
  hasOnlineFee,
  hasSalesTax,
  hasCardFee,
  upcharges,
  discountEntry,
  onDiscountChange,
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
  const isInteractive = !!onDiscountChange;
  const hasDiscount = (calculations.discountAmount ?? 0) > 0;
  const discountedSub = calculations.discountedSubtotal ?? calculations.subtotal;

  const discountDisplayLabel = calculations.discountType === 'percentage'
    ? `Discount (${(calculations.discountValue ?? 0).toFixed(1)}%)`
    : `Discount ($${(calculations.discountValue ?? 0).toFixed(2)})`;

  const selectedReasonLabel = discountEntry?.reason
    ? discountReasonLabel(discountEntry.reason, discountEntry.customReason)
    : '';

  return (
    <View style={styles.container}>

      <Text style={styles.sectionTitle}>QUOTE SUMMARY</Text>

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
        <Text style={styles.markupCell} numberOfLines={1}>
          Markup ({formatPercentage(calculations.markupPercentage)})
        </Text>
        <Text style={styles.markupCellRight}>
          {formatCurrency(qty > 0 ? calculations.markupAmount / qty : 0)}
        </Text>
        <Text style={styles.markupCellRight}>{formatCurrency(calculations.markupAmount)}</Text>
      </View>

      {lineItems.length > 1 && (
        <>
          <View style={styles.divider} />
          <View style={styles.lineItemsSubtotalsSection}>
            <Text style={styles.lineItemsSubtotalsTitle}>Line Item Subtotals</Text>
            {lineItems.map((item, index) => {
              const itemCalcs = calculateLineItemSubtotal(item, upcharges);
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

      {/* CLIENT QUOTE PRICE */}
      <View style={styles.clientQuoteSection}>
        <Text style={styles.clientQuoteSectionTitle}>Client Quote Price</Text>
        <View style={styles.clientQuoteTableHeader}>
          <Text style={styles.clientQuoteHeaderCell} />
          <Text style={styles.clientQuoteHeaderCellRight}>Each</Text>
          <Text style={styles.clientQuoteHeaderCellRight}>Total</Text>
        </View>

        {/* Subtotal row */}
        <View style={styles.clientQuoteRow}>
          <Text style={styles.clientQuoteLabel}>Subtotal</Text>
          <Text style={styles.clientQuoteValue}>
            {formatCurrency(qty > 0 ? calculations.subtotal / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteValue}>{formatCurrency(calculations.subtotal)}</Text>
        </View>

        {/* Discount — add button (interactive, no discount yet) */}
        {isInteractive && !discountEntry && (
          <TouchableOpacity
            style={styles.addDiscountBtn}
            onPress={() => onDiscountChange!({ type: 'percentage', value: '', reason: '', customReason: '' })}
          >
            <Text style={styles.addDiscountBtnText}>+ Add Discount</Text>
          </TouchableOpacity>
        )}

        {/* Discount — interactive controls */}
        {isInteractive && discountEntry && (
          <View style={styles.discountSection}>
            <Text style={styles.discountSectionLabel}>DISCOUNT</Text>

            {/* Type toggle + value input + remove */}
            <View style={styles.discountInputRow}>
              <View style={styles.discountTypeToggle}>
                <TouchableOpacity
                  style={[styles.discountTypeBtn, discountEntry.type === 'percentage' && styles.discountTypeBtnActive]}
                  onPress={() => onDiscountChange!({ ...discountEntry, type: 'percentage' })}
                >
                  <Text style={[styles.discountTypeBtnText, discountEntry.type === 'percentage' && styles.discountTypeBtnTextActive]}>%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.discountTypeBtn, discountEntry.type === 'dollar' && styles.discountTypeBtnActive]}
                  onPress={() => onDiscountChange!({ ...discountEntry, type: 'dollar' })}
                >
                  <Text style={[styles.discountTypeBtnText, discountEntry.type === 'dollar' && styles.discountTypeBtnTextActive]}>$</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.discountValueInput}
                value={discountEntry.value}
                onChangeText={v => onDiscountChange!({ ...discountEntry, value: v.replace(/[^0-9.]/g, '') })}
                placeholder={discountEntry.type === 'percentage' ? 'e.g. 10' : 'e.g. 50.00'}
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.light.textSecondary}
              />

              <TouchableOpacity style={styles.discountRemoveBtn} onPress={() => onDiscountChange!(null)}>
                <Text style={styles.discountRemoveText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Reason selector */}
            <View style={styles.discountReasonRow}>
              <Text style={styles.discountReasonLabel}>Reason</Text>
              <OverlayMenu
                menuWidth={230}
                align="right"
                trigger={({ open }) => (
                  <TouchableOpacity style={styles.discountReasonTrigger} onPress={open}>
                    <Text
                      style={[styles.discountReasonTriggerText, !discountEntry.reason && styles.discountReasonPlaceholder]}
                      numberOfLines={1}
                    >
                      {discountEntry.reason ? selectedReasonLabel : 'Select reason…'}
                    </Text>
                    <Text style={styles.discountReasonChevron}>▾</Text>
                  </TouchableOpacity>
                )}
              >
                {({ close }) => (
                  <>
                    {DISCOUNT_REASONS.map(r => (
                      <TouchableOpacity
                        key={r.key}
                        style={[
                          styles.discountReasonItem,
                          discountEntry.reason === r.key && styles.discountReasonItemActive,
                        ]}
                        onPress={() => {
                          close();
                          onDiscountChange!({
                            ...discountEntry,
                            reason: r.key,
                            customReason: r.key !== 'custom' ? '' : discountEntry.customReason,
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.discountReasonItemText,
                            discountEntry.reason === r.key && styles.discountReasonItemTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </OverlayMenu>
            </View>

            {/* Custom reason text input */}
            {discountEntry.reason === 'custom' && (
              <TextInput
                style={styles.discountCustomInput}
                value={discountEntry.customReason}
                onChangeText={v => onDiscountChange!({ ...discountEntry, customReason: v })}
                placeholder="Describe the reason…"
                placeholderTextColor={Colors.light.textSecondary}
                maxLength={120}
              />
            )}
          </View>
        )}

        {/* Discount display row (shows whenever a discount is computed) */}
        {hasDiscount && (
          <View style={styles.discountDisplayRow}>
            <Text style={styles.discountDisplayLabel} numberOfLines={1}>{discountDisplayLabel}</Text>
            <Text style={styles.discountDisplayValue}>
              {qty > 0 ? `−${formatCurrency((calculations.discountAmount ?? 0) / qty)}` : '—'}
            </Text>
            <Text style={styles.discountDisplayValue}>{`−${formatCurrency(calculations.discountAmount ?? 0)}`}</Text>
          </View>
        )}

        {/* Online fee */}
        <View style={styles.clientQuoteRow}>
          <Text style={styles.clientQuoteLabel} numberOfLines={1}>{`Online Fee (${ONLINE_FEE_LABEL})`}</Text>
          <Text style={styles.clientQuoteValue}>
            {formatCurrency(qty > 0 ? calculations.onlineFee / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteValue}>{formatCurrency(calculations.onlineFee)}</Text>
        </View>

        {/* Quote total (discounted subtotal + online fee) */}
        <View style={styles.clientQuoteTotalRow}>
          <Text style={styles.clientQuoteTotalLabel}>Quote Total</Text>
          <Text style={styles.clientQuoteTotalValue}>
            {formatCurrency(qty > 0 ? (discountedSub + calculations.onlineFee) / qty : 0)}
          </Text>
          <Text style={styles.clientQuoteTotalValue}>
            {formatCurrency(discountedSub + calculations.onlineFee)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ADDITIONAL FEES */}
      <View style={styles.feesSection}>
        <Text style={styles.feesSectionTitle}>Additional Fees (when applicable)</Text>
        <View style={styles.feesTableHeader}>
          <Text style={styles.feesHeaderCell} />
          <Text style={styles.feesHeaderCellRight}>Each</Text>
          <Text style={styles.feesHeaderCellRight}>Total</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel} numberOfLines={1}>{`Card Fee (${CARD_FEE_LABEL})`}</Text>
          <Text style={styles.feeValue}>
            {formatCurrency(qty > 0 ? calculations.cardFee / qty : 0)}
          </Text>
          <Text style={styles.feeValue}>{formatCurrency(calculations.cardFee)}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel} numberOfLines={1}>{`Sales Tax (${SALES_TAX_LABEL})`}</Text>
          <Text style={styles.feeValue}>
            {formatCurrency(qty > 0 ? calculations.salesTax / qty : 0)}
          </Text>
          <Text style={styles.feeValue}>{formatCurrency(calculations.salesTax)}</Text>
        </View>
      </View>

      {/* Grand Total */}
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
    minWidth: 0,
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
    minWidth: 0,
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
    minWidth: 0,
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
    minWidth: 0,
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
  /* ── Discount interactive section ── */
  addDiscountBtn: {
    paddingVertical: 8,
    paddingTop: 6,
    alignSelf: 'flex-start' as const,
  },
  addDiscountBtnText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  discountSection: {
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
    backgroundColor: '#FFF8F2',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFE0C0',
  },
  discountSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#B45309',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  discountInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  discountTypeToggle: {
    flexDirection: 'row' as const,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden' as const,
  },
  discountTypeBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  discountTypeBtnActive: {
    backgroundColor: Colors.light.tint,
  },
  discountTypeBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  discountTypeBtnTextActive: {
    color: '#fff',
  },
  discountValueInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: '#fff',
  },
  discountRemoveBtn: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  discountRemoveText: {
    fontSize: 22,
    lineHeight: 22,
    color: Colors.light.textSecondary,
  },
  discountReasonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  discountReasonLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
    width: 50,
  },
  discountReasonTrigger: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    height: 34,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  discountReasonTriggerText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  discountReasonPlaceholder: {
    color: Colors.light.textSecondary,
  },
  discountReasonChevron: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  discountReasonItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  discountReasonItemActive: {
    backgroundColor: Colors.light.highlightBg,
  },
  discountReasonItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  discountReasonItemTextActive: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  discountCustomInput: {
    height: 34,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: '#fff',
  },
  /* ── Discount display row ── */
  discountDisplayRow: {
    flexDirection: 'row' as const,
    paddingVertical: 5,
    marginTop: 2,
  },
  discountDisplayLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  discountDisplayValue: {
    width: 70,
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'right' as const,
    fontWeight: '600' as const,
  },
  /* ── Additional fees ── */
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
    minWidth: 0,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  feeValue: {
    width: 70,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
  },
  /* ── Grand total ── */
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
