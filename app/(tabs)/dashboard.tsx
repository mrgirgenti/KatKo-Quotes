import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  DollarSign,
  FileText,
  TrendingUp,
  Clock,
  ChevronRight,
  FilePlus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useClients } from '@/contexts/ClientsContext';
import { formatCurrency } from '@/utils/quoteCalculations';

export default function DashboardScreen() {
  const router = useRouter();
  const { quotes } = useQuotes();
  const { clients } = useClients();

  const stats = useMemo(() => {
    const sales = quotes.filter((q) => q.status === 'sale');
    const activeQuotes = quotes.filter((q) => q.status === 'submitted');
    const totalRevenue = sales.reduce(
      (sum, q) => sum + (q.salesData?.amountCollected ?? q.calculations?.total ?? 0),
      0
    );
    const totalQuoted = quotes.reduce(
      (sum, q) => sum + (q.calculations?.total ?? 0),
      0
    );
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const salesThisMonth = sales.filter(
      (q) => new Date(q.salesData?.convertedDate || q.createdAt) >= thisMonth
    );
    const revenueThisMonth = salesThisMonth.reduce(
      (sum, q) => sum + (q.salesData?.amountCollected ?? q.calculations?.total ?? 0),
      0
    );
    return {
      totalRevenue,
      totalQuoted,
      salesCount: sales.length,
      activeQuotesCount: activeQuotes.length,
      totalQuotesCount: quotes.length,
      revenueThisMonth,
      salesThisMonth: salesThisMonth.length,
      activeClients: clients.filter((c) => c.status === 'Active').length,
      prospects: clients.filter((c) => c.status === 'Prospect').length,
    };
  }, [quotes, clients]);

  const recentQuotes = useMemo(
    () => [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [quotes]
  );

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      sub: `${stats.salesCount} completed sales`,
      icon: DollarSign,
      color: '#059669',
      bg: '#ECFDF5',
    },
    {
      label: 'This Month',
      value: formatCurrency(stats.revenueThisMonth),
      sub: `${stats.salesThisMonth} sales`,
      icon: TrendingUp,
      color: Colors.light.tint,
      bg: Colors.light.highlightBg,
    },
    {
      label: 'Active Quotes',
      value: String(stats.activeQuotesCount),
      sub: `${stats.totalQuotesCount} total quotes`,
      icon: FileText,
      color: '#2563EB',
      bg: '#EFF6FF',
    },
    {
      label: 'Active Clients',
      value: String(stats.activeClients),
      sub: `${stats.prospects} prospects`,
      icon: Clock,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <TouchableOpacity
          style={styles.newQuoteBtn}
          onPress={() => router.push('/')}
        >
          <FilePlus size={16} color="#fff" />
          <Text style={styles.newQuoteBtnText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      {/* Stat cards */}
      <View style={styles.statsGrid}>
        {statCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <View key={card.label} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
                <IconComponent size={22} color={card.color} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
              <Text style={styles.statSub}>{card.sub}</Text>
            </View>
          );
        })}
      </View>

      {/* Recent activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Quotes</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {recentQuotes.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={32} color={Colors.light.border} />
            <Text style={styles.emptyText}>No quotes yet</Text>
            <TouchableOpacity
              style={styles.createFirstBtn}
              onPress={() => router.push('/')}
            >
              <Text style={styles.createFirstBtnText}>Create your first quote</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentQuotes.map((quote) => (
            <TouchableOpacity
              key={quote.id}
              style={styles.quoteRow}
              onPress={() => router.push(`/quote/${quote.id}` as any)}
            >
              <View style={styles.quoteRowLeft}>
                <View style={[styles.statusDot, { backgroundColor: quote.status === 'sale' ? '#059669' : quote.status === 'submitted' ? Colors.light.tint : Colors.light.border }]} />
                <View>
                  <Text style={styles.quoteName} numberOfLines={1}>
                    {quote.personOrganization}
                  </Text>
                  <Text style={styles.quoteProject} numberOfLines={1}>
                    {quote.projectName}
                    {quote.invoiceNumber ? ` · #${quote.invoiceNumber}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.quoteRowRight}>
                <Text style={styles.quoteTotal}>
                  {formatCurrency(quote.calculations?.total ?? 0)}
                </Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: quote.status === 'sale' ? '#ECFDF5' : quote.status === 'submitted' ? Colors.light.highlightBg : '#F3F4F6',
                }]}>
                  <Text style={[styles.statusBadgeText, {
                    color: quote.status === 'sale' ? '#059669' : quote.status === 'submitted' ? Colors.light.tint : Colors.light.textSecondary,
                  }]}>
                    {quote.status === 'sale' ? 'Sale' : quote.status === 'submitted' ? 'Quote' : 'Draft'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  newQuoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  newQuoteBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  statSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  createFirstBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createFirstBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quoteRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quoteName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  quoteProject: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  quoteRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quoteTotal: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
});
