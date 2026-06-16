import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import { 
  Save, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  Check, 
  X, 
  Download,
  Package,
  Palette,
  Truck,
  Layers,
  MapPin,
  User,
  Edit3,
  ChevronUp,
  Lock,
  AlertCircle,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useCrm } from '@/contexts/CrmContext';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency } from '@/utils/quoteCalculations';
import { SalesData, VENDORS, APPLICATORS, LineItemActualCosts, SIZE_LABELS, LineItem } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';
import { generateAndSharePDF } from '@/utils/pdfGenerator';
import { Toast } from '@/components/Toast';
import { ToggleButton } from '@/components/ToggleButton';
import { DateInput } from '@/components/DateInput';

export default function SalesTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, sales, updateSalesData, lockSale, isLoading: quotesLoading } = useQuotes();
  const { currentUser } = useUser();
  const { orgs, addOrg } = useCrm();
  const { isDesktop, isMobile } = useBreakpoint();

  const quote = useMemo(() => {
    const allItems = [...quotes, ...sales];
    return allItems.find((q) => q.id === id);
  }, [quotes, sales, id]);

  const getItemQuantity = useCallback((item: LineItem) => {
    return Object.values(item.sizes ?? {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, []);

  const getTotalSizeQuantities = useCallback((item: LineItem) => {
    const sizes: string[] = [];
    SIZE_LABELS.forEach(({ key, label }) => {
      if (item.sizes[key] > 0) {
        sizes.push(`${label}: ${item.sizes[key]}`);
      }
    });
    if (item.sizes.flat > 0) {
      sizes.push(`Flat: ${item.sizes.flat}`);
    }
    return sizes.join(', ') || 'No quantities';
  }, []);

  const initializeLineItemCosts = useCallback((): LineItemActualCosts[] => {
    if (!quote) return [];
    if (quote.salesData?.lineItemCosts && quote.salesData.lineItemCosts.length > 0) {
      return quote.salesData.lineItemCosts.map((cost, index) => ({
        ...cost,
        actualOtherCosts: cost.actualOtherCosts ?? 0,
        otherCostsDescription: cost.otherCostsDescription ?? '',
      }));
    }
    return quote.lineItems.map(item => {
      const itemQty = getItemQuantity(item);
      return {
        lineItemId: item.id,
        actualProductCost: (item.productCostEach ?? 0) * itemQty,
        productVendor: item.apparelProvider,
        actualServiceCost: (item.serviceCostEach ?? 0) * itemQty,
        applicator: item.applicator || 'Katalyst Ko Printshop',
        actualServiceFeesCost: item.serviceFeeEach ?? 0,
        actualServiceFeesProfit: 0,
        actualOtherCosts: 0,
        otherCostsDescription: '',
      };
    });
  }, [quote, getItemQuantity]);

  const [completedDate, setCompletedDate] = useState(quote?.salesData?.completedDate || '');
  const [lineItemCosts, setLineItemCosts] = useState<LineItemActualCosts[]>(initializeLineItemCosts);

  const [hasOnlineFee, setHasOnlineFee] = useState(quote?.hasOnlineFee ?? true);
  const [hasCardFee, setHasCardFee] = useState(quote?.hasCardFee ?? true);
  const [hasSalesTax, setHasSalesTax] = useState(quote?.hasSalesTax ?? false);
  const [actualOnlineFee, setActualOnlineFee] = useState(
    quote?.salesData?.actualOnlineFee?.toFixed(2) || 
    (quote?.hasOnlineFee ? (quote?.calculations?.onlineFee ?? 0).toFixed(2) : '0.00')
  );
  const [actualSalesTax, setActualSalesTax] = useState(
    quote?.salesData?.actualSalesTax?.toFixed(2) || 
    (quote?.hasSalesTax ? (quote?.calculations?.salesTax ?? 0).toFixed(2) : '0.00')
  );
  const [actualCardFee, setActualCardFee] = useState(
    quote?.salesData?.actualCardFee?.toFixed(2) || 
    (quote?.hasCardFee ? (quote?.calculations?.cardFee ?? 0).toFixed(2) : '0.00')
  );
  const [amountCollected, setAmountCollected] = useState(
    quote?.salesData?.amountCollected?.toFixed(2) || '0.00'
  );
  const [notes, setNotes] = useState(quote?.salesData?.notes || '');

  const [activeLineItemIndex, setActiveLineItemIndex] = useState<number | null>(null);
  const [vendorModalVisible, setVendorModalVisible] = useState(false);
  const [applicatorModalVisible, setApplicatorModalVisible] = useState(false);
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const parseNumber = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const formatInputValue = (value: string) => {
    const num = parseNumber(value);
    return num.toFixed(2);
  };

  const updateLineItemCost = useCallback((index: number, field: keyof LineItemActualCosts, value: string | number) => {
    setLineItemCosts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const calculations = useMemo(() => {
    const totalProductCost = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualProductCost)), 0);
    const totalServiceCost = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualServiceCost)), 0);
    const totalServiceFeesCost = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualServiceFeesCost)), 0);
    const totalServiceFeesProfit = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualServiceFeesProfit)), 0);
    const totalOtherCosts = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualOtherCosts || 0)), 0);
    const onlineFee = parseNumber(actualOnlineFee);
    const salesTax = parseNumber(actualSalesTax);
    const cardFee = parseNumber(actualCardFee);
    const collected = parseNumber(amountCollected);

    const quotedProductCost = quote?.calculations?.productCostTotal || 0;
    const quotedServiceCost = quote?.calculations?.serviceCostTotal || 0;
    const quotedFees = quote?.calculations?.serviceFeeTotal || 0;
    const quotedOnlineFee = quote?.calculations?.onlineFee || 0;
    const quotedSalesTax = quote?.calculations?.salesTax || 0;
    const quotedCardFee = quote?.calculations?.cardFee || 0;
    const actualFees = totalServiceFeesCost;
    const feesDifference = quotedFees - actualFees;

    const quotedCOG = quote?.calculations?.cogTotal || 0;
    const actualCOG = totalProductCost + totalServiceCost + totalServiceFeesCost + totalOtherCosts;
    const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;
    const quotedProfit = quote?.calculations?.markupAmount || 0;
    const actualProfit = collected - actualTotalWithFees + totalServiceFeesProfit;
    const actualProfitMargin = collected > 0 ? ((actualProfit / collected) * 100) : 0;
    const quotedProfitMargin = (quote?.calculations?.total || 0) > 0 ? ((quotedProfit / (quote?.calculations?.total || 1)) * 100) : 0;

    const cogDifference = quotedCOG - actualCOG;
    const profitDifference = actualProfit - quotedProfit;

    return {
      totalProductCost,
      totalServiceCost,
      totalServiceFeesCost,
      totalServiceFeesProfit,
      totalOtherCosts,
      feesDifference,
      quotedProductCost,
      quotedServiceCost,
      quotedFees,
      quotedOnlineFee,
      quotedSalesTax,
      quotedCardFee,
      quotedCOG,
      actualCOG,
      actualTotalWithFees,
      quotedProfit,
      actualProfit,
      actualProfitMargin,
      quotedProfitMargin,
      cogDifference,
      profitDifference,
    };
  }, [lineItemCosts, actualOnlineFee, actualSalesTax, actualCardFee, amountCollected, quote]);

  const buildSalesData = useCallback((): { salesData: SalesData; updatedLineItems: LineItem[] } | null => {
    if (!quote) return null;

    const uniqueVendors = [...new Set(lineItemCosts.map(item => item.productVendor))];
    const primaryApplicator = lineItemCosts[0]?.applicator || 'Katalyst Ko Printshop';

    const totalOtherCosts = lineItemCosts.reduce((sum, item) => sum + parseNumber(String(item.actualOtherCosts || 0)), 0);
    const otherDescriptions = lineItemCosts
      .filter(item => item.otherCostsDescription)
      .map(item => item.otherCostsDescription)
      .join('; ');

    const salesData: SalesData = {
      convertedDate: quote?.salesData?.convertedDate || '',
      completedDate,
      actualProductCost: calculations.totalProductCost,
      productVendors: uniqueVendors,
      actualServiceCost: calculations.totalServiceCost,
      applicator: primaryApplicator,
      actualServiceFeesCost: calculations.totalServiceFeesCost,
      actualServiceFeesProfit: calculations.totalServiceFeesProfit,
      actualOtherCosts: totalOtherCosts,
      otherCostsDescription: otherDescriptions,
      actualOnlineFee: parseNumber(actualOnlineFee),
      actualSalesTax: parseNumber(actualSalesTax),
      actualCardFee: parseNumber(actualCardFee),
      amountCollected: parseNumber(amountCollected),
      notes,
      lineItemCosts,
    };

    const updatedLineItems = (quote?.lineItems || []).map((item, index) => {
      const costData = lineItemCosts.find(c => c.lineItemId === item.id) || lineItemCosts[index];
      if (costData) {
        return {
          ...item,
          applicator: costData.applicator,
        };
      }
      return item;
    });

    return { salesData, updatedLineItems };
  }, [quote, completedDate, lineItemCosts, actualOnlineFee, actualSalesTax, actualCardFee, amountCollected, notes, calculations]);

  const autoAddClientIfNew = useCallback((clientName: string, _amountCollected: number) => {
    if (!clientName.trim()) return;
    const existing = orgs.find(
      (o) => o.name.toLowerCase() === clientName.trim().toLowerCase(),
    );
    if (!existing) {
      addOrg({ name: clientName.trim(), status: 'Active Client' } as any);
    }
  }, [orgs, addOrg]);

  const handleSaveOnly = useCallback(() => {
    const data = buildSalesData();
    if (!data || !quote) return;
    
    updateSalesData({ quoteId: quote.id, salesData: data.salesData, updatedLineItems: data.updatedLineItems });
    autoAddClientIfNew(quote.personOrganization, data.salesData.amountCollected);
    setSaveModalVisible(false);
    setToastMessage('Sales tracking data saved!');
    setToastVisible(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  }, [buildSalesData, quote, updateSalesData, autoAddClientIfNew, router]);

  const handleSaveAndLock = useCallback(() => {
    const data = buildSalesData();
    if (!data || !quote) return;
    
    updateSalesData({ quoteId: quote.id, salesData: data.salesData, updatedLineItems: data.updatedLineItems });
    lockSale(quote.id);
    autoAddClientIfNew(quote.personOrganization, data.salesData.amountCollected);
    setSaveModalVisible(false);
    setToastMessage('Sale saved and locked!');
    setToastVisible(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  }, [buildSalesData, quote, updateSalesData, lockSale, autoAddClientIfNew, router]);

  const handleSave = useCallback(() => {
    setSaveModalVisible(true);
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!quote) return;
    try {
      await generateAndSharePDF(quote, currentUser);
    } catch (error) {
      console.log('Error exporting PDF:', error);
      setToastMessage('Failed to export PDF');
      setToastVisible(true);
    }
  }, [quote, currentUser]);

  const handleDateChange = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length >= 2) {
      cleaned = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
    }
    if (cleaned.length >= 5) {
      cleaned = cleaned.slice(0, 5) + '-' + cleaned.slice(5);
    }
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }
    setCompletedDate(cleaned);
  };

  const openVendorModal = (index: number) => {
    setActiveLineItemIndex(index);
    setVendorModalVisible(true);
  };

  const openApplicatorModal = (index: number) => {
    setActiveLineItemIndex(index);
    setApplicatorModalVisible(true);
  };

  const selectVendor = (vendor: string) => {
    if (activeLineItemIndex !== null) {
      updateLineItemCost(activeLineItemIndex, 'productVendor', vendor);
    }
    setVendorModalVisible(false);
  };

  const selectApplicator = (applicator: string) => {
    if (activeLineItemIndex !== null) {
      updateLineItemCost(activeLineItemIndex, 'applicator', applicator);
    }
    setApplicatorModalVisible(false);
  };

  if (!quote) {
    if (quotesLoading) {
      return (
        <View style={styles.container}>
          <Stack.Screen options={{ title: 'Cost Tracking' }} />
          <View style={styles.notFound}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Cost Tracking' }} />
        <View style={styles.notFound}>
          <FileText size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Project not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isPositiveProfit = calculations.actualProfit >= 0;

  const uniqueVendors = [...new Set(lineItemCosts.map(item => item.productVendor))];
  const uniqueApplicators = [...new Set(lineItemCosts.map(item => item.applicator))];

  const renderOverviewRow = (
    label: string,
    quoted: number,
    actual: number,
    opts: { bold?: boolean; actualLower?: any; actualHigher?: any } = {}
  ) => {
    const { bold, actualLower, actualHigher } = opts;
    const lower = actualLower ?? styles.actualValueRed;
    const higher = actualHigher ?? styles.actualValueGreen;
    const actualStyle = actual < quoted ? lower : actual > quoted ? higher : undefined;

    if (isMobile) {
      return (
        <View key={label} style={styles.tableRowMobile}>
          <Text style={[styles.tableRowLabelMobile, bold && styles.tableRowLabelBoldMobile]}>
            {label}
          </Text>
          <View style={styles.tableRowMobileValues}>
            <View style={styles.tableRowMobileCell}>
              <Text style={styles.tableRowMobileCellLabel}>QUOTED</Text>
              <Text style={[styles.tableRowValueMobile, bold && styles.tableRowValueBoldMobile]}>
                {formatCurrency(quoted)}
              </Text>
            </View>
            <View style={styles.tableRowMobileCell}>
              <Text style={styles.tableRowMobileCellLabel}>ACTUAL</Text>
              <Text style={[styles.tableRowValueMobile, bold && styles.tableRowValueBoldMobile, actualStyle]}>
                {formatCurrency(actual)}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View key={label} style={bold ? styles.tableRowBold : styles.tableRow}>
        <Text style={bold ? styles.tableRowLabelBold : styles.tableRowLabel}>{label}</Text>
        <Text style={bold ? styles.tableRowValueBold : styles.tableRowValue}>
          {formatCurrency(quoted)}
        </Text>
        <Text style={[bold ? styles.tableRowValueBold : styles.tableRowValue, actualStyle]}>
          {formatCurrency(actual)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
      <Stack.Screen
        options={{
          title: 'Track Actual Costs',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />
      <PageBackHeader title="Sales Tracking" />

      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, isDesktop && { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <View style={[styles.header, isDesktop && { width: '100%' }]}>
          <Text style={styles.clientName}>{quote.personOrganization}</Text>
          <Text style={styles.projectName}>{quote.projectName}</Text>
          <View style={styles.quotedInfo}>
            <Text style={styles.quotedLabel}>Quoted Total:</Text>
            <Text style={styles.quotedValue}>{formatCurrency(quote.calculations.total)}</Text>
          </View>
        </View>

        <View style={[styles.section, isDesktop && { width: '100%' }]}>
          <DateInput
            label="Completion Date"
            value={completedDate}
            onChangeText={setCompletedDate}
          />
        </View>

        <View style={[styles.section, isDesktop && { flex: 1, minWidth: 0, marginRight: 12 }]}>
          <Text style={styles.sectionTitle}>
            Line Item Costs ({quote.lineItems.length})
          </Text>
          {quote.lineItems.map((item, index) => {
            const costData = lineItemCosts[index];
            if (!costData) return null;
            const itemQty = getItemQuantity(item);
            const isEditing = editingLineItemIndex === index;
            const quotedProductCost = item.productCostEach * itemQty;
            const quotedServiceCost = item.serviceCostEach * itemQty;
            const quotedFees = item.serviceFeeEach;
            
            return (
              <View key={item.id} style={styles.lineItemCard}>
                <View style={styles.lineItemHeader}>
                  <View style={styles.lineItemHeaderLeft}>
                    <Text style={styles.lineItemNumber}>#{index + 1}</Text>
                    <Text style={styles.lineItemName} numberOfLines={1}>
                      {item.designName || 'Untitled Design'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editDetailsBtn}
                    onPress={() => setEditingLineItemIndex(isEditing ? null : index)}
                  >
                    {isEditing ? (
                      <ChevronUp size={16} color={Colors.light.tint} />
                    ) : (
                      <Edit3 size={16} color={Colors.light.tint} />
                    )}
                    <Text style={styles.editDetailsBtnText}>
                      {isEditing ? 'Close' : 'Edit Details'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isEditing && (
                  <View style={styles.lineItemDetails}>
                    <View style={styles.detailRow}>
                      <Package size={14} color={Colors.light.textSecondary} />
                      <Text style={styles.detailLabel}>Product:</Text>
                      <Text style={styles.detailValue}>{item.product}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Palette size={14} color={Colors.light.textSecondary} />
                      <Text style={styles.detailLabel}>Color:</Text>
                      <Text style={styles.detailValue}>{item.productColor}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Layers size={14} color={Colors.light.textSecondary} />
                      <Text style={styles.detailLabel}>Service:</Text>
                      <Text style={styles.detailValue}>{item.serviceStyle}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MapPin size={14} color={Colors.light.textSecondary} />
                      <Text style={styles.detailLabel}>Location:</Text>
                      <Text style={styles.detailValue}>
                        {[item.location1, item.location2].filter(Boolean).join(', ') || 'N/A'}
                        {item.locationDetails ? ` - ${item.locationDetails}` : ''}
                      </Text>
                    </View>
                    <View style={styles.sizesBox}>
                      <Text style={styles.sizesLabel}>Sizes & Quantities</Text>
                      <Text style={styles.sizesValue}>{getTotalSizeQuantities(item)}</Text>
                      <Text style={styles.totalQty}>Total: {itemQty} pcs</Text>
                    </View>
                  </View>
                )}

                <View style={styles.costInputSection}>
                  <View style={styles.comparisonSection}>
                    <Text style={styles.comparisonSectionTitle}>Product Cost</Text>
                    <View style={styles.quotedActualRow}>
                      <View style={styles.quotedBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Quoted</Text>
                        <View style={styles.quotedValueBox}>
                          <Text style={styles.quotedValueText}>{formatCurrency(quotedProductCost)}</Text>
                        </View>
                      </View>
                      <View style={styles.actualBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Actual</Text>
                        <View style={styles.currencyInputSmall}>
                          <Text style={styles.currencySymbol}>$</Text>
                          <TextInput
                            style={styles.currencyFieldSmall}
                            value={String(costData.actualProductCost)}
                            onChangeText={(val) => updateLineItemCost(index, 'actualProductCost', val)}
                            onBlur={() => updateLineItemCost(index, 'actualProductCost', formatInputValue(String(costData.actualProductCost)))}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.dropdownTrigger}
                      onPress={() => openVendorModal(index)}
                    >
                      <Truck size={12} color={Colors.light.tint} />
                      <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                        {costData.productVendor}
                      </Text>
                      <ChevronDown size={12} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.comparisonSection}>
                    <Text style={styles.comparisonSectionTitle}>Service Cost</Text>
                    <View style={styles.quotedActualRow}>
                      <View style={styles.quotedBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Quoted</Text>
                        <View style={styles.quotedValueBox}>
                          <Text style={styles.quotedValueText}>{formatCurrency(quotedServiceCost)}</Text>
                        </View>
                      </View>
                      <View style={styles.actualBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Actual</Text>
                        <View style={styles.currencyInputSmall}>
                          <Text style={styles.currencySymbol}>$</Text>
                          <TextInput
                            style={styles.currencyFieldSmall}
                            value={String(costData.actualServiceCost)}
                            onChangeText={(val) => updateLineItemCost(index, 'actualServiceCost', val)}
                            onBlur={() => updateLineItemCost(index, 'actualServiceCost', formatInputValue(String(costData.actualServiceCost)))}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.dropdownTrigger}
                      onPress={() => openApplicatorModal(index)}
                    >
                      <User size={12} color={Colors.light.tint} />
                      <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                        {costData.applicator}
                      </Text>
                      <ChevronDown size={12} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.comparisonSection}>
                    <Text style={styles.comparisonSectionTitle}>Fees</Text>
                    <View style={styles.quotedActualRow}>
                      <View style={styles.quotedBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Quoted</Text>
                        <View style={styles.quotedValueBox}>
                          <Text style={styles.quotedValueText}>{formatCurrency(quotedFees)}</Text>
                        </View>
                      </View>
                      <View style={styles.actualBoxStyled}>
                        <Text style={styles.quotedActualLabel}>Actual</Text>
                        <View style={styles.currencyInputSmall}>
                          <Text style={styles.currencySymbol}>$</Text>
                          <TextInput
                            style={styles.currencyFieldSmall}
                            value={String(costData.actualServiceFeesCost)}
                            onChangeText={(val) => updateLineItemCost(index, 'actualServiceFeesCost', val)}
                            onBlur={() => updateLineItemCost(index, 'actualServiceFeesCost', formatInputValue(String(costData.actualServiceFeesCost)))}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={Colors.light.textSecondary}
                          />
                        </View>
                      </View>
                    </View>
                    {(() => {
                      const diff = quotedFees - parseNumber(String(costData.actualServiceFeesCost));
                      if (diff !== 0) {
                        return (
                          <View style={[styles.feeDiffBadge, diff > 0 ? styles.feeDiffPositive : styles.feeDiffNegative]}>
                            <Text style={styles.feeDiffText}>
                              {diff > 0 ? '+' : ''}{formatCurrency(diff)} {diff > 0 ? 'profit' : 'loss'}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>

                  <View style={styles.comparisonSection}>
                    <Text style={styles.comparisonSectionTitle}>Other Costs</Text>
                    <View style={styles.otherCostsInputRow}>
                      <View style={styles.otherCostsCurrencyInput}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.currencyFieldSmall}
                          value={String(costData.actualOtherCosts || '0.00')}
                          onChangeText={(val) => updateLineItemCost(index, 'actualOtherCosts', val)}
                          onBlur={() => updateLineItemCost(index, 'actualOtherCosts', formatInputValue(String(costData.actualOtherCosts || 0)))}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={Colors.light.textSecondary}
                        />
                      </View>
                    </View>
                    {parseNumber(String(costData.actualOtherCosts || 0)) > 0 && (
                      <TextInput
                        style={styles.otherCostsDescInput}
                        value={costData.otherCostsDescription || ''}
                        onChangeText={(val) => updateLineItemCost(index, 'otherCostsDescription', val)}
                        placeholder="Description (optional)"
                        placeholderTextColor={Colors.light.textSecondary}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fees & Taxes</Text>
          <View style={styles.card}>
            <ToggleButton
              label="Online Fee"
              description="2.9% + $0.60"
              value={hasOnlineFee}
              onChange={setHasOnlineFee}
            />
            <View style={styles.feeComparisonRow}>
              <View style={styles.feeQuotedBox}>
                <Text style={styles.feeCompLabel}>Quoted</Text>
                <Text style={styles.feeCompValue}>{formatCurrency(quote.calculations.onlineFee)}</Text>
              </View>
              <View style={styles.feeActualBox}>
                <Text style={styles.feeCompLabel}>Actual</Text>
                <View style={styles.currencyInputSmall}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyFieldSmall}
                    value={actualOnlineFee}
                    onChangeText={setActualOnlineFee}
                    onBlur={() => setActualOnlineFee(formatInputValue(actualOnlineFee))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.toggleDivider} />

            <ToggleButton
              label="Card Fee"
              description="3.75%"
              value={hasCardFee}
              onChange={setHasCardFee}
            />
            <View style={styles.feeComparisonRow}>
              <View style={styles.feeQuotedBox}>
                <Text style={styles.feeCompLabel}>Quoted</Text>
                <Text style={styles.feeCompValue}>{formatCurrency(quote.calculations.cardFee)}</Text>
              </View>
              <View style={styles.feeActualBox}>
                <Text style={styles.feeCompLabel}>Actual</Text>
                <View style={styles.currencyInputSmall}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyFieldSmall}
                    value={actualCardFee}
                    onChangeText={setActualCardFee}
                    onBlur={() => setActualCardFee(formatInputValue(actualCardFee))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.toggleDivider} />

            <ToggleButton
              label="Sales Tax"
              description="8.3%"
              value={hasSalesTax}
              onChange={setHasSalesTax}
            />
            <View style={styles.feeComparisonRow}>
              <View style={styles.feeQuotedBox}>
                <Text style={styles.feeCompLabel}>Quoted</Text>
                <Text style={styles.feeCompValue}>{formatCurrency(quote.calculations.salesTax)}</Text>
              </View>
              <View style={styles.feeActualBox}>
                <Text style={styles.feeCompLabel}>Actual</Text>
                <View style={styles.currencyInputSmall}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyFieldSmall}
                    value={actualSalesTax}
                    onChangeText={setActualSalesTax}
                    onBlur={() => setActualSalesTax(formatInputValue(actualSalesTax))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, isDesktop && { width: 420 }]}>
          <Text style={styles.sectionTitle}>Sales Overview</Text>
          <View style={styles.overviewCard}>
            <View style={styles.vendorApplicatorRow}>
              <View style={styles.vendorApplicatorItem}>
                <Text style={styles.vendorApplicatorLabel}>Applicator(s)</Text>
                <Text style={styles.vendorApplicatorValue}>{uniqueApplicators.join(', ')}</Text>
              </View>
              <View style={styles.vendorApplicatorItem}>
                <Text style={styles.vendorApplicatorLabel}>Source(s)</Text>
                <Text style={styles.vendorApplicatorValue}>{uniqueVendors.join(', ')}</Text>
              </View>
            </View>

            <View style={styles.tableContainer}>
              {!isMobile && (
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderLabel}></Text>
                  <Text style={styles.tableHeaderValue}>QUOTED</Text>
                  <Text style={styles.tableHeaderValue}>ACTUAL</Text>
                </View>
              )}

              {renderOverviewRow('Product Cost', calculations.quotedProductCost, calculations.totalProductCost)}
              {renderOverviewRow('Service Cost', calculations.quotedServiceCost, calculations.totalServiceCost)}
              {renderOverviewRow('Fees', calculations.quotedFees, calculations.totalServiceFeesCost)}
              {renderOverviewRow('Other Costs', 0, calculations.totalOtherCosts)}
              {renderOverviewRow('Online Fee', calculations.quotedOnlineFee, parseNumber(actualOnlineFee))}
              {renderOverviewRow('Card Fee', calculations.quotedCardFee, parseNumber(actualCardFee))}
              {renderOverviewRow('Sales Tax', calculations.quotedSalesTax, parseNumber(actualSalesTax))}

              <View style={styles.tableDivider} />

              {renderOverviewRow('Cost of Goods', calculations.quotedCOG, calculations.actualCOG, { bold: true })}
              {renderOverviewRow('Profit', calculations.quotedProfit, calculations.actualProfit, {
                bold: true,
                actualLower: styles.lossText,
                actualHigher: styles.profitText,
              })}
            </View>

            <View style={styles.amountProfitRow}>
              <View style={styles.amountCollectedBoxSide}>
                <Text style={styles.amountCollectedLabelSide}>Amount Collected</Text>
                <View style={styles.amountCollectedInputSide}>
                  <Text style={styles.currencySymbolSide}>$</Text>
                  <TextInput
                    style={styles.amountCollectedFieldSide}
                    value={amountCollected}
                    onChangeText={setAmountCollected}
                    onBlur={() => setAmountCollected(formatInputValue(amountCollected))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
                <Text style={styles.quotedTotalHintSide}>Quoted: {formatCurrency(quote.calculations.total)}</Text>
              </View>
              <View style={[styles.profitBoxSide, !isPositiveProfit && styles.profitBoxSideNegative]}>
                <Text style={styles.profitLabelSide}>ACTUAL PROFIT</Text>
                <View style={styles.profitValueRowSide}>
                  {isPositiveProfit ? (
                    <TrendingUp size={16} color="#fff" />
                  ) : (
                    <TrendingDown size={16} color="#fff" />
                  )}
                  <Text style={styles.profitValueSide}>{formatCurrency(calculations.actualProfit)}</Text>
                </View>
                <Text style={styles.profitMarginSide}>{calculations.actualProfitMargin.toFixed(1)}% margin</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, isDesktop && { width: '100%' }]}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about this sale..."
            placeholderTextColor={Colors.light.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
          <Download size={18} color={Colors.light.tint} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save size={18} color="#fff" />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={vendorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVendorModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVendorModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vendor</Text>
              <TouchableOpacity onPress={() => setVendorModalVisible(false)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[...VENDORS]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option, 
                    activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.productVendor === item && styles.optionSelected
                  ]}
                  onPress={() => selectVendor(item)}
                >
                  <Text
                    style={[
                      styles.optionText, 
                      activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.productVendor === item && styles.optionTextSelected
                    ]}
                  >
                    {item}
                  </Text>
                  {activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.productVendor === item && (
                    <Check size={18} color={Colors.light.tint} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={applicatorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setApplicatorModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setApplicatorModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Applicator</Text>
              <TouchableOpacity onPress={() => setApplicatorModalVisible(false)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[...APPLICATORS]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option, 
                    activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.applicator === item && styles.optionSelected
                  ]}
                  onPress={() => selectApplicator(item)}
                >
                  <Text
                    style={[
                      styles.optionText, 
                      activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.applicator === item && styles.optionTextSelected
                    ]}
                  >
                    {item}
                  </Text>
                  {activeLineItemIndex !== null && lineItemCosts[activeLineItemIndex]?.applicator === item && (
                    <Check size={18} color={Colors.light.tint} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalContent}>
            <View style={styles.saveModalIcon}>
              <AlertCircle size={32} color={Colors.light.tint} />
            </View>
            <Text style={styles.saveModalTitle}>Save Changes</Text>
            <Text style={styles.saveModalMessage}>
              Would you like to save your changes or save and lock this sale?
            </Text>
            <Text style={styles.saveModalHint}>
              Locked sales cannot be edited without admin password.
            </Text>
            <View style={styles.saveModalButtons}>
              <TouchableOpacity
                style={styles.saveModalCancelBtn}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={styles.saveModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalSaveBtn}
                onPress={handleSaveOnly}
              >
                <Save size={16} color="#fff" />
                <Text style={styles.saveModalSaveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalLockBtn}
                onPress={handleSaveAndLock}
              >
                <Lock size={16} color="#fff" />
                <Text style={styles.saveModalLockText}>Save & Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  header: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  projectName: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  quotedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  quotedLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  quotedValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  input: {
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  lineItemCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  lineItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lineItemNumber: {
    backgroundColor: Colors.light.tint,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    flex: 1,
  },
  editDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  lineItemDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    width: 60,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  sizesBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  sizesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  sizesValue: {
    fontSize: 13,
    color: Colors.light.text,
  },
  totalQty: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  costInputSection: {
    gap: 12,
  },
  comparisonSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 10,
  },
  comparisonSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  quotedActualRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  quotedBox: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actualBox: {
    flex: 1,
  },
  quotedActualLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  quotedActualValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  feeDiffBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  feeDiffPositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  feeDiffNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  feeDiffText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  dropdownTriggerText: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '500' as const,
    flex: 1,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  feeComparisonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  feeQuotedBox: {
    flex: 1,
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  feeActualBox: {
    flex: 1,
  },
  feeCompLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  feeCompValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#888888',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    paddingLeft: 14,
  },
  currencyField: {
    flex: 1,
    padding: 14,
    paddingLeft: 6,
    fontSize: 16,
    color: Colors.light.text,
  },
  quotedHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    fontSize: 15,
    color: Colors.light.text,
  },
  currencyInputSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currencyFieldSmall: {
    flex: 1,
    padding: 8,
    paddingLeft: 4,
    fontSize: 14,
    color: Colors.light.text,
  },
  summaryCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    flexShrink: 1,
    textAlign: 'right' as const,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryValueBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  profitText: {
    color: Colors.light.success,
  },
  lossText: {
    color: Colors.light.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },

  comparisonBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  comparisonLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  comparisonValue: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  positiveText: {
    color: Colors.light.success,
  },
  negativeText: {
    color: Colors.light.error,
  },
  notesInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    fontSize: 15,
    color: Colors.light.text,
    minHeight: 100,
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  exportButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  list: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  optionSelected: {
    backgroundColor: Colors.light.highlightBg,
  },
  optionText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  optionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  quotedBoxStyled: {
    flex: 1,
  },
  quotedValueBox: {
    backgroundColor: '#E8E8E8',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  quotedValueText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#888888',
  },
  actualBoxStyled: {
    flex: 1,
  },
  otherCostsInputRow: {
    marginBottom: 8,
  },
  otherCostsCurrencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  otherCostsDescInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 8,
    fontSize: 13,
    color: Colors.light.text,
    marginTop: 6,
  },
  overviewCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  vendorApplicatorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  vendorApplicatorItem: {
    flex: 1,
  },
  vendorApplicatorLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  vendorApplicatorValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  amountProfitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  amountCollectedBoxSide: {
    flex: 1,
    backgroundColor: Colors.light.highlightOrangeBg,
    borderRadius: 8,
    padding: 12,
  },
  amountCollectedLabelSide: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.highlightOrange,
    marginBottom: 4,
  },
  amountCollectedInputSide: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currencySymbolSide: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    paddingLeft: 10,
  },
  amountCollectedFieldSide: {
    flex: 1,
    padding: 10,
    paddingLeft: 4,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  quotedTotalHintSide: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  profitBoxSide: {
    flex: 1,
    backgroundColor: Colors.light.success,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  profitBoxSideNegative: {
    backgroundColor: Colors.light.error,
  },
  profitLabelSide: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  profitValueRowSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitValueSide: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitMarginSide: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  tableContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  tableHeaderLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  tableHeaderValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  tableRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  tableDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  tableRowBold: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  tableRowValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  tableRowMobile: {
    flexDirection: 'column' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 6,
  },
  tableRowLabelMobile: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  tableRowLabelBoldMobile: {
    fontWeight: '700' as const,
  },
  tableRowMobileValues: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  tableRowMobileCell: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableRowMobileCellLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  tableRowValueMobile: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  tableRowValueBoldMobile: {
    fontWeight: '700' as const,
  },
  profitDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  profitDiff: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  profitDiffPositive: {
    color: 'rgba(255,255,255,0.9)',
  },
  profitDiffNegative: {
    color: 'rgba(255,255,255,0.9)',
  },
  actualValueRed: {
    color: Colors.light.error,
  },
  actualValueGreen: {
    color: Colors.light.success,
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  saveModalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  saveModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  saveModalMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  saveModalHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  saveModalButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  saveModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  saveModalCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  saveModalSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  saveModalSaveText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  saveModalLockBtn: {
    flex: 1.2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  saveModalLockText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
