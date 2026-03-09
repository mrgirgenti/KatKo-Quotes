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
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Download,
  Filter,
  Calendar,
  DollarSign,
  User,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { 
  filterQuotes, 
  generateQuotesCSV, 
  generateSalesCSV, 
  generateLineItemsCSV, 
  exportCSV,
  ReportFilters 
} from '@/utils/csvExport';
import { Toast } from '@/components/Toast';

type ReportType = 'quotes' | 'sales' | 'lineItems';

export default function ReportsScreen() {
  const { quotes } = useQuotes();
  const [showFilters, setShowFilters] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientName, setClientName] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'quote' | 'sale'>('all');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const filters: ReportFilters = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    clientName: clientName || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    status: statusFilter,
  }), [dateFrom, dateTo, clientName, minPrice, maxPrice, statusFilter]);

  const filteredData = useMemo(() => {
    return filterQuotes(quotes, filters);
  }, [quotes, filters]);

  const stats = useMemo(() => {
    const sales = filteredData.filter(q => q.status === 'sale');
    const totalQuotedValue = filteredData.reduce((sum, q) => sum + q.calculations.total, 0);
    const totalCollected = sales.reduce((sum, q) => sum + (q.salesData?.amountCollected || 0), 0);
    const totalProfit = sales.reduce((sum, q) => {
      if (!q.salesData) return sum;
      const sd = q.salesData;
      const actualCOG = sd.actualProductCost + sd.actualServiceCost + 
                        (sd.actualServiceFeesCost || 0) + sd.actualOtherCosts + 
                        (sd.actualOnlineFee || 0) + (sd.actualSalesTax || 0) + 
                        (sd.actualCardFee || 0);
      return sum + (sd.amountCollected - actualCOG + (sd.actualServiceFeesProfit || 0));
    }, 0);
    const totalQuantity = filteredData.reduce((sum, q) => sum + q.calculations.totalQuantity, 0);

    return {
      totalRecords: filteredData.length,
      quotesCount: filteredData.filter(q => q.status !== 'sale').length,
      salesCount: sales.length,
      totalQuotedValue,
      totalCollected,
      totalProfit,
      totalQuantity,
    };
  }, [filteredData]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleExport = useCallback(async (type: ReportType) => {
    let csv: string;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0];

    switch (type) {
      case 'quotes':
        csv = generateQuotesCSV(filteredData);
        filename = `quotes_report_${timestamp}.csv`;
        break;
      case 'sales':
        csv = generateSalesCSV(filteredData);
        filename = `sales_report_${timestamp}.csv`;
        break;
      case 'lineItems':
        csv = generateLineItemsCSV(filteredData);
        filename = `line_items_report_${timestamp}.csv`;
        break;
    }

    const success = await exportCSV(csv, filename);
    if (success) {
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully!`);
    } else {
      showToast('Failed to export. Please try again.', 'error');
    }
  }, [filteredData]);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setClientName('');
    setMinPrice('');
    setMaxPrice('');
    setStatusFilter('all');
  };

  const handleDateInput = (text: string, setter: (val: string) => void) => {
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
    setter(cleaned);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Reports',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <View style={styles.filterToggleLeft}>
            <Filter size={18} color={Colors.light.tint} />
            <Text style={styles.filterToggleText}>Filters</Text>
          </View>
          {showFilters ? (
            <ChevronUp size={20} color={Colors.light.textSecondary} />
          ) : (
            <ChevronDown size={20} color={Colors.light.textSecondary} />
          )}
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filtersCard}>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <View style={styles.filterLabel}>
                  <Calendar size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.filterLabelText}>From Date</Text>
                </View>
                <TextInput
                  style={styles.filterInput}
                  value={dateFrom}
                  onChangeText={(t) => handleDateInput(t, setDateFrom)}
                  placeholder="MM-DD-YYYY"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              <View style={styles.filterField}>
                <View style={styles.filterLabel}>
                  <Calendar size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.filterLabelText}>To Date</Text>
                </View>
                <TextInput
                  style={styles.filterInput}
                  value={dateTo}
                  onChangeText={(t) => handleDateInput(t, setDateTo)}
                  placeholder="MM-DD-YYYY"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.filterGroup}>
              <View style={styles.filterLabel}>
                <User size={14} color={Colors.light.textSecondary} />
                <Text style={styles.filterLabelText}>Client Name</Text>
              </View>
              <TextInput
                style={styles.filterInput}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Search by client or project name"
                placeholderTextColor={Colors.light.textSecondary}
              />
            </View>

            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <View style={styles.filterLabel}>
                  <DollarSign size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.filterLabelText}>Min Price</Text>
                </View>
                <TextInput
                  style={styles.filterInput}
                  value={minPrice}
                  onChangeText={setMinPrice}
                  placeholder="0.00"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.filterField}>
                <View style={styles.filterLabel}>
                  <DollarSign size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.filterLabelText}>Max Price</Text>
                </View>
                <TextInput
                  style={styles.filterInput}
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="0.00"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabelText}>Status</Text>
              <View style={styles.statusButtons}>
                {(['all', 'quote', 'sale'] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusBtn,
                      statusFilter === status && styles.statusBtnActive,
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        statusFilter === status && styles.statusBtnTextActive,
                      ]}
                    >
                      {status === 'all' ? 'All' : status === 'quote' ? 'Quotes' : 'Sales'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <X size={16} color={Colors.light.textSecondary} />
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalRecords}</Text>
              <Text style={styles.statLabel}>Total Records</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.quotesCount}</Text>
              <Text style={styles.statLabel}>Quotes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.salesCount}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalQuantity}</Text>
              <Text style={styles.statLabel}>Total Pieces</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Quoted Value</Text>
              <Text style={styles.summaryValue}>{formatCurrency(stats.totalQuotedValue)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Collected (Sales)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(stats.totalCollected)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Total Profit (Sales)</Text>
              <Text style={[styles.summaryValueBold, stats.totalProfit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                {formatCurrency(stats.totalProfit)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          
          <TouchableOpacity
            style={styles.exportCard}
            onPress={() => handleExport('quotes')}
          >
            <View style={styles.exportCardLeft}>
              <View style={styles.exportIcon}>
                <FileText size={20} color={Colors.light.tint} />
              </View>
              <View>
                <Text style={styles.exportTitle}>Quotes Report</Text>
                <Text style={styles.exportDesc}>All quote summaries with pricing</Text>
              </View>
            </View>
            <Download size={20} color={Colors.light.tint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportCard}
            onPress={() => handleExport('sales')}
          >
            <View style={styles.exportCardLeft}>
              <View style={[styles.exportIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <TrendingUp size={20} color={Colors.light.success} />
              </View>
              <View>
                <Text style={styles.exportTitle}>Sales Report</Text>
                <Text style={styles.exportDesc}>Actual costs, profits & tracking data</Text>
              </View>
            </View>
            <Download size={20} color={Colors.light.tint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportCard}
            onPress={() => handleExport('lineItems')}
          >
            <View style={styles.exportCardLeft}>
              <View style={[styles.exportIcon, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                <FileText size={20} color="#A855F7" />
              </View>
              <View>
                <Text style={styles.exportTitle}>Line Items Report</Text>
                <Text style={styles.exportDesc}>Detailed breakdown of all line items</Text>
              </View>
            </View>
            <Download size={20} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview ({filteredData.length} records)</Text>
          {filteredData.slice(0, 10).map((quote) => (
            <View key={quote.id} style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewClient}>{quote.personOrganization}</Text>
                <View style={[
                  styles.previewBadge,
                  quote.status === 'sale' && styles.previewBadgeSale
                ]}>
                  <Text style={[
                    styles.previewBadgeText,
                    quote.status === 'sale' && styles.previewBadgeTextSale
                  ]}>
                    {quote.status === 'sale' ? 'Sale' : 'Quote'}
                  </Text>
                </View>
              </View>
              <Text style={styles.previewProject}>{quote.projectName}</Text>
              <View style={styles.previewFooter}>
                <Text style={styles.previewDate}>{formatDate(quote.orderDate)}</Text>
                <Text style={styles.previewTotal}>{formatCurrency(quote.calculations.total)}</Text>
              </View>
            </View>
          ))}
          {filteredData.length > 10 && (
            <Text style={styles.moreRecords}>
              +{filteredData.length - 10} more records...
            </Text>
          )}
          {filteredData.length === 0 && (
            <View style={styles.noData}>
              <FileText size={32} color={Colors.light.border} />
              <Text style={styles.noDataText}>No records match your filters</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterToggleText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  filtersCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterField: {
    flex: 1,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  filterLabelText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  filterInput: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    fontSize: 14,
    color: Colors.light.text,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  statusBtnTextActive: {
    color: '#fff',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
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
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  profitPositive: {
    color: Colors.light.success,
  },
  profitNegative: {
    color: Colors.light.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 10,
  },
  exportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  exportDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  previewCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewClient: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    flex: 1,
  },
  previewBadge: {
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewBadgeSale: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  previewBadgeTextSale: {
    color: Colors.light.success,
  },
  previewProject: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  previewTotal: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  moreRecords: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.light.textSecondary,
    paddingVertical: 12,
  },
  noData: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noDataText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
  bottomPadding: {
    height: 60,
  },
});
