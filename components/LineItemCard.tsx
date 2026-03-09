import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { 
  LineItem, 
  SERVICE_STYLES, 
  EMPTY_SIZES, 
  PRODUCTS, 
  PRODUCT_COLORS, 
  APPAREL_PROVIDERS, 
  LOCATIONS,
  APPLICATORS 
} from '@/types/quote';
import { FormInput } from './FormInput';
import { CurrencyInput } from './CurrencyInput';
import { SegmentedControl } from './SegmentedControl';
import { SizeQuantityInput } from './SizeQuantityInput';
import { ComboBox } from './ComboBox';
import { getTotalQuantity, calculateLineItemSubtotal, formatCurrency } from '@/utils/quoteCalculations';

interface LineItemCardProps {
  item: LineItem;
  index: number;
  onChange: (item: LineItem) => void;
  onDelete: () => void;
}

export function LineItemCard({ item, index, onChange, onDelete }: LineItemCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [dtfWidth1, setDtfWidth1] = useState('');
  const [dtfHeight1, setDtfHeight1] = useState('');
  const [dtfWidth2, setDtfWidth2] = useState('');
  const [dtfHeight2, setDtfHeight2] = useState('');
  const [dtfRate, setDtfRate] = useState('0.04');
  const [embStitchCount1, setEmbStitchCount1] = useState('');
  const [embStitchCount2, setEmbStitchCount2] = useState('');
  const [includeDigitization, setIncludeDigitization] = useState(false);
  const isPromotional = item.serviceStyle === 'Promotional';
  const isDTF = item.serviceStyle === 'Direct to Film';
  const isEmbroidery = item.serviceStyle === 'Embroidery';
  const hasSecondLocation = item.location2 && item.location2.length > 0;
  const quantity = getTotalQuantity(item.sizes, isPromotional);
  const lineItemCalcs = calculateLineItemSubtotal(item);

  const parseNumber = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatDecimalInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return text.slice(0, -1);
    if (parts[1] && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return cleaned;
  };

  const dtfWidth1Num = parseNumber(dtfWidth1);
  const dtfHeight1Num = parseNumber(dtfHeight1);
  const dtfWidth2Num = parseNumber(dtfWidth2);
  const dtfHeight2Num = parseNumber(dtfHeight2);
  const dtfRateNum = parseNumber(dtfRate);
  
  const dtfSquareInches1 = dtfWidth1Num * dtfHeight1Num;
  const dtfCalculatedCost1 = Math.round(dtfSquareInches1 * dtfRateNum * 100) / 100;
  
  const dtfSquareInches2 = dtfWidth2Num * dtfHeight2Num;
  const dtfCalculatedCost2 = Math.round(dtfSquareInches2 * dtfRateNum * 100) / 100;
  
  const dtfTotalCalculatedCost = dtfCalculatedCost1 + dtfCalculatedCost2;

  const EMB_RATE_PER_1000 = 2.00;
  const EMB_MIN_STITCHES = 3000;
  const EMB_MAX_STITCHES = 20000;
  const DIGITIZATION_FEE = 50.00;

  const embStitchCount1Num = parseNumber(embStitchCount1);
  const embStitchCount2Num = parseNumber(embStitchCount2);
  
  const embEffectiveStitches1 = embStitchCount1Num;
  const embEffectiveStitches2 = embStitchCount2Num;
  
  const embCost1 = Math.round((EMB_RATE_PER_1000 * (embEffectiveStitches1 / 1000)) * 100) / 100;
  const embCost2 = Math.round((EMB_RATE_PER_1000 * (embEffectiveStitches2 / 1000)) * 100) / 100;
  const embTotalCost = embCost1 + embCost2;

  const formattedEmbCost1 = '$' + embCost1.toFixed(2);
  const formattedEmbCost2 = '$' + embCost2.toFixed(2);
  const formattedEmbTotalCost = '$' + embTotalCost.toFixed(2);

  const applyDTFCost = () => {
    if (dtfTotalCalculatedCost > 0) {
      onChange({ ...item, serviceCostEach: dtfTotalCalculatedCost });
    }
  };

  const applyEmbroideryCost = () => {
    if (embTotalCost > 0) {
      const updates: Partial<LineItem> = { serviceCostEach: embTotalCost };
      if (includeDigitization) {
        updates.serviceFeeEach = DIGITIZATION_FEE;
      }
      onChange({ ...item, ...updates });
    }
  };

  const handleStitchCountChange = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (cleaned === '' || (num >= 0 && num <= EMB_MAX_STITCHES)) {
      setter(cleaned);
    }
  };

  const handleServiceStyleChange = (style: typeof item.serviceStyle) => {
    const updatedItem: LineItem = {
      ...item,
      serviceStyle: style,
      sizes: style === 'Promotional' ? { ...EMPTY_SIZES, flat: item.sizes.flat || 0 } : item.sizes,
    };
    if (style === 'Direct to Film' && !item.applicator) {
      updatedItem.applicator = 'Katalyst Ko Printshop';
    }
    onChange(updatedItem);
  };

  const formattedDtfCost1 = '$' + dtfCalculatedCost1.toFixed(2);
  const formattedDtfCost2 = '$' + dtfCalculatedCost2.toFixed(2);
  const formattedDtfTotalCost = '$' + dtfTotalCalculatedCost.toFixed(2);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          <View>
            <Text style={styles.title} numberOfLines={1}>
              {item.designName || 'Untitled Design'}
            </Text>
            <Text style={styles.subtitle}>
              {item.serviceStyle} • {quantity} pcs
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Trash2 size={18} color={Colors.light.error} />
          </TouchableOpacity>
          {expanded ? (
            <ChevronUp size={20} color={Colors.light.textSecondary} />
          ) : (
            <ChevronDown size={20} color={Colors.light.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <FormInput
            label="Design Name"
            value={item.designName}
            onChangeText={(v) => onChange({ ...item, designName: v })}
            placeholder="Enter design name"
            autoTitleCase
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <ComboBox
                label="Service Applicator"
                value={item.applicator}
                options={APPLICATORS}
                onChange={(v) => onChange({ ...item, applicator: v })}
                placeholder="Select applicator"
                autoTitleCase
              />
            </View>
            <View style={styles.halfField}>
              <ComboBox
                label="Product Source"
                value={item.apparelProvider}
                options={APPAREL_PROVIDERS}
                onChange={(v) => onChange({ ...item, apparelProvider: v })}
                placeholder="Select provider"
                autoTitleCase
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <ComboBox
                label="Product"
                value={item.product}
                options={PRODUCTS}
                onChange={(v) => onChange({ ...item, product: v })}
                placeholder="Select product"
                autoTitleCase
              />
            </View>
            <View style={styles.halfField}>
              <ComboBox
                label="Color"
                value={item.productColor}
                options={PRODUCT_COLORS}
                onChange={(v) => onChange({ ...item, productColor: v })}
                placeholder="Select color"
                autoTitleCase
              />
            </View>
          </View>

          <SegmentedControl
            label="Service Style"
            options={SERVICE_STYLES}
            value={item.serviceStyle}
            onChange={handleServiceStyleChange}
            centered
          />

          {!isPromotional && (
            <View style={styles.row}>
              <View style={styles.halfField}>
                <ComboBox
                  label="Location #1"
                  value={item.location1}
                  options={[...LOCATIONS]}
                  onChange={(v) => onChange({ ...item, location1: v })}
                  placeholder="Select location"
                  autoTitleCase
                />
              </View>
              <View style={styles.halfField}>
                <ComboBox
                  label="Location #2"
                  value={item.location2}
                  options={[...LOCATIONS]}
                  onChange={(v) => onChange({ ...item, location2: v })}
                  placeholder="Select location"
                  autoTitleCase
                />
              </View>
            </View>
          )}

          <FormInput
            label="Project Notes"
            value={item.locationDetails}
            onChangeText={(v) => onChange({ ...item, locationDetails: v })}
            placeholder="e.g., 4x4 Logo, Size, Design specifics"
            autoTitleCase
          />

          <SizeQuantityInput
            sizes={item.sizes}
            onChange={(sizes) => onChange({ ...item, sizes })}
            isPromotional={isPromotional}
          />

          {isEmbroidery && (
            <View style={styles.embCalcSection}>
              <Text style={styles.embCalcTitle}>Embroidery Cost Calculator</Text>
              <Text style={styles.embCalcSubtitle}>Rate: $2.00 per 1,000 stitches (min 3,000)</Text>
              
              <Text style={styles.embLocationLabel}>Location #1 {item.location1 ? `(${item.location1})` : ''}</Text>
              <View style={styles.embInputRow}>
                <View style={styles.embInputGroup}>
                  <Text style={styles.embInputLabel}>Stitch Count</Text>
                  <View style={styles.embInputWrapper}>
                    <TextInput
                      style={styles.embInput}
                      value={embStitchCount1}
                      onChangeText={(text) => handleStitchCountChange(text, setEmbStitchCount1)}
                      keyboardType="number-pad"
                      placeholder="e.g. 5000"
                      placeholderTextColor={Colors.light.textSecondary}
                      maxLength={5}
                    />
                    {embStitchCount1 !== '' ? <Text style={styles.embInputSuffix}>stitches</Text> : null}
                  </View>
                </View>
                <View style={styles.embCostDisplay}>
                  <Text style={styles.embCostLabel}>Cost</Text>
                  <Text style={styles.embCostValue}>{formattedEmbCost1}</Text>
                </View>
              </View>
              {embStitchCount1Num > 0 && embStitchCount1Num < EMB_MIN_STITCHES ? (
                <Text style={styles.embMinNote}>Below minimum of 3,000 stitches</Text>
              ) : null}

              {hasSecondLocation && (
                <>
                  <View style={styles.embLocationDivider} />
                  <Text style={styles.embLocationLabel}>Location #2 ({item.location2})</Text>
                  <View style={styles.embInputRow}>
                    <View style={styles.embInputGroup}>
                      <Text style={styles.embInputLabel}>Stitch Count</Text>
                      <View style={styles.embInputWrapper}>
                        <TextInput
                          style={styles.embInput}
                          value={embStitchCount2}
                          onChangeText={(text) => handleStitchCountChange(text, setEmbStitchCount2)}
                          keyboardType="number-pad"
                          placeholder="e.g. 5000"
                          placeholderTextColor={Colors.light.textSecondary}
                          maxLength={5}
                        />
                        {embStitchCount2 !== '' ? <Text style={styles.embInputSuffix}>stitches</Text> : null}
                      </View>
                    </View>
                    <View style={styles.embCostDisplay}>
                      <Text style={styles.embCostLabel}>Cost</Text>
                      <Text style={styles.embCostValue}>{formattedEmbCost2}</Text>
                    </View>
                  </View>
                  {embStitchCount2Num > 0 && embStitchCount2Num < EMB_MIN_STITCHES ? (
                    <Text style={styles.embMinNote}>Below minimum of 3,000 stitches</Text>
                  ) : null}
                </>
              )}

              <View style={styles.embDigitizationRow}>
                <TouchableOpacity
                  style={styles.embCheckbox}
                  onPress={() => setIncludeDigitization(!includeDigitization)}
                >
                  <View style={[styles.embCheckboxBox, includeDigitization && styles.embCheckboxChecked]}>
                    {includeDigitization ? <Text style={styles.embCheckmark}>{'\u2713'}</Text> : null}
                  </View>
                  <Text style={styles.embCheckboxLabel}>Include Digitization Fee (+$50.00)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.embResultRow}>
                <View style={styles.embResultInfo}>
                  <Text style={styles.embResultLabel}>Service Total: </Text>
                  <Text style={styles.embResultValue}>{formattedEmbTotalCost}</Text>
                  {includeDigitization ? (
                    <Text style={styles.embDigitizationNote}> + $50 digitization</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[
                    styles.embApplyButton,
                    embTotalCost === 0 && styles.embApplyButtonDisabled,
                  ]}
                  onPress={applyEmbroideryCost}
                  disabled={embTotalCost === 0}
                >
                  <Text style={styles.embApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.costsSection}>
            <Text style={styles.costsTitle}>
              <Text>COSTS (Per Piece)  </Text>
              <Text style={styles.costsNote}>*Fees = flat per line item</Text>
            </Text>
            
            {isDTF && (
              <View style={styles.dtfCalcSection}>
                <Text style={styles.dtfCalcTitle}>DTF Cost Calculator</Text>
                
                <Text style={styles.dtfLocationLabel}>Location #1 {item.location1 ? `(${item.location1})` : ''}</Text>
                <View style={styles.dtfCalcRow}>
                  <View style={styles.dtfInputGroup}>
                    <Text style={styles.dtfInputLabel}>Width</Text>
                    <View style={styles.dtfInputWrapper}>
                      <TextInput
                        style={styles.dtfInput}
                        value={dtfWidth1}
                        onChangeText={(text) => setDtfWidth1(formatDecimalInput(text))}
                        keyboardType="decimal-pad"
                        placeholder="0.00 in"
                        placeholderTextColor={Colors.light.textSecondary}
                      />
                      {dtfWidth1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.dtfOperator}>x</Text>
                  <View style={styles.dtfInputGroup}>
                    <Text style={styles.dtfInputLabel}>Height</Text>
                    <View style={styles.dtfInputWrapper}>
                      <TextInput
                        style={styles.dtfInput}
                        value={dtfHeight1}
                        onChangeText={(text) => setDtfHeight1(formatDecimalInput(text))}
                        keyboardType="decimal-pad"
                        placeholder="0.00 in"
                        placeholderTextColor={Colors.light.textSecondary}
                      />
                      {dtfHeight1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.dtfOperator}>x</Text>
                  <View style={styles.dtfInputGroup}>
                    <Text style={styles.dtfInputLabel}>Rate</Text>
                    <View style={styles.dtfInputWrapper}>
                      <Text style={styles.dtfDollar}>$</Text>
                      <TextInput
                        style={styles.dtfRateInputInline}
                        value={dtfRate}
                        onChangeText={(text) => setDtfRate(formatDecimalInput(text))}
                        keyboardType="decimal-pad"
                        placeholder="0.04"
                        placeholderTextColor={Colors.light.textSecondary}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.dtfResultRowInline}>
                  <Text style={styles.dtfResultLabel}>
                    {dtfSquareInches1.toFixed(2)} sq in = {formattedDtfCost1}
                  </Text>
                </View>

                {hasSecondLocation && (
                  <>
                    <View style={styles.dtfLocationDivider} />
                    <Text style={styles.dtfLocationLabel}>Location #2 ({item.location2})</Text>
                    <View style={styles.dtfCalcRow}>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Width</Text>
                        <View style={styles.dtfInputWrapper}>
                          <TextInput
                            style={styles.dtfInput}
                            value={dtfWidth2}
                            onChangeText={(text) => setDtfWidth2(formatDecimalInput(text))}
                            keyboardType="decimal-pad"
                            placeholder="0.00 in"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                          {dtfWidth2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                        </View>
                      </View>
                      <Text style={styles.dtfOperator}>x</Text>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Height</Text>
                        <View style={styles.dtfInputWrapper}>
                          <TextInput
                            style={styles.dtfInput}
                            value={dtfHeight2}
                            onChangeText={(text) => setDtfHeight2(formatDecimalInput(text))}
                            keyboardType="decimal-pad"
                            placeholder="0.00 in"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                          {dtfHeight2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                        </View>
                      </View>
                      <Text style={styles.dtfOperator}>x</Text>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Rate</Text>
                        <View style={styles.dtfInputWrapper}>
                          <Text style={styles.dtfDollar}>$</Text>
                          <TextInput
                            style={styles.dtfRateInputInline}
                            value={dtfRate}
                            editable={false}
                            keyboardType="decimal-pad"
                            placeholder="0.04"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.dtfResultRowInline}>
                      <Text style={styles.dtfResultLabel}>
                        {dtfSquareInches2.toFixed(2)} sq in = {formattedDtfCost2}
                      </Text>
                    </View>
                  </>
                )}

                <View style={styles.dtfResultRow}>
                  <View style={styles.dtfResultInfo}>
                    <Text style={styles.dtfResultLabel}>Total: </Text>
                    <Text style={styles.dtfResultValue}>{formattedDtfTotalCost}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.dtfApplyButton,
                      dtfTotalCalculatedCost === 0 && styles.dtfApplyButtonDisabled,
                    ]}
                    onPress={applyDTFCost}
                    disabled={dtfTotalCalculatedCost === 0}
                  >
                    <Text style={styles.dtfApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.costsRow}>
              <View style={styles.costField}>
                <CurrencyInput
                  label="Product"
                  value={item.productCostEach}
                  onChange={(v) => onChange({ ...item, productCostEach: v })}
                />
              </View>
              <View style={styles.costField}>
                <CurrencyInput
                  label="Service"
                  value={item.serviceCostEach}
                  onChange={(v) => onChange({ ...item, serviceCostEach: v })}
                />
              </View>
              <View style={styles.costField}>
                <CurrencyInput
                  label="Fees*"
                  value={item.serviceFeeEach}
                  onChange={(v) => onChange({ ...item, serviceFeeEach: v })}
                />
              </View>
              <View style={styles.costField}>
                <CurrencyInput
                  label="Markup"
                  value={item.markupEach || 0}
                  onChange={(v) => onChange({ ...item, markupEach: v })}
                />
              </View>
            </View>

            <View style={styles.subtotalSection}>
              <View style={styles.subtotalHeader}>
                <Text style={styles.subtotalTitle}>LINE ITEM SUBTOTAL</Text>
              </View>
              <View style={styles.subtotalContent}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}></Text>
                  <Text style={styles.tableHeaderCellRight}>Each</Text>
                  <Text style={styles.tableHeaderCellRight}>Total</Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>Cost of Goods</Text>
                  <Text style={styles.tableCellRight}>
                    {formatCurrency(lineItemCalcs.quantity > 0 ? (lineItemCalcs.cogTotal / lineItemCalcs.quantity) : 0)}
                  </Text>
                  <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.cogTotal)}</Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>Fees</Text>
                  <Text style={styles.tableCellRight}>
                    {formatCurrency(lineItemCalcs.quantity > 0 ? (lineItemCalcs.serviceFeeTotal / lineItemCalcs.quantity) : 0)}
                  </Text>
                  <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.serviceFeeTotal)}</Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>Markup</Text>
                  <Text style={styles.tableCellRight}>
                    {formatCurrency(item.markupEach || 0)}
                  </Text>
                  <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.markupTotal)}</Text>
                </View>

                <View style={styles.subtotalDivider} />
                <View style={styles.subtotalTableRow}>
                  <Text style={styles.subtotalTotalLabel}>Subtotal ({lineItemCalcs.quantity} pcs)</Text>
                  <Text style={styles.subtotalTableCellRight}>{formatCurrency(lineItemCalcs.perPiece)}</Text>
                  <Text style={styles.subtotalTableCellRightBold}>{formatCurrency(lineItemCalcs.subtotal)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.light.highlightBg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    maxWidth: 180,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  content: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  costsSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  costsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  costsNote: {
    fontSize: 10,
    fontWeight: '400' as const,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },
  costsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  costField: {
    flex: 1,
  },
  dtfCalcSection: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  dtfCalcTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dtfLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
    marginTop: 4,
  },
  dtfLocationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
  },
  dtfCalcRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
  },
  dtfInputGroup: {
    flex: 1,
  },
  dtfInputLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  dtfInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    height: 38,
  },
  dtfInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    paddingVertical: 0,
  },
  dtfInputSuffix: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginLeft: 2,
  },
  dtfOperator: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    paddingBottom: 14,
  },
  dtfDollar: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  dtfRateInputInline: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    paddingVertical: 0,
  },
  dtfResultRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  dtfResultRowInline: {
    marginTop: 6,
  },
  dtfResultInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  dtfResultLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  dtfResultValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  dtfApplyButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dtfApplyButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  dtfApplyText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  subtotalSection: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  subtotalHeader: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  subtotalTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtotalContent: {
    backgroundColor: Colors.light.highlightBg,
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row' as const,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  tableHeaderCellRight: {
    width: 70,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row' as const,
    paddingVertical: 5,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  tableCellRight: {
    width: 70,
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  subtotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  subtotalLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  subtotalValue: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  subtotalDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  subtotalTableRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  subtotalTotalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtotalTableCellRight: {
    width: 70,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  subtotalTableCellRightBold: {
    width: 70,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  embCalcSection: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  embCalcTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  embCalcSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  embLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
    marginTop: 4,
  },
  embLocationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
  },
  embInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 12,
  },
  embInputGroup: {
    flex: 1,
  },
  embInputLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  embInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 42,
  },
  embInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  embInputSuffix: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  embCostDisplay: {
    alignItems: 'center' as const,
    minWidth: 70,
  },
  embCostLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  embCostValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  embMinNote: {
    fontSize: 10,
    color: Colors.light.tint,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  embDigitizationRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embCheckbox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  embCheckboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  embCheckboxChecked: {
    backgroundColor: Colors.light.tint,
  },
  embCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  embCheckboxLabel: {
    fontSize: 13,
    color: Colors.light.text,
  },
  embResultRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embResultInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    flex: 1,
  },
  embResultLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  embResultValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  embDigitizationNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  embApplyButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  embApplyButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  embApplyText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
