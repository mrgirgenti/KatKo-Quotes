import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, FileText, MoreVertical, Edit3, Download, Printer, CheckCircle, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useUser } from '@/contexts/UserContext';
import { Quote, LineItem } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';

export default function HistoryScreen() {
  const router = useRouter();
  const { quotes, isLoading, convertToSale, deleteQuote } = useQuotes();
  const { currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const filteredQuotes = useMemo(() => {
    if (!searchQuery.trim()) return quotes;
    const query = searchQuery.toLowerCase();
    return quotes.filter(
      (q) =>
        q.personOrganization.toLowerCase().includes(query) ||
        q.projectName.toLowerCase().includes(query) ||
        q.invoiceNumber.toLowerCase().includes(query)
    );
  }, [quotes, searchQuery]);

  const handleOpenMenu = useCallback((quote: Quote, e: any) => {
    e.stopPropagation();
    setSelectedQuote(quote);
    setMenuVisible(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
    setSelectedQuote(null);
  }, []);

  const handleEditQuote = useCallback(() => {
    if (selectedQuote) {
      handleCloseMenu();
      router.push({
        pathname: '/quote/edit',
        params: { id: selectedQuote.id },
      });
    }
  }, [selectedQuote, router, handleCloseMenu]);

  const handleExportPDF = useCallback(async () => {
    if (selectedQuote) {
      handleCloseMenu();
      try {
        await generateAndSharePDF(selectedQuote, currentUser);
      } catch (error) {
        console.error('Error exporting PDF:', error);
        Alert.alert('Error', 'Failed to export PDF. Please try again.');
      }
    }
  }, [selectedQuote, currentUser, handleCloseMenu]);

  const handlePrint = useCallback(async () => {
    if (selectedQuote) {
      handleCloseMenu();
      try {
        await printQuote(selectedQuote, currentUser);
      } catch (error) {
        console.error('Error printing:', error);
        Alert.alert('Error', 'Failed to print. Please try again.');
      }
    }
  }, [selectedQuote, currentUser, handleCloseMenu]);

  const handleConvertToSale = useCallback((quote: Quote) => {
    Alert.alert(
      'Convert to Sale',
      `Are you sure you want to convert "${quote.projectName}" to a sale?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: () => {
            convertToSale(quote.id);
            router.replace('/(tabs)/projects');
          },
        },
      ]
    );
  }, [convertToSale, router]);

  const handleConvertFromMenu = useCallback(() => {
    if (selectedQuote) {
      handleCloseMenu();
      handleConvertToSale(selectedQuote);
    }
  }, [selectedQuote, handleCloseMenu, handleConvertToSale]);

  const handleDelete = useCallback(() => {
    if (selectedQuote) {
      handleCloseMenu();
      Alert.alert(
        'Delete Quote',
        `Are you sure you want to delete "${selectedQuote.projectName}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteQuote(selectedQuote.id),
          },
        ]
      );
    }
  }, [selectedQuote, handleCloseMenu, deleteQuote]);

  const handleQuotePress = useCallback((quote: Quote) => {
    router.push({
      pathname: '/quote/[id]',
      params: { id: quote.id },
    });
  }, [router]);

  

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

  const renderQuoteItem = useCallback(({ item }: { item: Quote }) => (
    <TouchableOpacity 
      style={styles.quoteCard}
      onPress={() => handleQuotePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.invoiceBadge}>
            <FileText size={12} color={Colors.light.tint} />
            <Text style={styles.invoiceText}>#{item.invoiceNumber || 'PENDING'}</Text>
          </View>
          <View style={styles.orderTypeBadge}>
            <Text style={styles.orderTypeBadgeText}>{item.orderType}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.convertBtnSmall}
            onPress={(e) => {
              e.stopPropagation();
              handleConvertToSale(item);
            }}
          >
            <CheckCircle size={14} color="#fff" />
            <Text style={styles.convertBtnSmallText}>Convert</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={(e) => handleOpenMenu(item, e)}
          >
            <MoreVertical size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
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
            <Text style={styles.footerStatLabel}>Total Markup</Text>
            <Text style={styles.footerStatValueMarkup}>{formatCurrency(item.calculations.markupAmount)}</Text>
          </View>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(item.calculations.total)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [handleOpenMenu, handleQuotePress]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <FileText size={48} color={Colors.light.border} />
      <Text style={styles.emptyTitle}>No Quotes Yet</Text>
      <Text style={styles.emptyText}>
        Submitted quotes will appear here for your records.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading quotes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          <Text style={styles.statsValue}>{quotes.length}</Text>
          <Text style={styles.statsLabel}>Total Quotes</Text>
        </View>
        <View style={styles.statsBarDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>
            {formatCurrency(
              quotes.reduce((sum, q) => sum + q.calculations.total, 0)
            )}
          </Text>
          <Text style={styles.statsLabel}>Total Value</Text>
        </View>
      </View>

      <FlatList
        data={filteredQuotes}
        keyExtractor={(item) => item.id}
        renderItem={renderQuoteItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyList}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseMenu}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditQuote}>
              <Edit3 size={20} color={Colors.light.text} />
              <Text style={styles.menuItemText}>Edit Quote</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleConvertFromMenu}>
              <CheckCircle size={20} color={Colors.light.success} />
              <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Convert to Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleExportPDF}>
              <Download size={20} color={Colors.light.text} />
              <Text style={styles.menuItemText}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handlePrint}>
              <Printer size={20} color={Colors.light.text} />
              <Text style={styles.menuItemText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Trash2 size={20} color={Colors.light.error} />
              <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemCancel]} onPress={handleCloseMenu}>
              <Text style={styles.menuItemCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
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
    marginHorizontal: 12,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  statsLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  quoteCard: {
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
  convertBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    gap: 4,
  },
  convertBtnSmallText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  menuBtn: {
    padding: 6,
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
  orderTypeBadge: {
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  orderTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    textTransform: 'uppercase',
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
  footerStatValueMarkup: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.success,
  },
  totalBox: {
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  totalLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  totalValue: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    width: '80%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  menuItemCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    backgroundColor: Colors.light.background,
  },
  menuItemCancelText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
});
