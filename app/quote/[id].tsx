import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Edit3,
  FileText,
  Calendar,
  MapPin,
  Package,
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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency, calculateLineItemSubtotal, getTotalQuantity } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { LineItem, SIZE_LABELS, GarmentVariant } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, sales, convertToSale, convertToQuote, deleteQuote, isConverting, markExportedToSheets, lockSale, projects } = useQuotes();
  const { currentUser } = useUser();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);
  const { isDesktop } = useBreakpoint();

  const allProjects = useMemo(() => {
    return (projects || [...quotes, ...sales]).slice().sort((a, b) => {
      const da = new Date(a.orderDate).getTime();
      const db = new Date(b.orderDate).getTime();
      return db - da;
    });
  }, [projects, quotes, sales]);

  const quote = useMemo(() => {
    return allProjects.find((q) => q.id === id);
  }, [allProjects, id]);

  const currentIndex = useMemo(() => allProjects.findIndex(q => q.id === id), [allProjects, id]);
  const prevQuote = currentIndex > 0 ? allProjects[currentIndex - 1] : null;
  const nextQuote = currentIndex < allProjects.length - 1 ? allProjects[currentIndex + 1] : null;

  const goToPrev = useCallback(() => {
    if (prevQuote) router.replace(`/quote/${prevQuote.id}`);
  }, [prevQuote, router]);

  const goToNext = useCallback(() => {
    if (nextQuote) router.replace(`/quote/${nextQuote.id}`);
  }, [nextQuote, router]);

  

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
    setMenuVisible(false);
    convertToSale(quote.id);
    setToastMessage('Project marked as Active!');
    setToastVisible(true);
  }, [quote, convertToSale]);

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
      Alert.alert('Locked', 'Unlock this project first before reverting.');
      return;
    }
    setMenuVisible(false);
    convertToQuote(quote.id);
    setToastMessage('Reverted to Quoted status.');
    setToastVisible(true);
  }, [quote, convertToQuote]);

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
    setConfirmDeleteVisible(true);
  }, [quote]);

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

  const renderOrderInfo = () => (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.orderHeaderRow}>
          <View style={styles.orderHeaderLeft}>
            {(quote.status === 'active' || quote.status === 'completed') && (
              <View style={[styles.saleBadge, { backgroundColor: quote.status === 'completed' ? '#16A34A' : '#FF5A00' }]}>
                <CheckCircle size={12} color="#fff" />
                <Text style={styles.saleBadgeText}>{quote.status === 'completed' ? 'COMPLETED' : 'ACTIVE'}</Text>
              </View>
            )}
            <View style={styles.orderTypeBadge}>
              <Text style={styles.orderTypeBadgeText}>{quote.orderType}</Text>
            </View>
          </View>
          {quote.invoiceNumber ? (
            <View style={styles.invoiceBadge}>
              <FileText size={12} color={Colors.light.tint} />
              <Text style={styles.invoiceText}>#{quote.invoiceNumber}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.orderClientName}>{quote.personOrganization}</Text>
        <Text style={styles.orderProjectName}>{quote.projectName}</Text>
        <View style={styles.orderDivider} />
        <View style={styles.infoRow}>
          <Calendar size={15} color={Colors.light.textSecondary} />
          <Text style={styles.infoLabel}>Order Date:</Text>
          <Text style={styles.infoValue}>{formatDate(quote.orderDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Calendar size={15} color={Colors.light.textSecondary} />
          <Text style={styles.infoLabel}>In-Hands:</Text>
          <Text style={styles.infoValue}>{formatDate(quote.inHandsDate) || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );

  const renderLineItems = () => {
    const totalItems = quote.lineItems.reduce((sum, item) => sum + getItemQuantity(item), 0);
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Line Items ({quote.lineItems.length})</Text>
        </View>
        {quote.lineItems.map((item, index) => {
          const isExpanded = expandedItems[item.id] !== false;
          const qty = getItemQuantity(item);
          const calcs = calculateLineItemSubtotal(item);
          const variants: GarmentVariant[] = item.garmentVariants && item.garmentVariants.length > 0
            ? item.garmentVariants
            : [{ product: item.product, color: item.productColor, sizes: item.sizes }];
          const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];
          const isPromotional = item.serviceStyle === 'Promotional';
          return (
            <View key={item.id} style={styles.lineItemCard}>
              <TouchableOpacity style={styles.lineItemHeader} onPress={() => toggleItem(item.id)} activeOpacity={0.8}>
                <View style={styles.lineItemHeaderLeft}>
                  <Text style={styles.lineItemNumber}>#{index + 1}</Text>
                  <View style={styles.lineItemHeaderInfo}>
                    <Text style={styles.lineItemHeaderName} numberOfLines={1}>{item.designName || 'Untitled Design'}</Text>
                  </View>
                </View>
                <View style={styles.lineItemHeaderRight}>
                  <Text style={styles.lineItemHeaderQty}>{qty} pcs</Text>
                  {isExpanded ? <ChevronUp size={16} color="rgba(255,255,255,0.7)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.7)" />}
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.lineItemBody}>
                  {/* Mockup — left 1/3 */}
                  <View style={styles.lineItemMockupCol}>
                    {item.mockupUri ? (
                      <Image
                        source={{ uri: item.mockupUri }}
                        style={styles.mockupImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.mockupPlaceholder}>
                        <Package size={28} color={Colors.light.border} />
                        <Text style={styles.mockupPlaceholderText}>No mockup</Text>
                      </View>
                    )}
                  </View>

                  {/* Right panel — all details + sizes + costs + subtotal (2/3) */}
                  <View style={styles.lineItemRightCol}>
                    {/* Detail rows */}
                    <View style={styles.lineItemDetailsCol}>
                      {/* Service Style */}
                      <View style={styles.detailRow}>
                        <Layers size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={styles.detailLabel}>Service</Text>
                        <Text style={styles.detailValue}>{item.serviceStyle}</Text>
                      </View>

                      {/* Applicator */}
                      {item.applicator ? (
                        <View style={styles.detailRow}>
                          <User size={13} color={Colors.light.text} style={{ flexShrink: 0 }} />
                          <Text style={styles.detailLabel}>Applicator</Text>
                          <Text style={[styles.detailValue, styles.applicatorValue]} numberOfLines={1}>{item.applicator}</Text>
                        </View>
                      ) : null}

                      {/* Source */}
                      <View style={styles.detailRow}>
                        <Truck size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={styles.detailLabel}>Source</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.apparelProvider}</Text>
                      </View>

                      {/* Product per variant */}
                      {variants.length === 1 ? (
                        <View style={styles.detailRow}>
                          <Package size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                          <Text style={styles.detailLabel}>Product</Text>
                          <Text style={styles.detailValue} numberOfLines={2}>
                            {variants[0].product || '—'}{variants[0].color ? ` — ${variants[0].color}` : ''}
                          </Text>
                        </View>
                      ) : (
                        variants.map((v, vi) => (
                          <View key={vi} style={styles.detailRow}>
                            <Package size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                            <Text style={styles.detailLabel}>Product #{vi + 1}</Text>
                            <Text style={styles.detailValue} numberOfLines={2}>
                              {v.product || '—'}{v.color ? ` — ${v.color}` : ''}
                            </Text>
                          </View>
                        ))
                      )}

                      {/* Locations */}
                      {locations.length > 0 && (
                        <View style={styles.detailRow}>
                          <MapPin size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                          <Text style={styles.detailLabel}>Location</Text>
                          <Text style={styles.detailValue}>{locations.join(', ')}</Text>
                        </View>
                      )}

                      {/* Project Notes — always shown */}
                      <View style={styles.detailRow}>
                        <FileText size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={styles.detailLabel}>Project Notes</Text>
                        <Text style={[styles.detailValue, !item.locationDetails && styles.detailValueMuted]}>
                          {item.locationDetails || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Sizes grid — one per variant */}
                    {variants.map((v, vi) => (
                      <View key={vi} style={styles.sizesGridSection}>
                        {variants.length > 1 && (
                          <Text style={styles.variantSizeHeading}>
                            {v.product}{v.color ? ` — ${v.color}` : ''}
                          </Text>
                        )}
                        <Text style={styles.sizesGridLabel}>Sizes + Quantities</Text>
                        {isPromotional ? (
                          <View style={styles.sizesGridRow}>
                            <View style={styles.sizeGridCell}>
                              <Text style={styles.sizeGridCellLabel}>Qty</Text>
                              <View style={styles.sizeGridCellBox}>
                                <Text style={styles.sizeGridCellValue}>{v.sizes.flat || 0}</Text>
                              </View>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={styles.sizesGridRow}>
                              {(['xs','s','m','l'] as const).map(k => {
                                const entry = SIZE_LABELS.find(sl => sl.key === k)!;
                                return (
                                  <View key={k} style={styles.sizeGridCell}>
                                    <Text style={styles.sizeGridCellLabel}>{entry.label}</Text>
                                    <View style={[styles.sizeGridCellBox, !v.sizes[k] && styles.sizeGridCellBoxEmpty]}>
                                      <Text style={[styles.sizeGridCellValue, !v.sizes[k] && styles.sizeGridCellValueEmpty]}>{v.sizes[k] || 0}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                            <View style={[styles.sizesGridRow, { marginTop: 6 }]}>
                              {(['xl','xxl','xxxl','xxxxl'] as const).map(k => {
                                const entry = SIZE_LABELS.find(sl => sl.key === k)!;
                                return (
                                  <View key={k} style={styles.sizeGridCell}>
                                    <Text style={styles.sizeGridCellLabel}>{entry.label}</Text>
                                    <View style={[styles.sizeGridCellBox, !v.sizes[k] && styles.sizeGridCellBoxEmpty]}>
                                      <Text style={[styles.sizeGridCellValue, !v.sizes[k] && styles.sizeGridCellValueEmpty]}>{v.sizes[k] || 0}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        )}
                        <Text style={styles.sizesGridTotal}>
                          Total: {getTotalQuantity(v.sizes, isPromotional)} pcs
                        </Text>
                      </View>
                    ))}

                    {/* Product / Service / Fees / Markup */}
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
                        <Text style={styles.costValue}>{formatCurrency(item.serviceFeeEach)}/ea</Text>
                      </View>
                      <View style={styles.costItem}>
                        <Text style={styles.costLabel}>Markup</Text>
                        <Text style={styles.costValue}>{formatCurrency(item.markupEach || 0)}/ea</Text>
                      </View>
                    </View>

                    {/* Subtotal */}
                    <View style={styles.lineItemSubtotalBox}>
                      <Text style={styles.lineItemSubtotalLabel}>Subtotal</Text>
                      <View style={styles.lineItemSubtotalRight}>
                        <Text style={styles.lineItemSubtotalPer}>{calcs.quantity} pcs @ {formatCurrency(calcs.perPiece)}/ea</Text>
                        <Text style={styles.lineItemSubtotalValue}>{formatCurrency(calcs.subtotal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Totals bar */}
        <View style={styles.lineItemTotalsBar}>
          <Text style={styles.lineItemTotalsText}>
            {quote.lineItems.length} Line Item{quote.lineItems.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.lineItemTotalsDot} />
          <Text style={styles.lineItemTotalsText}>
            {totalItems} Total Item{totalItems !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderPricingSummary = () => {
    const q = quote.calculations;
    const perPc = (val: number) => q.totalQuantity > 0 ? val / q.totalQuantity : 0;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.pricingTable}>
            <View style={styles.pricingTableHeader}>
              <Text style={styles.pricingTHLabel}></Text>
              <Text style={styles.pricingTHValue}>EACH</Text>
              <Text style={styles.pricingTHValue}>TOTAL</Text>
            </View>

            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Product Cost</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.productCostTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.productCostTotal)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Service Cost</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.serviceCostTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.serviceCostTotal)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Service Fees</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.serviceFeeTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.serviceFeeTotal)}</Text>
            </View>

            <View style={[styles.pricingRow, styles.pricingRowCOG]}>
              <Text style={styles.pricingRowLabelCOG}>Cost of Goods</Text>
              <Text style={styles.pricingRowValueCOG}>{formatCurrency(perPc(q.cogTotal))}</Text>
              <Text style={styles.pricingRowValueCOG}>{formatCurrency(q.cogTotal)}</Text>
            </View>

            <View style={[styles.pricingRow, styles.pricingRowMarkup]}>
              <Text style={styles.pricingRowLabelMarkup}>Markup ({q.markupPercentage.toFixed(1)}%)</Text>
              <Text style={styles.pricingRowValueMarkup}>{formatCurrency(perPc(q.markupAmount))}</Text>
              <Text style={styles.pricingRowValueMarkup}>{formatCurrency(q.markupAmount)}</Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={[styles.pricingRow, styles.pricingRowBold]}>
              <Text style={styles.pricingRowLabelBold}>Subtotal</Text>
              <Text style={styles.pricingRowValueBold}>{formatCurrency(perPc(q.subtotal))}</Text>
              <Text style={styles.pricingRowValueBold}>{formatCurrency(q.subtotal)}</Text>
            </View>

            {q.onlineFee > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>Online Fee (2.9% + $0.60)</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.onlineFee))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.onlineFee)}</Text>
              </View>
            )}
            {q.cardFee > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>Card Fee (3.75%)</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.cardFee))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.cardFee)}</Text>
              </View>
            )}
            {q.salesTax > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>Sales Tax (8.3%)</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.salesTax))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.salesTax)}</Text>
              </View>
            )}
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <View style={styles.totalDoubleValue}>
              <Text style={styles.totalValueSmall}>{formatCurrency(q.totalPerPiece)}/ea</Text>
              <Text style={styles.totalValue}>{formatCurrency(q.total)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSalesTracking = () => {
    if ((quote.status !== 'active' && quote.status !== 'completed') || !quote.salesData) return null;
    const calc = getSalesCalculations();
    const uniqueVendors = quote.salesData.lineItemCosts
      ? [...new Set(quote.salesData.lineItemCosts.map(c => c.productVendor))]
      : quote.salesData.productVendors || [];
    const uniqueApplicators = quote.salesData.lineItemCosts
      ? [...new Set(quote.salesData.lineItemCosts.map(c => c.applicator))]
      : quote.salesData.applicator ? [quote.salesData.applicator] : [];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sales Tracking</Text>
        <View style={styles.salesTrackingCard}>
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

          {calc && (
            <View style={styles.salesTableContainer}>
              <View style={styles.salesTableHeader}>
                <Text style={styles.salesTableHeaderLabel}></Text>
                <Text style={styles.salesTableHeaderValue}>QUOTED</Text>
                <Text style={styles.salesTableHeaderValue}>ACTUAL</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Product Cost</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.productCostTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualProductCost)}</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Service Cost</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceCostTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualServiceCost)}</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Service Fees</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceFeeTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualServiceFeesCost ?? 0)}</Text>
              </View>
              {quote.salesData.actualOtherCosts > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Other Costs</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(0)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualOtherCosts)}</Text>
                </View>
              )}
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
              {calc.onlineFee > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Online Fee</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.onlineFee)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.onlineFee)}</Text>
                </View>
              )}
              {calc.cardFee > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Card Fee</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.cardFee)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.cardFee)}</Text>
                </View>
              )}
              {calc.salesTax > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Sales Tax</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.salesTax)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.salesTax)}</Text>
                </View>
              )}
            </View>
          )}

          {calc && (
            <View style={styles.amountProfitRow}>
              <View style={styles.amountCollectedBoxSide}>
                <Text style={styles.amountCollectedLabelSide}>Amount Collected</Text>
                <Text style={styles.amountCollectedValueSide}>{formatCurrency(quote.salesData.amountCollected)}</Text>
                <Text style={styles.quotedTotalHintSide}>Quoted: {formatCurrency(quote.calculations.total)}</Text>
              </View>
              <View style={[styles.profitBoxSide, calc.actualProfit < 0 && styles.profitBoxNegative]}>
                <Text style={styles.profitLabelSide}>ACTUAL PROFIT</Text>
                <View style={styles.profitValueRowSide}>
                  {calc.actualProfit >= 0 ? <TrendingUp size={16} color="#fff" /> : <TrendingDown size={16} color="#fff" />}
                  <Text style={styles.profitValueSide}>{formatCurrency(calc.actualProfit)}</Text>
                </View>
                <Text style={styles.profitMarginSide}>{calc.actualProfitMargin.toFixed(1)}% margin</Text>
              </View>
            </View>
          )}

          {quote.salesData.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{quote.salesData.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Are you sure?"
        message={quote ? `Delete "${quote.projectName}"? This cannot be undone.` : ''}
        confirmText="Yes, Delete"
        cancelText="No"
        confirmDestructive
        onConfirm={() => {
          if (quote) { deleteQuote(quote.id); router.replace('/(tabs)/projects'); }
          setConfirmDeleteVisible(false);
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
      <Stack.Screen
        options={{
          title: 'Quote Details',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {isDesktop ? (
          <View style={styles.desktopLayout}>
            <View style={styles.desktopLeft}>
              {renderOrderInfo()}
              {renderLineItems()}
            </View>
            <View style={styles.desktopRight}>
              {renderPricingSummary()}
              {renderSalesTracking()}
            </View>
          </View>
        ) : (
          <View>
            {renderOrderInfo()}
            {renderLineItems()}
            {renderPricingSummary()}
            {renderSalesTracking()}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Prev / Next navigation strip */}
      <View style={styles.quoteNavStrip}>
        <TouchableOpacity
          style={[styles.quoteNavBtn, !prevQuote && styles.quoteNavBtnDisabled]}
          onPress={goToPrev}
          disabled={!prevQuote}
        >
          <ChevronLeft size={15} color={prevQuote ? Colors.light.tint : Colors.light.border} />
          <Text style={[styles.quoteNavBtnText, !prevQuote && styles.quoteNavBtnTextDisabled]}>
            {prevQuote ? (prevQuote.personOrganization || 'Prev') : 'No Previous'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.quoteNavCount}>{currentIndex + 1} / {allProjects.length}</Text>
        <TouchableOpacity
          style={[styles.quoteNavBtn, !nextQuote && styles.quoteNavBtnDisabled]}
          onPress={goToNext}
          disabled={!nextQuote}
        >
          <Text style={[styles.quoteNavBtnText, !nextQuote && styles.quoteNavBtnTextDisabled]}>
            {nextQuote ? (nextQuote.personOrganization || 'Next') : 'No Next'}
          </Text>
          <ChevronRight size={15} color={nextQuote ? Colors.light.tint : Colors.light.border} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
          <MoreVertical size={20} color={Colors.light.tint} />
        </TouchableOpacity>

        {(quote.status === 'active' || quote.status === 'completed') ? (
          <>
            {quote.isLocked ? (
              <View style={[styles.actionBtn, styles.actionBtnSolid, { backgroundColor: '#6b7280', flex: 1 }]}>
                <Lock size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Locked</Text>
              </View>
            ) : (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleTrackSales}>
                <ClipboardList size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>Track Costs</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={() => router.push(`/quote/production/${id}`)}>
              <Flame size={17} color="#fff" />
              <Text style={styles.actionBtnSolidText}>Start Production</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleConvertToSale} disabled={isConverting}>
              <CheckCircle size={17} color={Colors.light.tint} />
              <Text style={styles.actionBtnOutlineText}>{isConverting ? 'Converting...' : 'Mark as Active'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={() => router.push(`/quote/production/${id}`)}>
              <Flame size={17} color="#fff" />
              <Text style={styles.actionBtnSolidText}>Start Production</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {menuVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuContainer}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Options</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <X size={20} color={Colors.light.text} />
                </TouchableOpacity>
              </View>

              {(quote.status === 'active' || quote.status === 'completed') ? (
                <>
                  {!quote.isLocked ? (
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                      <Edit3 size={18} color={Colors.light.text} />
                      <Text style={styles.menuItemText}>Edit Quote</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.menuItem}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                      <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Project is Locked</Text>
                    </View>
                  )}
                  {!quote.isLocked && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleRevertToQuote}>
                      <RotateCcw size={18} color={Colors.light.textSecondary} />
                      <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Revert to Quoted</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportPDF(); }}>
                    <Download size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Export to PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportToSheets(); }}>
                    <Sheet size={18} color={Colors.light.success} />
                    <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  {!quote.isLocked && (
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                      <Trash2 size={18} color={Colors.light.error} />
                      <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleConvertToSale(); }}>
                    <CheckCircle size={18} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Mark as Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                    <Edit3 size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Quote</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportPDF(); }}>
                    <Download size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Export to PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
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
  sectionHeaderRow: {
    marginBottom: 10,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  desktopLeft: {
    flex: 1,
    minWidth: 0,
  },
  desktopRight: {
    width: 380,
  },
  lineItemCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  lineItemHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  lineItemHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  lineItemHeaderName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemHeaderSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  lineItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  lineItemHeaderQty: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  lineItemNumber: {
    backgroundColor: Colors.light.tint,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    flexShrink: 0,
  },
  lineItemBody: {
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  lineItemDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    width: 72,
    flexShrink: 0,
    marginTop: 1,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 20,
  },
  detailValueMuted: {
    color: Colors.light.textSecondary,
  },
  applicatorValue: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  lineItemSubtotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  lineItemSubtotalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  lineItemSubtotalRight: {
    alignItems: 'flex-end',
  },
  lineItemSubtotalPer: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  lineItemSubtotalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
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
  pricingTable: {
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
  pricingTHLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  pricingTHValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  pricingRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  pricingRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pricingRowValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  pricingRowCOG: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
    marginTop: 4,
  },
  pricingRowLabelCOG: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  pricingRowValueCOG: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  pricingRowMarkup: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
  },
  pricingRowLabelMarkup: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  pricingRowValueMarkup: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  pricingRowBold: {},
  pricingRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  pricingRowValueBold: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 7,
  },
  actionBtnSolid: {
    backgroundColor: Colors.light.tint,
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  actionBtnSolidText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  actionBtnOutlineText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  quoteNavStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  quoteNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    maxWidth: '40%',
  },
  quoteNavBtnDisabled: { opacity: 0.35 },
  quoteNavBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    flexShrink: 1,
  },
  quoteNavBtnTextDisabled: { color: Colors.light.border },
  quoteNavCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  lineItemTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  lineItemMockupCol: {
    flex: 1,
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: 220,
  },
  lineItemRightCol: {
    flex: 2,
    minWidth: 0,
  },
  lineItemDetailsCol: {
    minWidth: 0,
    gap: 8,
    marginBottom: 10,
  },
  mockupImage: {
    width: '100%',
    flex: 1,
    minHeight: 160,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
  },
  mockupPlaceholder: {
    flex: 1,
    minHeight: 160,
    width: '100%',
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mockupPlaceholderText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  variantSizeHeading: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  sizesGridSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  sizesGridLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sizesGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeGridCell: {
    flex: 1,
    alignItems: 'center',
  },
  sizeGridCellLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  sizeGridCellBox: {
    width: '100%',
    height: 36,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeGridCellBoxEmpty: {
    borderColor: Colors.light.border,
  },
  sizeGridCellValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sizeGridCellValueEmpty: {
    color: Colors.light.border,
    fontWeight: '400' as const,
  },
  sizesGridTotal: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'right',
  },
  lineItemTotalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  lineItemTotalsText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemTotalsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  menuOverlay: {
    flex: 1,
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
    backgroundColor: '#111111',
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
    color: '#FFFFFF',
  },
  quotedTotalHintSide: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
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
});
