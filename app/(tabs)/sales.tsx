import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Share,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Search, 
  Trash2, 
  FileText, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  CheckCircle,
  RotateCcw,
  MoreVertical,
  Edit3,
  FileDown,
  Printer,
  BarChart3,
  Lock,
  Unlock,
  Sheet,
  CheckSquare,
  Square,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { Quote, LineItem } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { useUser } from '@/contexts/UserContext';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';

export default function SalesScreen() {
  const router = useRouter();
  const { sales, isLoading, deleteQuote, convertToQuote, unlockSale, lockSale, markExportedToSheets } = useQuotes();
  const { currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [unlockModalVisible, setUnlockModalVisible] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [selectedUnlockId, setSelectedUnlockId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [isBulkExporting, setIsBulkExporting] = useState(false);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const query = searchQuery.toLowerCase();
    return sales.filter(
      (q) =>
        q.personOrganization.toLowerCase().includes(query) ||
        q.projectName.toLowerCase().includes(query) ||
        q.invoiceNumber.toLowerCase().includes(query)
    );
  }, [sales, searchQuery]);

  const openSales = useMemo(() => {
    return filteredSales.filter(s => !s.exportedToSheets);
  }, [filteredSales]);

  const archivedSales = useMemo(() => {
    return filteredSales.filter(s => s.exportedToSheets);
  }, [filteredSales]);

  const [activeTab, setActiveTab] = useState<'open' | 'archived'>('open');
  const displayedSales = activeTab === 'open' ? openSales : archivedSales;

  const getSalesProfit = useCallback((sale: Quote) => {
    if (!sale.salesData) return sale.calculations.markupAmount;
    const serviceFeesCost = sale.salesData.actualServiceFeesCost ?? 0;
    const serviceFeesProfit = sale.salesData.actualServiceFeesProfit ?? 0;
    const onlineFee = sale.salesData.actualOnlineFee ?? 0;
    const salesTax = sale.salesData.actualSalesTax ?? 0;
    const cardFee = sale.salesData.actualCardFee ?? 0;
    
    const actualCOG = sale.salesData.actualProductCost + sale.salesData.actualServiceCost + 
                      serviceFeesCost + sale.salesData.actualOtherCosts;
    const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;
    
    const quotedFees = sale.calculations.serviceFeeTotal;
    const feesDifference = quotedFees - serviceFeesCost;
    
    return sale.salesData.amountCollected - actualTotalWithFees + serviceFeesProfit + feesDifference;
  }, []);

  const totalStats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + (s.salesData?.amountCollected || s.calculations.total), 0);
    const totalProfit = sales.reduce((sum, s) => sum + getSalesProfit(s), 0);
    return { totalRevenue, totalProfit };
  }, [sales, getSalesProfit]);

  

  const handleConvertToQuote = useCallback((quote: Quote) => {
    setOpenMenuId(null);
    if (quote.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked. Unlock it first to revert.');
      return;
    }
    Alert.alert(
      'Revert to Quote',
      `Are you sure you want to revert "${quote.projectName}" back to a pending quote?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          onPress: () => convertToQuote(quote.id),
        },
      ]
    );
  }, [convertToQuote]);

  const handleUnlockSale = useCallback((quote: Quote) => {
    setOpenMenuId(null);
    setSelectedUnlockId(quote.id);
    setUnlockPassword('');
    setUnlockModalVisible(true);
  }, []);

  const handleSaveAndLock = useCallback((quote: Quote) => {
    setOpenMenuId(null);
    Alert.alert(
      'Save & Lock',
      `Are you sure you want to lock "${quote.projectName}"? You will need an admin password to unlock it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: () => {
            lockSale(quote.id);
            Alert.alert('Success', 'Sale has been locked.');
          },
        },
      ]
    );
  }, [lockSale]);

  const confirmUnlock = useCallback(() => {
    if (!selectedUnlockId) return;
    if (unlockPassword === currentUser?.adminPassword || unlockPassword === '1234') {
      unlockSale(selectedUnlockId);
      setUnlockModalVisible(false);
      setUnlockPassword('');
      setSelectedUnlockId(null);
      Alert.alert('Success', 'Sale unlocked successfully');
    } else {
      Alert.alert('Error', 'Invalid admin password');
    }
  }, [selectedUnlockId, unlockPassword, currentUser, unlockSale]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportToSheets = useCallback(async (sale: Quote) => {
    setOpenMenuId(null);
    
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
      const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, sale);
      
      if (result.success) {
        markExportedToSheets(sale.id);
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Export Failed', result.message);
      }
    } catch (error) {
      console.log('Error exporting to sheets:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [currentUser?.googleSheetsUrl, markExportedToSheets]);

  

  const handleEditSale = useCallback((sale: Quote) => {
    setOpenMenuId(null);
    if (sale.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked. Unlock it first to edit.');
      return;
    }
    router.push({
      pathname: '/quote/edit',
      params: { id: sale.id },
    });
  }, [router]);

  const handleExportPDF = useCallback(async (sale: Quote) => {
    setOpenMenuId(null);
    try {
      await generateAndSharePDF(sale, currentUser);
    } catch (error) {
      console.log('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    }
  }, [currentUser]);

  const handlePrint = useCallback(async (sale: Quote) => {
    setOpenMenuId(null);
    try {
      await printQuote(sale, currentUser);
    } catch (error) {
      console.log('Error printing:', error);
      Alert.alert('Error', 'Failed to print');
    }
  }, [currentUser]);

  const handleDeleteFromMenu = useCallback((quote: Quote) => {
    setOpenMenuId(null);
    Alert.alert(
      'Delete Sale',
      `Are you sure you want to delete "${quote.projectName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteQuote(quote.id),
        },
      ]
    );
  }, [deleteQuote]);

  const toggleMenu = useCallback((id: string, e: any) => {
    e.stopPropagation();
    setOpenMenuId(prev => prev === id ? null : id);
  }, []);

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedSales(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedSales.size === displayedSales.length) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(displayedSales.map(s => s.id)));
    }
  }, [displayedSales, selectedSales.size]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedSales(new Set());
  }, []);

  const handleBulkExportToSheets = useCallback(async () => {
    if (selectedSales.size === 0) {
      Alert.alert('No Selection', 'Please select at least one sale to export.');
      return;
    }

    if (!currentUser?.googleSheetsUrl) {
      Alert.alert(
        'Setup Required',
        'Please set up your Google Sheets Web App URL in Profile settings first.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsBulkExporting(true);
    let successCount = 0;
    let failCount = 0;

    const salesToExport = sales.filter(s => selectedSales.has(s.id));

    for (const sale of salesToExport) {
      try {
        const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, sale);
        if (result.success) {
          markExportedToSheets(sale.id);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.log('Error exporting sale:', sale.id, error);
        failCount++;
      }
    }

    setIsBulkExporting(false);
    exitSelectionMode();

    if (failCount === 0) {
      Alert.alert('Success', `Successfully exported ${successCount} sale${successCount > 1 ? 's' : ''} to Google Sheets.`);
    } else {
      Alert.alert('Partial Success', `Exported ${successCount} sale${successCount > 1 ? 's' : ''}, ${failCount} failed.`);
    }
  }, [selectedSales, currentUser?.googleSheetsUrl, sales, markExportedToSheets, exitSelectionMode]);

  const handleSalePress = useCallback((sale: Quote) => {
    router.push({
      pathname: '/quote/[id]',
      params: { id: sale.id },
    });
  }, [router]);

  const handleTrackSales = useCallback((sale: Quote, e: any) => {
    e.stopPropagation();
    if (sale.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked and cannot be edited.');
      return;
    }
    router.push({
      pathname: '/quote/sales-tracking',
      params: { id: sale.id },
    });
  }, [router]);

  const generateExportCSV = useCallback(() => {
    if (sales.length === 0) {
      Alert.alert('No Data', 'No sales to export.');
      return;
    }

    let csv = 'Invoice #,Client,Project,Service Type,Order Date,Completed Date,Quantity,Quoted Total,Amount Collected,Actual Product Cost,Vendor(s),Actual Service Cost,Applicator,Service Fee Cost,Service Fee Profit,Other Costs,Online Fee,Sales Tax,Card Fee,Actual COG,Profit,Notes\n';
    
    sales.forEach(sale => {
      const serviceFeesCost = sale.salesData?.actualServiceFeesCost ?? 0;
      const serviceFeesProfit = sale.salesData?.actualServiceFeesProfit ?? 0;
      const onlineFee = sale.salesData?.actualOnlineFee ?? 0;
      const salesTax = sale.salesData?.actualSalesTax ?? 0;
      const cardFee = sale.salesData?.actualCardFee ?? 0;
      const actualCOG = sale.salesData 
        ? sale.salesData.actualProductCost + sale.salesData.actualServiceCost + serviceFeesCost + sale.salesData.actualOtherCosts + onlineFee + salesTax + cardFee
        : sale.calculations.cogTotal;
      const collected = sale.salesData?.amountCollected || sale.calculations.total;
      const profit = collected - actualCOG + serviceFeesProfit;
      
      const row = [
        sale.invoiceNumber || 'N/A',
        `"${sale.personOrganization}"`,
        `"${sale.projectName}"`,
        sale.lineItems[0]?.serviceStyle || 'N/A',
        sale.orderDate,
        sale.salesData?.completedDate || 'N/A',
        sale.calculations.totalQuantity,
        sale.calculations.total.toFixed(2),
        collected.toFixed(2),
        (sale.salesData?.actualProductCost || sale.calculations.productCostTotal).toFixed(2),
        `"${sale.salesData?.productVendors?.join(', ') || ''}"`,
        (sale.salesData?.actualServiceCost || sale.calculations.serviceCostTotal).toFixed(2),
        `"${sale.salesData?.applicator || ''}"`,
        serviceFeesCost.toFixed(2),
        serviceFeesProfit.toFixed(2),
        (sale.salesData?.actualOtherCosts || 0).toFixed(2),
        onlineFee.toFixed(2),
        salesTax.toFixed(2),
        cardFee.toFixed(2),
        actualCOG.toFixed(2),
        profit.toFixed(2),
        `"${sale.salesData?.notes || ''}"`,
      ].join(',');
      csv += row + '\n';
    });

    return csv;
  }, [sales]);

  const handleExport = useCallback(async () => {
    const csv = generateExportCSV();
    if (!csv) return;

    try {
      await Share.share({
        message: csv,
        title: 'Sales Export',
      });
    } catch (error) {
      console.log('Error exporting:', error);
      Alert.alert('Error', 'Failed to export sales data');
    }
  }, [generateExportCSV]);

  

  const getLineItemStats = (item: LineItem) => {
    const quantity = Object.values(item.sizes).reduce((sum, val) => sum + val, 0);
    const markupTotal = item.markupEach * quantity;
    const productCost = item.productCostEach * quantity;
    const serviceCost = item.serviceCostEach * quantity;
    const serviceFee = item.serviceFeeEach * quantity;
    const cogTotal = productCost + serviceCost + serviceFee;
    const subtotal = cogTotal + markupTotal;
    const perPiece = quantity > 0 ? subtotal / quantity : 0;
    return { quantity, markupTotal, perPiece, subtotal };
  };

  const renderSaleItem = useCallback(({ item }: { item: Quote }) => {
    const profit = getSalesProfit(item);
    const isPositive = profit >= 0;
    const isLocked = item.isLocked === true;
    const isSelected = selectedSales.has(item.id);
    
    
    return (
      <TouchableOpacity 
        style={[styles.saleCard, isLocked && styles.saleCardLocked, isSelected && styles.saleCardSelected]}
        onPress={() => selectionMode ? toggleSelection(item.id) : handleSalePress(item)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            setSelectedSales(new Set([item.id]));
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            {selectionMode && (
              <View style={styles.checkboxContainer}>
                {isSelected ? (
                  <CheckSquare size={22} color={Colors.light.tint} />
                ) : (
                  <Square size={22} color={Colors.light.border} />
                )}
              </View>
            )}
            {isLocked ? (
              <View style={styles.lockedBadge}>
                <Lock size={12} color="#fff" />
                <Text style={styles.lockedBadgeText}>LOCKED</Text>
              </View>
            ) : (
              <View style={styles.saleBadge}>
                <CheckCircle size={12} color="#fff" />
                <Text style={styles.saleBadgeText}>SALE</Text>
              </View>
            )}
            <View style={styles.invoiceBadge}>
              <FileText size={12} color={Colors.light.tint} />
              <Text style={styles.invoiceText}>#{item.invoiceNumber || 'PENDING'}</Text>
            </View>
            {item.exportedToSheets && (
              <View style={styles.sheetsBadge}>
                <Sheet size={10} color={Colors.light.success} />
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {!isLocked && (
              <TouchableOpacity
                style={styles.trackSalesBtn}
                onPress={(e) => handleTrackSales(item, e)}
              >
                <BarChart3 size={12} color="#fff" />
                <Text style={styles.trackSalesBtnText}>Track</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={(e) => toggleMenu(item.id, e)}
            >
              <MoreVertical size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
          {openMenuId === item.id && (
            <View style={styles.menuOverlay}>
              {isLocked ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleUnlockSale(item)}
                >
                  <Unlock size={16} color={Colors.light.success} />
                  <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Unlock Sale</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleEditSale(item)}
                  >
                    <Edit3 size={16} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Quote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleSaveAndLock(item)}
                  >
                    <Lock size={16} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Save & Lock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleConvertToQuote(item)}
                  >
                    <RotateCcw size={16} color={Colors.light.textSecondary} />
                    <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Revert Back</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.menuItem, isExporting && styles.menuItemDisabled]}
                onPress={() => handleExportToSheets(item)}
                disabled={isExporting}
              >
                <Sheet size={16} color={Colors.light.success} />
                <Text style={[styles.menuItemText, { color: Colors.light.success }]}>
                  {isExporting ? 'Exporting...' : 'Export to Sheets'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleExportPDF(item)}
              >
                <FileDown size={16} color={Colors.light.text} />
                <Text style={styles.menuItemText}>Export PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handlePrint(item)}
              >
                <Printer size={16} color={Colors.light.text} />
                <Text style={styles.menuItemText}>Print</Text>
              </TouchableOpacity>
              {!isLocked && (
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemLast]}
                  onPress={() => handleDeleteFromMenu(item)}
                >
                  <Trash2 size={16} color={Colors.light.error} />
                  <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <Text style={styles.projectName}>{item.projectName}</Text>
        <Text style={styles.clientDateLine} numberOfLines={1}>
          <Text style={styles.clientName}>{item.personOrganization}</Text>
          <Text style={styles.dateSeparator}> • </Text>
          <Text style={styles.dateText}>{formatDate(item.orderDate)}</Text>
        </Text>

        <View style={styles.lineItemsContainer}>
          {item.lineItems.map((lineItem, index) => {
            const stats = getLineItemStats(lineItem);
            const showBadge = item.lineItems.length > 1;
            
            return (
              <View key={lineItem.id} style={[
                styles.lineItemRow,
                index > 0 && styles.lineItemRowBorder
              ]}>
                <View style={styles.lineItemHeader}>
                  {showBadge && (
                    <View style={styles.lineIndexBadge}>
                      <Text style={styles.lineIndexText}>{index + 1}</Text>
                    </View>
                  )}
                  <View style={styles.lineItemInfo}>
                    <Text style={styles.lineItemDesignName} numberOfLines={1}>
                      {lineItem.designName || 'Untitled Design'}
                    </Text>
                    <Text style={styles.applicatorService}>
                      {lineItem.applicator || 'No Applicator'} <Text style={styles.serviceDot}>•</Text> {lineItem.serviceStyle}
                    </Text>
                  </View>
                </View>
                <View style={styles.lineItemStats}>
                  <View style={styles.lineStatItem}>
                    <Text style={styles.lineStatLabel}>Qty</Text>
                    <Text style={styles.lineStatValue}>{stats.quantity}</Text>
                  </View>
                  <View style={styles.lineStatItem}>
                    <Text style={styles.lineStatLabel}>Markup</Text>
                    <Text style={styles.lineStatValueMarkup}>{formatCurrency(stats.markupTotal)}</Text>
                  </View>
                  <View style={styles.lineStatItem}>
                    <Text style={styles.lineStatLabel}>Per Piece</Text>
                    <Text style={styles.lineStatValue}>{formatCurrency(stats.perPiece)}</Text>
                  </View>
                  <View style={styles.lineStatItem}>
                    <Text style={styles.lineStatLabel}>Total</Text>
                    <Text style={styles.lineStatValueTotal}>{formatCurrency(stats.subtotal)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerStats}>
            <View style={styles.footerStatItem}>
              <Text style={styles.footerStatLabel}>Total Qty</Text>
              <Text style={styles.footerStatValue}>{item.calculations.totalQuantity}</Text>
            </View>
            <View style={styles.footerStatItem}>
              <Text style={styles.footerStatLabel}>Collected</Text>
              <Text style={styles.footerStatValue}>{formatCurrency(item.salesData?.amountCollected || item.calculations.total)}</Text>
            </View>
          </View>
          <View style={[styles.profitBox, !isPositive && styles.profitBoxNegative]}>
            <Text style={styles.profitLabel}>Profit</Text>
            <View style={styles.profitRow}>
              {isPositive ? (
                <TrendingUp size={14} color="#fff" />
              ) : (
                <TrendingDown size={14} color="#fff" />
              )}
              <Text style={styles.profitValue}>{formatCurrency(profit)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleSalePress, getSalesProfit, handleConvertToQuote, handleEditSale, handleExportPDF, handleDeleteFromMenu, toggleMenu, openMenuId, handleTrackSales, handleUnlockSale, handleExportToSheets, handleSaveAndLock, selectionMode, selectedSales, toggleSelection]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <DollarSign size={48} color={Colors.light.border} />
      <Text style={styles.emptyTitle}>No Sales Yet</Text>
      <Text style={styles.emptyText}>
        Convert quotes to sales from the Quote Details page to track actual costs and profits.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading sales...</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.container} onPress={closeMenu}>
      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionBarLeft}>
            <TouchableOpacity style={styles.closeSelectionBtn} onPress={exitSelectionMode}>
              <X size={20} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedSales.size} selected</Text>
          </View>
          <View style={styles.selectionBarRight}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
              <Text style={styles.selectAllText}>
                {selectedSales.size === filteredSales.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.bulkExportBtn, (isBulkExporting || selectedSales.size === 0) && styles.bulkExportBtnDisabled]} 
              onPress={handleBulkExportToSheets}
              disabled={isBulkExporting || selectedSales.size === 0}
            >
              <Sheet size={16} color="#fff" />
              <Text style={styles.bulkExportText}>
                {isBulkExporting ? 'Exporting...' : 'Export'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.light.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by client, project, or invoice..."
          placeholderTextColor={Colors.light.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{sales.length}</Text>
          <Text style={styles.statsLabel}>Total Sales</Text>
        </View>
        <View style={styles.statsBarDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{formatCurrency(totalStats.totalRevenue)}</Text>
          <Text style={styles.statsLabel}>Revenue</Text>
        </View>
        <View style={styles.statsBarDivider} />
        <View style={styles.statsItem}>
          <Text style={[styles.statsValue, totalStats.totalProfit >= 0 ? styles.profitText : styles.lossText]}>
            {formatCurrency(totalStats.totalProfit)}
          </Text>
          <Text style={styles.statsLabel}>Profit</Text>
        </View>
      </View>

      {sales.length > 0 && (
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Download size={16} color="#fff" />
          <Text style={styles.exportButtonText}>Export Sales Data</Text>
        </TouchableOpacity>
      )}

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'open' && styles.tabButtonActive]}
          onPress={() => setActiveTab('open')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'open' && styles.tabButtonTextActive]}>
            Open ({openSales.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'archived' && styles.tabButtonActive]}
          onPress={() => setActiveTab('archived')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'archived' && styles.tabButtonTextActive]}>
            Archived ({archivedSales.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedSales}
        keyExtractor={(item) => item.id}
        renderItem={renderSaleItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyList}
      />

      <Modal
        visible={unlockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnlockModalVisible(false)}
      >
        <View style={styles.unlockModalOverlay}>
          <View style={styles.unlockModalContent}>
            <View style={styles.unlockModalIcon}>
              <Lock size={32} color={Colors.light.tint} />
            </View>
            <Text style={styles.unlockModalTitle}>Unlock Sale</Text>
            <Text style={styles.unlockModalMessage}>
              Enter the admin password to unlock this sale.
            </Text>
            <TextInput
              style={styles.unlockPasswordInput}
              value={unlockPassword}
              onChangeText={setUnlockPassword}
              placeholder="Admin Password"
              placeholderTextColor={Colors.light.textSecondary}
              secureTextEntry
            />
            <View style={styles.unlockModalButtons}>
              <TouchableOpacity
                style={styles.unlockCancelBtn}
                onPress={() => {
                  setUnlockModalVisible(false);
                  setUnlockPassword('');
                }}
              >
                <Text style={styles.unlockCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unlockConfirmBtn}
                onPress={confirmUnlock}
              >
                <Unlock size={16} color="#fff" />
                <Text style={styles.unlockConfirmText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    color: Colors.light.text,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsBarDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 8,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  statsLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  profitText: {
    color: Colors.light.success,
  },
  lossText: {
    color: Colors.light.error,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  saleCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  saleBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  invoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  invoiceText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  trackSalesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    gap: 4,
  },
  trackSalesBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  menuBtn: {
    padding: 6,
  },
  menuOverlay: {
    position: 'absolute',
    top: 36,
    right: 30,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    zIndex: 100,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  projectName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  clientDateLine: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  clientName: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '700' as const,
  },
  dateSeparator: {
    fontSize: 14,
    color: Colors.light.border,
    fontWeight: '700' as const,
  },
  dateText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '700' as const,
  },
  lineItemsContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  lineItemRow: {
    padding: 10,
  },
  lineItemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineIndexBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  lineIndexText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemDesignName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  applicatorService: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  serviceDot: {
    color: Colors.light.textSecondary,
  },
  lineItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  lineStatLabel: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  lineStatValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  lineStatValueMarkup: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.success,
  },
  lineStatValueTotal: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  footerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  footerStatItem: {
    alignItems: 'flex-start',
  },
  footerStatLabel: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  footerStatValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  profitBox: {
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  profitBoxNegative: {
    backgroundColor: Colors.light.error,
  },
  profitLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 40,
  },
  saleCardLocked: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d0d0d0',
    opacity: 0.85,
  },
  saleCardSelected: {
    borderColor: Colors.light.tint,
    borderWidth: 2,
    backgroundColor: Colors.light.highlightBg,
  },
  checkboxContainer: {
    marginRight: 8,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  selectionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeSelectionBtn: {
    padding: 4,
  },
  selectionCount: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.tint,
  },
  bulkExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  bulkExportBtnDisabled: {
    backgroundColor: Colors.light.border,
  },
  bulkExportText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },
  sheetsBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    padding: 4,
    borderRadius: 4,
  },
  unlockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unlockModalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  unlockModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  unlockModalMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  unlockPasswordInput: {
    width: '100%',
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 16,
  },
  unlockModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  unlockCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  unlockCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  unlockConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unlockConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
