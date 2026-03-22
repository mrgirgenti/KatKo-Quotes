import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronRight,
  Trash2,
  FileText,
  CheckCircle,
  RotateCcw,
  Clapperboard,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Quote, QuoteStatus, getEffectiveStatus, STATUS_CONFIG } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';

type SortField = 'date' | 'client' | 'total' | 'status' | 'inHands';
type SortDir = 'asc' | 'desc';

const STATUS_PILLS: { key: 'all' | QuoteStatus; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'quoted',    label: 'Quoted'    },
  { key: 'active',    label: 'Active'    },
  { key: 'completed', label: 'Completed' },
  { key: 'expired',   label: 'Expired'   },
];

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? null : d;
}

interface ProjectRowProps {
  quote: Quote;
  effectiveStatus: QuoteStatus;
  onPress: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onRevert: () => void;
  isDesktop: boolean;
}

function ProjectRow({ quote, effectiveStatus, onPress, onDelete, onConvert, onRevert, isDesktop }: ProjectRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);
  const itemCount = quote.lineItems.length;
  const completedCount = quote.lineItems.filter(i => !!i.completedAt).length;
  const serviceStyles = [...new Set(quote.lineItems.map(i => i.serviceStyle))];
  const total = quote.calculations?.total ?? 0;
  const isActive = effectiveStatus === 'active';
  const isCompleted = effectiveStatus === 'completed';

  const openMenu = () => {
    menuBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setMenuPos({ top: py + height + 4, right: Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 400) - px - width) });
      setMenuOpen(true);
    });
  };

  const applicators = [...new Set(quote.lineItems.map(i => i.applicator).filter(Boolean))];
  const markup = quote.calculations?.markupAmount ?? 0;
  const markupPct = quote.calculations?.markupPercentage ?? 0;

  if (isDesktop) {
    return (
      <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.colStatus}>
          <StatusBadge status={effectiveStatus} />
        </View>
        <View style={styles.colOrderDate}>
          <Text style={styles.tableDate}>{formatDate(quote.orderDate)}</Text>
        </View>
        <View style={styles.colDueDate}>
          <Text style={styles.tableDate}>{quote.inHandsDate ? formatDate(quote.inHandsDate) : '—'}</Text>
        </View>
        <View style={styles.colClient}>
          <Text style={styles.tableClient} numberOfLines={1}>{quote.personOrganization}</Text>
        </View>
        <View style={styles.colProject}>
          <Text style={styles.tableProject} numberOfLines={1}>{quote.projectName}</Text>
        </View>
        <View style={styles.colApplicator}>
          <Text style={styles.tableApplicator} numberOfLines={2}>
            {applicators.length > 0 ? applicators.join('\n') : '—'}
          </Text>
        </View>
        <View style={styles.colServices}>
          <Text style={styles.tableServices} numberOfLines={2}>
            {serviceStyles.length > 0 ? serviceStyles.join('\n') : '—'}
          </Text>
        </View>
        <View style={styles.colTotal}>
          <Text style={styles.tableTotal}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.colMarkup}>
          <Text style={styles.tableMarkup}>{formatCurrency(markup)}</Text>
          <Text style={styles.tableMarkupPct}>{markupPct.toFixed(1)}%</Text>
        </View>
        <View style={styles.colActions}>
          <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
          <View ref={menuBtnRef} collapsable={false}>
            <TouchableOpacity style={styles.menuBtn} onPress={openMenu}>
              <ChevronDown size={14} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={menuOpen}
          transparent
          animationType="none"
          onRequestClose={() => setMenuOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          >
            <View style={[styles.dropdownMenu, { position: 'absolute', top: menuPos.top, right: menuPos.right }]}>
              {effectiveStatus === 'quoted' || effectiveStatus === 'expired' ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onConvert(); }}>
                  <CheckCircle size={14} color={Colors.light.tint} />
                  <Text style={styles.dropdownItemText}>Convert to Active</Text>
                </TouchableOpacity>
              ) : null}
              {(isActive || isCompleted) ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onRevert(); }}>
                  <RotateCcw size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.dropdownItemText}>Revert to Quoted</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemDanger]} onPress={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 size={14} color="#EF4444" />
                <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <StatusBadge status={effectiveStatus} />
        <View style={styles.cardHeaderRight}>
          {quote.invoiceNumber ? (
            <Text style={styles.cardInvoice}>#{quote.invoiceNumber}</Text>
          ) : null}
          <ChevronRight size={16} color={Colors.light.textSecondary} />
        </View>
      </View>
      <Text style={styles.cardClient} numberOfLines={1}>{quote.personOrganization}</Text>
      <Text style={styles.cardProject} numberOfLines={1}>{quote.projectName}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaLeft}>
          <Text style={styles.cardMetaText}>{formatDate(quote.orderDate)}</Text>
          {quote.inHandsDate ? (
            <Text style={styles.cardMetaSep}>·</Text>
          ) : null}
          {quote.inHandsDate ? (
            <Text style={styles.cardMetaText}>Due {formatDate(quote.inHandsDate)}</Text>
          ) : null}
        </View>
        <Text style={styles.cardTotal}>{formatCurrency(total)}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardServiceStyles} numberOfLines={1}>
          {serviceStyles.join(' · ')}
          {(isActive || isCompleted) ? ` · ${completedCount}/${itemCount} items done` : ` · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { projects, deleteQuote, convertToSale, convertToQuote, isLoading } = useQuotes();
  const { isMobile, isDesktop } = useBreakpoint();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMinMax] = useState('');

  const resolvedProjects = useMemo(() =>
    projects.map(q => ({ quote: q, effectiveStatus: getEffectiveStatus(q) })),
    [projects]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resolvedProjects.length };
    resolvedProjects.forEach(({ effectiveStatus }) => {
      counts[effectiveStatus] = (counts[effectiveStatus] || 0) + 1;
    });
    return counts;
  }, [resolvedProjects]);

  const filtered = useMemo(() => {
    let list = resolvedProjects;

    if (statusFilter !== 'all') {
      list = list.filter(({ effectiveStatus }) => effectiveStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(({ quote }) =>
        quote.personOrganization.toLowerCase().includes(q) ||
        quote.projectName.toLowerCase().includes(q) ||
        (quote.invoiceNumber || '').toLowerCase().includes(q)
      );
    }

    if (minTotal) {
      const min = parseFloat(minTotal);
      if (!isNaN(min)) list = list.filter(({ quote }) => (quote.calculations?.total ?? 0) >= min);
    }
    if (maxTotal) {
      const max = parseFloat(maxTotal);
      if (!isNaN(max)) list = list.filter(({ quote }) => (quote.calculations?.total ?? 0) <= max);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const da = parseDate(a.quote.orderDate)?.getTime() ?? 0;
        const db = parseDate(b.quote.orderDate)?.getTime() ?? 0;
        cmp = da - db;
      } else if (sortField === 'inHands') {
        const da = parseDate(a.quote.inHandsDate)?.getTime() ?? 0;
        const db = parseDate(b.quote.inHandsDate)?.getTime() ?? 0;
        cmp = da - db;
      } else if (sortField === 'client') {
        cmp = a.quote.personOrganization.localeCompare(b.quote.personOrganization);
      } else if (sortField === 'total') {
        cmp = (a.quote.calculations?.total ?? 0) - (b.quote.calculations?.total ?? 0);
      } else if (sortField === 'status') {
        cmp = a.effectiveStatus.localeCompare(b.effectiveStatus);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [resolvedProjects, statusFilter, search, minTotal, maxTotal, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const handleView = useCallback((quote: Quote) => {
    router.push(`/quote/${quote.id}`);
  }, [router]);

  const handleDelete = useCallback((quote: Quote) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${quote.projectName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteQuote(quote.id) },
      ]
    );
  }, [deleteQuote]);

  const handleConvert = useCallback((quote: Quote) => {
    Alert.alert(
      'Mark as Active',
      `Convert "${quote.projectName}" to Active status?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Convert', onPress: () => convertToSale(quote.id) },
      ]
    );
  }, [convertToSale]);

  const handleRevert = useCallback((quote: Quote) => {
    convertToQuote(quote.id);
  }, [convertToQuote]);

  const activeFilterCount = [
    minTotal,
    maxTotal,
  ].filter(Boolean).length;

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]}>{label}</Text>
      {sortField === field && (
        <ArrowUpDown size={11} color={Colors.light.tint} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>{resolvedProjects.length} project{resolvedProjects.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Status Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsRow}
        >
          {STATUS_PILLS.map(pill => {
            const count = statusCounts[pill.key] ?? 0;
            const active = statusFilter === pill.key;
            const cfg = pill.key !== 'all' ? STATUS_CONFIG[pill.key as QuoteStatus] : null;
            return (
              <TouchableOpacity
                key={pill.key}
                style={[
                  styles.pill,
                  active && styles.pillActive,
                  active && cfg ? { backgroundColor: cfg.bg, borderColor: cfg.borderColor } : null,
                ]}
                onPress={() => setStatusFilter(pill.key as any)}
              >
                <Text style={[
                  styles.pillText,
                  active && styles.pillTextActive,
                  active && cfg ? { color: cfg.color } : null,
                ]}>
                  {pill.label}
                </Text>
                <View style={[styles.pillCount, active && cfg ? { backgroundColor: cfg.borderColor } : null]}>
                  <Text style={[styles.pillCountText, active && cfg ? { color: cfg.color } : null]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search + Filter Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search client, project, invoice…"
              placeholderTextColor={Colors.light.textSecondary}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={15} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={16} color={showFilters ? Colors.light.tint : Colors.light.textSecondary} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filtersPanelTitle}>ADVANCED FILTERS</Text>
            <View style={styles.filtersRow}>
              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Min Total ($)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="0"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={minTotal}
                  onChangeText={setMinTotal}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Max Total ($)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="No limit"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={maxTotal}
                  onChangeText={setMinMax}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => { setMinTotal(''); setMinMax(''); }}
              >
                <Text style={styles.clearFiltersBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Desktop: Sort row / Table header */}
        {isDesktop && (
          <View style={styles.tableHeader}>
            <View style={styles.colStatus}><Text style={styles.thText}>Status</Text></View>
            <View style={styles.colOrderDate}>
              <SortBtn field="date" label="Order Date" />
            </View>
            <View style={styles.colDueDate}>
              <SortBtn field="inHands" label="Due Date" />
            </View>
            <View style={styles.colClient}>
              <SortBtn field="client" label="Client" />
            </View>
            <View style={styles.colProject}><Text style={styles.thText}>Project</Text></View>
            <View style={styles.colApplicator}><Text style={styles.thText}>Applicator(s)</Text></View>
            <View style={styles.colServices}><Text style={styles.thText}>Service(s)</Text></View>
            <View style={styles.colTotal}>
              <SortBtn field="total" label="Total" />
            </View>
            <View style={styles.colMarkup}><Text style={styles.thText}>Markup</Text></View>
            <View style={styles.colActions}><Text style={styles.thText}>Actions</Text></View>
          </View>
        )}
      </View>

      {/* Mobile sort bar */}
      {!isDesktop && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileSortScroll} contentContainerStyle={styles.mobileSortRow}>
          <Text style={styles.mobileSortLabel}>Sort:</Text>
          {(['date', 'inHands', 'client', 'total'] as SortField[]).map(f => (
            <TouchableOpacity key={f} style={[styles.mobileSortBtn, sortField === f && styles.mobileSortBtnActive]} onPress={() => toggleSort(f)}>
              <Text style={[styles.mobileSortBtnText, sortField === f && styles.mobileSortBtnTextActive]}>
                {f === 'date' ? 'Order Date' : f === 'inHands' ? 'Due Date' : f === 'client' ? 'Client' : 'Total'}
                {sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading projects…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={36} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No projects found</Text>
          <Text style={styles.emptyText}>
            {search || statusFilter !== 'all' || minTotal || maxTotal
              ? 'Try adjusting your filters.'
              : 'Submit a quote to see it here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={({ quote }) => quote.id}
          contentContainerStyle={isDesktop ? styles.tableBody : styles.cardList}
          ItemSeparatorComponent={isDesktop ? () => <View style={styles.tableDivider} /> : undefined}
          renderItem={({ item: { quote, effectiveStatus } }) => (
            <ProjectRow
              quote={quote}
              effectiveStatus={effectiveStatus}
              onPress={() => handleView(quote)}
              onDelete={() => handleDelete(quote)}
              onConvert={() => handleConvert(quote)}
              onRevert={() => handleRevert(quote)}
              isDesktop={isDesktop}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },

  pillsScroll: { maxHeight: 46 },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  pillActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  pillTextActive: {
    color: Colors.light.tint,
    fontWeight: '700',
  },
  pillCount: {
    backgroundColor: Colors.light.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },

  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  filtersPanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 10,
  },
  filtersPanelTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  filterField: { flex: 1, minWidth: 100, gap: 4 },
  filterLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },
  filterInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
    outlineStyle: 'none' as any,
  },
  clearFiltersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  clearFiltersBtnText: { fontSize: 13, color: Colors.light.textSecondary },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111111',
  },
  thText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sortBtnText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },

  mobileSortScroll: { maxHeight: 38, backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  mobileSortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  mobileSortLabel: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' },
  mobileSortBtn: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  mobileSortBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  mobileSortBtnText: { fontSize: 12, color: Colors.light.textSecondary },
  mobileSortBtnTextActive: { color: Colors.light.tint, fontWeight: '600' },

  tableBody: { paddingBottom: 40 },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginHorizontal: 20 },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.light.surface,
  },
  colStatus:    { width: 90 },
  colOrderDate: { width: 95 },
  colDueDate:   { width: 95 },
  colClient:    { flex: 1.2 },
  colProject:   { flex: 1.2 },
  colApplicator:{ flex: 1.2 },
  colServices:  { flex: 1.0 },
  colTotal:     { width: 85, alignItems: 'flex-end' },
  colMarkup:    { width: 85, alignItems: 'flex-end' },
  colActions:   { width: 100, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },

  tableDate:       { fontSize: 13, color: Colors.light.text },
  tableDateSub:    { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tableClient:     { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  tableProject:    { fontSize: 13, color: Colors.light.text },
  tableApplicator: { fontSize: 12, color: Colors.light.text, lineHeight: 17 },
  tableServices:   { fontSize: 12, color: Colors.light.tint, fontWeight: '600', lineHeight: 17 },
  tableTotal:      { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  tableMarkup:     { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  tableMarkupPct:  { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },

  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: Colors.light.tint,
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
  },
  dropdownMenu: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 180,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dropdownItemDanger: { borderBottomWidth: 0 },
  dropdownItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },

  cardList: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 5,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardInvoice: { fontSize: 12, color: Colors.light.textSecondary },
  cardClient: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  cardProject: { fontSize: 14, color: Colors.light.textSecondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  cardMetaSep: { color: Colors.light.textSecondary, fontSize: 12 },
  cardMetaText: { fontSize: 12, color: Colors.light.textSecondary },
  cardTotal: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  cardFooter: { marginTop: 2 },
  cardServiceStyles: { fontSize: 12, color: Colors.light.textSecondary },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
});
