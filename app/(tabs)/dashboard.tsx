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
  FilePlus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useClients } from '@/contexts/ClientsContext';
import { formatCurrency } from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export default function DashboardScreen() {
  const router = useRouter();
  const { quotes } = useQuotes();
  const { clients } = useClients();
  const { isMobile } = useBreakpoint();

  const stats = useMemo(() => {
    const salesList = quotes.filter((q) => q.status === 'sale');
    const activeQuotes = quotes.filter((q) => q.status === 'submitted');
    const totalRevenue = salesList.reduce(
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
    const salesThisMonth = salesList.filter(
      (q) => new Date(q.salesData?.convertedDate || q.createdAt) >= thisMonth
    );
    const revenueThisMonth = salesThisMonth.reduce(
      (sum, q) => sum + (q.salesData?.amountCollected ?? q.calculations?.total ?? 0),
      0
    );
    return {
      totalRevenue,
      totalQuoted,
      salesCount: salesList.length,
      activeQuotesCount: activeQuotes.length,
      totalQuotesCount: quotes.length,
      revenueThisMonth,
      salesThisMonth: salesThisMonth.length,
      activeClients: clients.filter((c) => c.status === 'Active').length,
      prospects: clients.filter((c) => c.status === 'Prospect').length,
    };
  }, [quotes, clients]);

  const recentQuotes = useMemo(
    () =>
      [...quotes]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
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
      contentContainerStyle={[
        styles.content,
        isMobile && styles.contentMobile,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>
            Dashboard
          </Text>
          <Text style={styles.pageSubtitle}>Welcome back</Text>
        </View>
        <TouchableOpacity
          style={styles.newQuoteBtn}
          onPress={() => router.push('/')}
        >
          <FilePlus size={16} color="#fff" />
          {!isMobile && <Text style={styles.newQuoteBtnText}>New Quote</Text>}
        </TouchableOpacity>
      </View>

      {/* Stat cards — 2 per row on mobile, 4 on larger screens */}
      <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
        {statCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <View
              key={card.label}
              style={[styles.statCard, isMobile && styles.statCardMobile]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}>
                <IconComponent size={20} color={card.color} />
              </View>
              <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>
                {card.value}
              </Text>
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
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        quote.status === 'sale'
                          ? '#059669'
                          : quote.status === 'submitted'
                          ? Colors.light.tint
                          : Colors.light.border,
                    },
                  ]}
                />
                <View style={styles.quoteRowText}>
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
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        quote.status === 'sale'
                          ? '#ECFDF5'
                          : quote.status === 'submitted'
                          ? Colors.light.highlightBg
                          : '#F3F4F6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          quote.status === 'sale'
                            ? '#059669'
                            : quote.status === 'submitted'
                            ? Colors.light.tint
                            : Colors.light.textSecondary,
                      },
                    ]}
                  >
                    {quote.status === 'sale'
                      ? 'Sale'
                      : quote.status === 'submitted'
                      ? 'Quote'
                      : 'Draft'}
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
  contentMobile: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  pageTitleMobile: {
    fontSize: 22,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
    gap: 12,
    marginBottom: 28,
  },
  statsGridMobile: {
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statCardMobile: {
    minWidth: '45%' as any,
    padding: 14,
    borderRadius: 12,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  statValueMobile: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 3,
  },
  statSub: {
    fontSize: 11,
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
    fontSize: 17,
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
  quoteRowText: {
    flex: 1,
    minWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
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
    flexShrink: 0,
    marginLeft: 8,
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
