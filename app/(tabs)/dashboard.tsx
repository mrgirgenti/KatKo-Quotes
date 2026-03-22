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
  Layers,
  Shirt,
  Scissors,
  Gift,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useClients } from '@/contexts/ClientsContext';
import { formatCurrency } from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ServiceStyle, STATUS_CONFIG, getEffectiveStatus } from '@/types/quote';

export default function DashboardScreen() {
  const router = useRouter();
  const { quotes } = useQuotes();
  const { clients } = useClients();
  const { isMobile } = useBreakpoint();

  const stats = useMemo(() => {
    const salesList = quotes.filter((q) => q.status === 'active' || q.status === 'completed');
    const activeQuotes = quotes.filter((q) => q.status === 'quoted');
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

  const serviceBreakdown = useMemo(() => {
    const completedProjects = quotes.filter((q) => q.status === 'completed');
    const services: { label: ServiceStyle; count: number }[] = [
      { label: 'Direct to Film',  count: 0 },
      { label: 'Screen Printing', count: 0 },
      { label: 'Embroidery',      count: 0 },
      { label: 'Promotional',     count: 0 },
    ];
    completedProjects.forEach((q) => {
      const usedServices = new Set(q.lineItems.map((i) => i.serviceStyle));
      services.forEach((s) => {
        if (usedServices.has(s.label)) s.count += 1;
      });
    });
    return services;
  }, [quotes]);

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

      {/* Completed Projects by Service */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Completed by Service</Text>
          <Text style={styles.sectionSub}>Completed projects only</Text>
        </View>
        <View style={[styles.serviceGrid, isMobile && styles.serviceGridMobile]}>
          {serviceBreakdown.map(({ label, count }) => {
            const cfg = SERVICE_ICON_CONFIG[label];
            const IconComponent = cfg.icon;
            return (
              <View key={label} style={[styles.serviceCard, isMobile && styles.serviceCardMobile]}>
                <View style={[styles.serviceIconWrap, { backgroundColor: cfg.bg }]}>
                  <IconComponent size={20} color={cfg.color} />
                </View>
                <Text style={styles.serviceCount}>{count}</Text>
                <Text style={styles.serviceLabel}>{label}</Text>
                <Text style={styles.serviceSub}>{count === 1 ? 'project' : 'projects'}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recent activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Quotes</Text>
          <TouchableOpacity onPress={() => router.push('/projects')}>
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
          recentQuotes.map((quote) => {
            const effectiveStatus = getEffectiveStatus(quote);
            const cfg = STATUS_CONFIG[effectiveStatus];
            return (
              <TouchableOpacity
                key={quote.id}
                style={styles.quoteRow}
                onPress={() => router.push(`/quote/${quote.id}` as any)}
              >
                <View style={styles.quoteRowLeft}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.bg }]} />
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
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor, borderWidth: 1 }]}>
                    <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const SERVICE_ICON_CONFIG: Record<ServiceStyle, { icon: any; color: string; bg: string }> = {
  'Direct to Film':  { icon: Layers,   color: '#2563EB', bg: '#EFF6FF' },
  'Screen Printing': { icon: Shirt,    color: '#FF5A00', bg: '#FFF4EE' },
  'Embroidery':      { icon: Scissors, color: '#7C3AED', bg: '#F5F3FF' },
  'Promotional':     { icon: Gift,     color: '#059669', bg: '#ECFDF5' },
};

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
  sectionSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  serviceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceGridMobile: {
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  serviceCardMobile: {
    minWidth: '44%' as any,
    padding: 12,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceCount: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  serviceLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    marginBottom: 2,
  },
  serviceSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
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
