import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Edit3,
  FileText,
  Calendar,
  MapPin,
  Package,
  Palette,
  Truck,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Download,
  Printer,
  User,
  MoreVertical,
  X,
  RotateCcw,
  Trash2,
  Sheet,
  Lock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency, calculateLineItemSubtotal, getTotalQuantity } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { LineItem, SIZE_LABELS } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';
import { Toast } from '@/components/Toast';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, sales, convertToSale, convertToQuote, deleteQuote, isConverting, markExportedToSheets, lockSale } = useQuotes();
  const { currentUser } = useUser();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { isDesktop } = useBreakpoint();

  const quote = useMemo(() => {
    const allQuotes = [...quotes, ...sales];
    return allQuotes.find((q) => q.id === id);
  }, [quotes, sales, id]);

  

  const getTotalSizeQuantities = (item: LineItem) => {
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
  };

  const getItemQuantity = (item: LineItem) => {
    const isPromotional = item.serviceStyle === 'Promotional';
    return getTotalQuantity(item.sizes, isPromotional);
  };

  const handleExportPDF = useCallback(async () => {
    if (!quote) return;
    try {
      await generateAndSharePDF(quote, currentUser);
    } catch (error) {
      console.log('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    }
  }, [quote, currentUser]);

  const handlePrint = useCallback(async () => {
    if (!quote) return;
    try {
      await printQuote(quote, currentUser);
    } catch (error) {
      console.log('Error printing:', error);
      Alert.alert('Error', 'Failed to print');
    }
  }, [quote, currentUser]);

  const handleEdit = useCallback(() => {
    if (!quote) return;
    router.push({
      pathname: '/quote/edit',
      params: { id: quote.id },
    });
  }, [quote, router]);

  const handleConvertToSale = useCallback(() => {
    if (!quote) return;
    convertToSale(quote.id);
    setToastMessage('Quote converted to sale!');
    setToastVisible(true);
    setTimeout(() => {
      router.replace('/(tabs)/sales');
    }, 500);
  }, [quote, convertToSale, router]);

  const handleTrackSales = useCallback(() => {
    if (!quote) return;
    router.push({
      pathname: '/quote/sales-tracking',
      params: { id: quote.id },
    });
  }, [quote, router]);

  const handleRevertToQuote = useCallback(() => {
    if (!quote) return;
    if (quote.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked. Unlock it first to revert.');
      return;
    }
    setMenuVisible(false);
    Alert.alert(
      'Revert to Quote',
      `Are you sure you want to revert "${quote.projectName}" back to a pending quote?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          onPress: () => {
            convertToQuote(quote.id);
            setToastMessage('Sale reverted to quote!');
            setToastVisible(true);
            setTimeout(() => {
              router.replace('/(tabs)/history');
            }, 500);
          },
        },
      ]
    );
  }, [quote, convertToQuote, router]);

  const handleSaveAndLock = useCallback(() => {
    if (!quote) return;
    setMenuVisible(false);
    Alert.alert(
      'Save & Lock',
      `Are you sure you want to lock "${quote.projectName}"? You will need an admin password to unlock it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: () => {
            lockSale(quote.id);
            setToastMessage('Sale has been locked.');
            setToastVisible(true);
          },
        },
      ]
    );
  }, [quote, lockSale]);

  const handleExportToSheets = useCallback(async () => {
    if (!quote || !quote.salesData) return;
    setMenuVisible(false);
    
    if (!currentUser?.googleSheetsUrl) {
      Alert.alert(
        'Setup Required',
        'Please set up your Google Sheets Web App URL in Profile settings first. Tap "How to set up Google Sheets integration" for instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, quote);
      
      if (result.success) {
        markExportedToSheets(quote.id);
        setToastMessage('Sale exported to Google Sheets!');
        setToastVisible(true);
      } else {
        Alert.alert('Export Failed', result.message);
      }
    } catch (error) {
      console.log('Error exporting to sheets:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [quote, currentUser?.googleSheetsUrl, markExportedToSheets]);

  const handleDelete = useCallback(() => {
    if (!quote) return;
    setMenuVisible(false);
    Alert.alert(
      'Delete',
      `Are you sure you want to delete "${quote.projectName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteQuote(quote.id);
            router.back();
          },
        },
      ]
    );
  }, [quote, deleteQuote, router]);

  const getSalesCalculations = useCallback(() => {
    if (!quote?.salesData) return null;
    const serviceFeesCost = quote.salesData.actualServiceFeesCost ?? 0;
    const serviceFeesProfit = quote.salesData.actualServiceFeesProfit ?? 0;
    const onlineFee = quote.salesData.actualOnlineFee ?? 0;
    const salesTax = quote.salesData.actualSalesTax ?? 0;
    const cardFee = quote.salesData.actualCardFee ?? 0;
    
    const actualCOG = quote.salesData.actualProductCost + quote.salesData.actualServiceCost + 
                      serviceFeesCost + quote.salesData.actualOtherCosts;
    const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;
    
    const quotedFees = quote.calculations.serviceFeeTotal;
    const feesDifference = quotedFees - serviceFeesCost;
    
    const actualProfit = quote.salesData.amountCollected - actualTotalWithFees + serviceFeesProfit;
    const actualProfitMargin = quote.salesData.amountCollected > 0 
      ? ((actualProfit / quote.salesData.amountCollected) * 100) 
      : 0;
    const quotedVsActualCOGDiff = quote.calculations.cogTotal - actualCOG;
    const quotedVsActualProfitDiff = actualProfit - quote.calculations.markupAmount;
    
    const actualSubtotal = actualCOG + actualProfit;
    const quotedSubtotal = quote.calculations.subtotal;
    
    return { 
      actualCOG, 
      actualProfit, 
      actualProfitMargin, 
      quotedVsActualCOGDiff, 
      quotedVsActualProfitDiff, 
      serviceFeesProfit,
      actualSubtotal,
      quotedSubtotal,
      onlineFee,
      salesTax,
      cardFee,
    };
  }, [quote]);

  if (!quote) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Quote Details' }} />
        <View style={styles.notFound}>
          <FileText size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Quote not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
      <Stack.Screen
        options={{
          title: 'Quote Details',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, isDesktop && { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }]}>
        <View style={[styles.section, isDesktop && { width: '100%' }]}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.card}>
            <View style={styles.orderHeaderRow}>
              <View style={styles.orderHeaderLeft}>
                {quote.status === 'sale' && (
                  <View style={styles.saleBadge}>
                    <CheckCircle size={12} color="#fff" />
                    <Text style={styles.saleBadgeText}>SALE</Text>
                  </View>
                )}
                <View style={styles.orderTypeBadge}>
                  <Text style={styles.orderTypeBadgeText}>{quote.orderType}</Text>
                </View>
              </View>
              {quote.invoiceNumber && (
                <View style={styles.invoiceBadge}>
                  <FileText size={12} color={Colors.light.tint} />
                  <Text style={styles.invoiceText}>#{quote.invoiceNumber}</Text>
                </View>
              )}
            </View>
            <Text style={styles.orderClientName}>{quote.personOrganization}</Text>
            <Text style={styles.orderProjectName}>{quote.projectName}</Text>
            <View style={styles.orderDivider} />
            <View style={styles.infoRow}>
              <Calendar size={16} color={Colors.light.textSecondary} />
              <Text style={styles.infoLabel}>Order Date:</Text>
              <Text style={styles.infoValue}>{formatDate(quote.orderDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Calendar size={16} color={Colors.light.textSecondary} />
              <Text style={styles.infoLabel}>In-Hands Date:</Text>
              <Text style={styles.infoValue}>{formatDate(quote.inHandsDate) || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, isDesktop && { flex: 1, minWidth: 0, marginRight: 12 }]}>
          <Text style={styles.sectionTitle}>
            Line Items ({quote.lineItems.length})
          </Text>
          {quote.lineItems.map((item, index) => (
            <View key={item.id} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemNumber}>#{index + 1}</Text>
                <Text style={styles.lineItemName}>
                  {item.designName || 'Untitled Design'}
                </Text>
              </View>
              
              <View style={styles.lineItemDetails}>
                {item.applicator && (
                  <View style={styles.detailRow}>
                    <User size={14} color={Colors.light.tint} />
                    <Text style={styles.detailLabel}>Applicator:</Text>
                    <Text style={[styles.detailValue, styles.applicatorValue]}>{item.applicator}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Truck size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.detailLabel}>Source:</Text>
                  <Text style={styles.detailValue}>{item.apparelProvider}</Text>
                </View>
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
              </View>

              <View style={styles.sizesBox}>
                <Text style={styles.sizesLabel}>Sizes & Quantities</Text>
                <Text style={styles.sizesValue}>{getTotalSizeQuantities(item)}</Text>
                <Text style={styles.totalQty}>Total: {getItemQuantity(item)} pcs</Text>
              </View>

              <View style={styles.costsBox}>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Product</Text>
                  <Text style={styles.costValue}>{formatCurrency(item.productCostEach)}/ea</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Service</Text>
                  <Text style={styles.costValue}>{formatCurrency(item.serviceCostEach)}/ea</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Fees</Text>
                  <Text style={styles.costValue}>{formatCurrency(item.serviceFeeEach)}</Text>
                </View>
                <View style={styles.costItem}>
                  <Text style={styles.costLabel}>Markup</Text>
                  <Text style={styles.costValue}>{formatCurrency(item.markupEach || 0)}/ea</Text>
                </View>
              </View>

              {(() => {
                const calcs = calculateLineItemSubtotal(item);
                return (
                  <View style={styles.lineItemSubtotalBox}>
                    <View style={styles.lineItemSubtotalRow}>
                      <Text style={styles.lineItemSubtotalLabel}>Line Item Subtotal</Text>
                      <Text style={styles.lineItemSubtotalValue}>{formatCurrency(calcs.subtotal)}</Text>
                    </View>
                    <View style={styles.lineItemPerPieceRow}>
                      <Text style={styles.lineItemPerPieceLabel}>{calcs.quantity} pcs @ {formatCurrency(calcs.perPiece)}/ea</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          ))}
        </View>

        <View style={[styles.section, isDesktop && { width: 380 }]}>
          <Text style={styles.sectionTitle}>Pricing Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total Quantity</Text>
              <Text style={styles.summaryValueBold}>{quote.calculations.totalQuantity} pcs</Text>
            </View>
            <View style={styles.divider} />
            
            <View style={styles.pricingTableContainer}>
              <View style={styles.pricingTableHeader}>
                <Text style={styles.pricingTableHeaderLabel}></Text>
                <Text style={styles.pricingTableHeaderValue}>EACH</Text>
                <Text style={styles.pricingTableHeaderValue}>TOTAL</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Product Cost</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.productCostTotal / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.productCostTotal)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Service Cost</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.serviceCostTotal / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.serviceCostTotal)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Service Fees</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.serviceFeeTotal / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.serviceFeeTotal)}</Text>
              </View>

              <View style={styles.pricingTableDivider} />

              <View style={styles.pricingTableRowBold}>
                <Text style={styles.pricingTableRowLabelBold}>Cost of Goods</Text>
                <Text style={styles.pricingTableRowValueBold}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.cogTotal / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValueBold}>{formatCurrency(quote.calculations.cogTotal)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Markup ({quote.calculations.markupPercentage.toFixed(1)}%)</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.markupAmount / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.markupAmount)}</Text>
              </View>

              <View style={styles.pricingTableDivider} />

              <View style={styles.pricingTableRowBold}>
                <Text style={styles.pricingTableRowLabelBold}>Subtotal</Text>
                <Text style={styles.pricingTableRowValueBold}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.subtotal / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValueBold}>{formatCurrency(quote.calculations.subtotal)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Online Fee (2.9% + $0.60)</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.onlineFee / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.onlineFee)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Card Fee (3.75%)</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.cardFee / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.cardFee)}</Text>
              </View>

              <View style={styles.pricingTableRow}>
                <Text style={styles.pricingTableRowLabel}>Sales Tax (8.3%)</Text>
                <Text style={styles.pricingTableRowValue}>
                  {formatCurrency(quote.calculations.totalQuantity > 0 ? quote.calculations.salesTax / quote.calculations.totalQuantity : 0)}
                </Text>
                <Text style={styles.pricingTableRowValue}>{formatCurrency(quote.calculations.salesTax)}</Text>
              </View>
            </View>
            
            <View style={styles.totalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <View style={styles.totalDoubleValue}>
                  <Text style={styles.totalValueSmall}>{formatCurrency(quote.calculations.totalPerPiece)}</Text>
                  <Text style={styles.totalValue}>{formatCurrency(quote.calculations.total)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {isDesktop && quote.status === 'sale' && quote.salesData && (
          <View style={{ flex: 1, minWidth: 0, marginRight: 12 }} />
        )}
        {quote.status === 'sale' && quote.salesData && (
          <View style={[styles.section, isDesktop && { width: 380 }]}>
            <Text style={styles.sectionTitle}>Sales Tracking</Text>
            <View style={styles.salesTrackingCard}>
              {(() => {
                const uniqueVendors = quote.salesData?.lineItemCosts 
                  ? [...new Set(quote.salesData.lineItemCosts.map(c => c.productVendor))]
                  : quote.salesData?.productVendors || [];
                const uniqueApplicators = quote.salesData?.lineItemCosts 
                  ? [...new Set(quote.salesData.lineItemCosts.map(c => c.applicator))]
                  : quote.salesData?.applicator ? [quote.salesData.applicator] : [];
                return (
                  <View style={styles.vendorApplicatorRow}>
                    <View style={styles.vendorApplicatorItem}>
                      <Text style={styles.vendorApplicatorLabel}>Applicator(s)</Text>
                      <Text style={styles.vendorApplicatorValue}>{uniqueApplicators.join(', ') || 'N/A'}</Text>
                    </View>
                    <View style={styles.vendorApplicatorItem}>
                      <Text style={styles.vendorApplicatorLabel}>Source(s)</Text>
                      <Text style={styles.vendorApplicatorValue}>{uniqueVendors.join(', ') || 'N/A'}</Text>
                    </View>
                  </View>
                );
              })()}

              <View style={styles.salesDatesRow}>
                <View style={styles.salesDateItem}>
                  <Text style={styles.salesDateLabel}>Converted</Text>
                  <Text style={styles.salesDateValue}>{formatDate(quote.salesData.convertedDate)}</Text>
                </View>
                {quote.salesData.completedDate && (
                  <View style={styles.salesDateItem}>
                    <Text style={styles.salesDateLabel}>Completed</Text>
                    <Text style={styles.salesDateValue}>{formatDate(quote.salesData.completedDate)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.salesDivider} />

              {(() => {
                const calc = getSalesCalculations();
                if (!calc) return null;
                return (
                  <View style={styles.salesTableContainer}>
                    <View style={styles.salesTableHeader}>
                      <Text style={styles.salesTableHeaderLabel}></Text>
                      <Text style={styles.salesTableHeaderValue}>QUOTED</Text>
                      <Text style={styles.salesTableHeaderValue}>ACTUAL</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Product Cost</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.productCostTotal)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData!.actualProductCost)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Service Cost</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceCostTotal)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData!.actualServiceCost)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Service Fees</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceFeeTotal)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData!.actualServiceFeesCost ?? 0)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Other Costs</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(0)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData!.actualOtherCosts)}</Text>
                    </View>

                    <View style={styles.salesTableDivider} />

                    <View style={styles.salesTableRowBold}>
                      <Text style={styles.salesTableRowLabelBold}>Cost of Goods</Text>
                      <Text style={styles.salesTableRowValueBold}>{formatCurrency(quote.calculations.cogTotal)}</Text>
                      <Text style={styles.salesTableRowValueBold}>{formatCurrency(calc.actualCOG)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Markup ({quote.calculations.markupPercentage.toFixed(1)}%)</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.markupAmount)}</Text>
                      <Text style={[styles.salesTableRowValue, calc.actualProfit < quote.calculations.markupAmount ? styles.negativeText : styles.positiveText]}>
                        {formatCurrency(calc.actualProfit)}
                      </Text>
                    </View>

                    <View style={styles.salesTableDivider} />

                    <View style={styles.salesTableRowBold}>
                      <Text style={styles.salesTableRowLabelBold}>Subtotal</Text>
                      <Text style={styles.salesTableRowValueBold}>{formatCurrency(quote.calculations.subtotal)}</Text>
                      <Text style={styles.salesTableRowValueBold}>{formatCurrency(calc.actualCOG + calc.actualProfit)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Online Fee (2.9% + $0.60)</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.onlineFee)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(calc.onlineFee)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Card Fee (3.75%)</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.cardFee)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(calc.cardFee)}</Text>
                    </View>

                    <View style={styles.salesTableRow}>
                      <Text style={styles.salesTableRowLabel}>Sales Tax (8.3%)</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.salesTax)}</Text>
                      <Text style={styles.salesTableRowValue}>{formatCurrency(calc.salesTax)}</Text>
                    </View>
                  </View>
                );
              })()}

              {(() => {
                const calc = getSalesCalculations();
                if (!calc) return null;
                const isPositive = calc.actualProfit >= 0;
                return (
                  <View style={styles.amountProfitRow}>
                    <View style={styles.amountCollectedBoxSide}>
                      <Text style={styles.amountCollectedLabelSide}>Amount Collected</Text>
                      <Text style={styles.amountCollectedValueSide}>{formatCurrency(quote.salesData.amountCollected)}</Text>
                      <Text style={styles.quotedTotalHintSide}>Quoted: {formatCurrency(quote.calculations.total)}</Text>
                    </View>
                    <View style={[styles.profitBoxSide, !isPositive && styles.profitBoxNegative]}>
                      <Text style={styles.profitLabelSide}>ACTUAL PROFIT</Text>
                      <View style={styles.profitValueRowSide}>
                        {isPositive ? (
                          <TrendingUp size={16} color="#fff" />
                        ) : (
                          <TrendingDown size={16} color="#fff" />
                        )}
                        <Text style={styles.profitValueSide}>{formatCurrency(calc.actualProfit)}</Text>
                      </View>
                      <Text style={styles.profitMarginSide}>{calc.actualProfitMargin.toFixed(1)}% margin</Text>
                    </View>
                  </View>
                );
              })()}
              
              {quote.salesData.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notesText}>{quote.salesData.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {isDesktop && <View style={{ width: '100%' }} />}
        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.actionBar}>
        {quote.status === 'sale' ? (
          <>
            <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
              <MoreVertical size={20} color={Colors.light.tint} />
            </TouchableOpacity>
            {quote.isLocked ? (
              <View style={styles.lockedButton}>
                <Lock size={18} color="#fff" />
                <Text style={styles.lockedButtonText}>Sale Locked</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.trackButton} onPress={handleTrackSales}>
                <ClipboardList size={18} color="#fff" />
                <Text style={styles.trackButtonText}>Track Actual Costs</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
              <MoreVertical size={20} color={Colors.light.tint} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.convertButton} 
              onPress={handleConvertToSale}
              disabled={isConverting}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.convertButtonText}>{isConverting ? 'Converting...' : 'Convert to Sale'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {menuVisible && (
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Options</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <X size={20} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            {quote.status === 'sale' && quote.isLocked ? (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => setMenuVisible(false)}
              >
                <Lock size={18} color={Colors.light.textSecondary} />
                <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Sale is Locked</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  setMenuVisible(false);
                  handleEdit();
                }}
              >
                <Edit3 size={18} color={Colors.light.text} />
                <Text style={styles.menuItemText}>Edit Quote</Text>
              </TouchableOpacity>
            )}
            {quote.status === 'sale' && !quote.isLocked && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={handleSaveAndLock}
              >
                <Lock size={18} color={Colors.light.tint} />
                <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Save & Lock</Text>
              </TouchableOpacity>
            )}
            {quote.status !== 'sale' && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  setMenuVisible(false);
                  handleConvertToSale();
                }}
              >
                <CheckCircle size={18} color={Colors.light.success} />
                <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Convert to Sale</Text>
              </TouchableOpacity>
            )}
            {quote.status === 'sale' && !quote.isLocked && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={handleRevertToQuote}
              >
                <RotateCcw size={18} color={Colors.light.textSecondary} />
                <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Revert Back</Text>
              </TouchableOpacity>
            )}
            {quote.status === 'sale' && (
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={handleExportToSheets}
              >
                <Sheet size={18} color={Colors.light.success} />
                <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                handleExportPDF();
              }}
            >
              <Download size={18} color={Colors.light.text} />
              <Text style={styles.menuItemText}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                handlePrint();
              }}
            >
              <Printer size={18} color={Colors.light.text} />
              <Text style={styles.menuItemText}>Print</Text>
            </TouchableOpacity>
            {(!quote.isLocked || quote.status !== 'sale') && (
              <TouchableOpacity 
                style={[styles.menuItem, styles.menuItemLast]} 
                onPress={handleDelete}
              >
                <Trash2 size={18} color={Colors.light.error} />
                <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
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
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  orderTypeBadge: {
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderTypeBadgeText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  invoiceText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  orderClientName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  orderProjectName: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  orderDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  lineItemCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
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
  lineItemDetails: {
    gap: 6,
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
  applicatorValue: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  sizesBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
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
  costsBox: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  costItem: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  costValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 2,
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
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.light.text,
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
  summaryDoubleValue: {
    flexDirection: 'row',
    gap: 24,
  },
  pricingTableContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pricingTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  pricingTableHeaderLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  pricingTableHeaderValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  pricingTableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  pricingTableRowMuted: {},
  pricingTableRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pricingTableRowLabelMuted: {
    color: Colors.light.border,
  },
  pricingTableRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  pricingTableRowValueMuted: {
    color: Colors.light.border,
  },
  pricingTableDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  pricingTableRowBold: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  pricingTableRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  pricingTableRowValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  totalDoubleValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
  },
  totalValueSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  totalBox: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  perPieceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  perPieceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  perPieceValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
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
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    gap: 8,
  },
  pdfButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  convertButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    gap: 8,
  },
  convertButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    gap: 8,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  lockedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#6b7280',
    gap: 8,
  },
  lockedButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  amountProfitRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  amountCollectedBoxSide: {
    flex: 1,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 12,
  },
  amountCollectedLabelSide: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  amountCollectedValueSide: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  quotedTotalHintSide: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  profitBoxSide: {
    flex: 1,
    backgroundColor: Colors.light.success,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
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
  saleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  saleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  profitBox: {
    backgroundColor: Colors.light.success,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  profitBoxNegative: {
    backgroundColor: Colors.light.error,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profitValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitMargin: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'right' as const,
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
  summaryLabelMuted: {
    color: Colors.light.border,
  },
  summaryValueMuted: {
    color: Colors.light.border,
  },
  salesTrackingCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  vendorApplicatorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
  salesDatesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  salesDateItem: {
    flex: 1,
  },
  salesDateLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  salesDateValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  salesDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginBottom: 12,
  },
  amountCollectedBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountCollectedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  amountCollectedValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  quotedTotalHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  salesTableContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  salesTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  salesTableHeaderLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  salesTableHeaderValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  salesTableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  salesTableRowMuted: {},
  salesTableRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  salesTableRowLabelMuted: {
    color: Colors.light.border,
  },
  salesTableRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  salesTableRowValueMuted: {
    color: Colors.light.border,
  },
  salesTableDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  salesTableRowBold: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  salesTableRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  salesTableRowValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
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
    color: 'rgba(255,255,255,0.9)',
  },
  notesBox: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  lineItemSubtotalBox: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  lineItemSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemSubtotalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  lineItemSubtotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemPerPieceRow: {
    marginTop: 4,
  },
  lineItemPerPieceLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
});
