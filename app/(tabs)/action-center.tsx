import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Zap, Search, X, CheckCircle, Eye, ExternalLink,
  AlertTriangle, AlertCircle, Clock, RefreshCw,
} from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useActions } from '@/contexts/ActionsContext';
import OverlayMenu from '@/components/OverlayMenu';
import {
  ACTION_CATEGORY, ACTION_TYPE_LABEL,
  ACTION_CATEGORY_LABEL, PRIORITY_CONFIG, CATEGORY_CONFIG,
} from '@/types/actions';
import type { ActionItemWithContext, ActionStatus, ActionCategory } from '@/types/actions';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFull(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const STATUS_LABELS: Record<ActionStatus, string> = {
  NEW: 'New',
  VIEWED: 'Viewed',
  RESOLVED: 'Resolved',
};
const STATUS_COLORS: Record<ActionStatus, { color: string; bg: string }> = {
  NEW:      { color: '#DC2626', bg: '#FEF2F2' },
  VIEWED:   { color: '#D97706', bg: '#FFFBEB' },
  RESOLVED: { color: '#16A34A', bg: '#F0FDF4' },
};

const CATEGORY_ICONS: Record<ActionCategory, React.ReactElement> = {
  NEEDS_REVIEW:      <Clock size={13} color="#D97706" />,
  CUSTOMER_REQUESTS: <Eye size={13} color="#2563EB" />,
  PRODUCTION_ISSUES: <AlertTriangle size={13} color="#DC2626" />,
  SYSTEM_ALERTS:     <AlertCircle size={13} color="#7C3AED" />,
};

type FilterStatus = 'ALL' | ActionStatus;

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]
    ?? { label: priority, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <View style={[s.priTag, { backgroundColor: cfg.bg }]}>
      <Text style={[s.priTagText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StatusTag({ status }: { status: ActionStatus }) {
  const cfg = STATUS_COLORS[status];
  return (
    <View style={[s.statusTag, { backgroundColor: cfg.bg }]}>
      <Text style={[s.statusTagText, { color: cfg.color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function StatCard({
  label, count, category, onPress, active,
}: {
  label: string;
  count: number;
  category: ActionCategory;
  onPress: () => void;
  active: boolean;
}) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <TouchableOpacity
      style={[s.statCard, active && { borderColor: cfg.color, borderWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.statCardAccent, { backgroundColor: cfg.color }]} />
      <View style={s.statCardBody}>
        <Text style={[s.statCount, { color: active ? cfg.color : '#111' }]}>{count}</Text>
        <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface DrawerProps {
  item: ActionItemWithContext;
  onClose: () => void;
  onMarkViewed: () => void;
  onMarkResolved: () => void;
}

function DrawerContent({ item, onClose, onMarkViewed, onMarkResolved }: DrawerProps) {
  const router = useRouter();
  const category = ACTION_CATEGORY[item.type];
  const catCfg = CATEGORY_CONFIG[category];

  return (
    <View style={s.drawer}>
      <View style={s.drawerHeader}>
        <View style={{ flex: 1 }}>
          <View style={s.drawerCatRow}>
            {CATEGORY_ICONS[category]}
            <Text style={[s.drawerCatLabel, { color: catCfg.color }]}>
              {ACTION_CATEGORY_LABEL[category]}
            </Text>
          </View>
          <Text style={s.drawerTitle} numberOfLines={3}>{item.title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.drawerScroll} showsVerticalScrollIndicator={false}>
        {/* DETAILS section */}
        <View style={s.drawerSection}>
          <View style={s.drawerSectionHeader}>
            <Text style={s.drawerSectionTitle}>DETAILS</Text>
          </View>
          <View style={s.drawerSectionBody}>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Type</Text>
              <Text style={s.drawerRowValue}>{ACTION_TYPE_LABEL[item.type]}</Text>
            </View>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Priority</Text>
              <PriorityBadge priority={item.priority} />
            </View>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Status</Text>
              <StatusTag status={item.status} />
            </View>
            {item.description ? (
              <View style={[s.drawerRow, { alignItems: 'flex-start' }]}>
                <Text style={s.drawerRowLabel}>Note</Text>
                <Text style={[s.drawerRowValue, { flex: 1, flexWrap: 'wrap' }]}>
                  {item.description}
                </Text>
              </View>
            ) : null}
            {item.organizationName ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Organization</Text>
                <Text style={s.drawerRowValue}>{item.organizationName}</Text>
              </View>
            ) : null}
            {item.projectTitle ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Project</Text>
                <Text style={s.drawerRowValue}>{item.projectTitle}</Text>
              </View>
            ) : null}
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Created</Text>
              <Text style={s.drawerRowValue}>{formatFull(item.createdAt)}</Text>
            </View>
            {item.viewedAt ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Viewed</Text>
                <Text style={s.drawerRowValue}>{formatFull(item.viewedAt)}</Text>
              </View>
            ) : null}
            {item.resolvedAt ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Resolved</Text>
                <Text style={s.drawerRowValue}>{formatFull(item.resolvedAt)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ACTIONS section */}
        <View style={s.drawerSection}>
          <View style={s.drawerSectionHeader}>
            <Text style={s.drawerSectionTitle}>ACTIONS</Text>
          </View>
          <View style={s.drawerSectionBody}>
            {item.projectId ? (
              <TouchableOpacity
                style={s.drawerBtn}
                onPress={() => router.push(`/quote/${item.projectId}` as any)}
                activeOpacity={0.8}
              >
                <ExternalLink size={14} color="#fff" />
                <Text style={s.drawerBtnText}>Open Project</Text>
              </TouchableOpacity>
            ) : null}
            {item.organizationId ? (
              <TouchableOpacity
                style={[s.drawerBtn, s.drawerBtnSecondary]}
                onPress={() => router.push(`/crm/${item.organizationId}` as any)}
                activeOpacity={0.8}
              >
                <ExternalLink size={14} color="#111" />
                <Text style={[s.drawerBtnText, { color: '#111' }]}>Open Organization</Text>
              </TouchableOpacity>
            ) : null}
            {item.status === 'NEW' ? (
              <TouchableOpacity
                style={[s.drawerBtn, s.drawerBtnSecondary]}
                onPress={onMarkViewed}
                activeOpacity={0.8}
              >
                <Eye size={14} color="#111" />
                <Text style={[s.drawerBtnText, { color: '#111' }]}>Mark Viewed</Text>
              </TouchableOpacity>
            ) : null}
            {item.status !== 'RESOLVED' ? (
              <TouchableOpacity
                style={[s.drawerBtn, s.drawerBtnSuccess]}
                onPress={onMarkResolved}
                activeOpacity={0.8}
              >
                <CheckCircle size={14} color="#fff" />
                <Text style={s.drawerBtnText}>Mark Resolved</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ACTIVITY section */}
        <View style={[s.drawerSection, { marginBottom: 32 }]}>
          <View style={s.drawerSectionHeader}>
            <Text style={s.drawerSectionTitle}>ACTIVITY</Text>
          </View>
          <View style={s.drawerSectionBody}>
            <View style={s.activityItem}>
              <View style={s.activityDot} />
              <View>
                <Text style={s.activityText}>Item created</Text>
                <Text style={s.activityTime}>{formatFull(item.createdAt)}</Text>
              </View>
            </View>
            {item.viewedAt ? (
              <View style={s.activityItem}>
                <View style={[s.activityDot, { backgroundColor: '#D97706' }]} />
                <View>
                  <Text style={s.activityText}>Marked viewed</Text>
                  <Text style={s.activityTime}>{formatFull(item.viewedAt)}</Text>
                </View>
              </View>
            ) : null}
            {item.resolvedAt ? (
              <View style={s.activityItem}>
                <View style={[s.activityDot, { backgroundColor: '#16A34A' }]} />
                <View>
                  <Text style={s.activityText}>Marked resolved</Text>
                  <Text style={s.activityTime}>{formatFull(item.resolvedAt)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function ActionCenterScreen() {
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const {
    actions, isLoading,
    unresolvedCount,
    needsReviewCount, customerRequestsCount,
    productionIssuesCount, systemAlertsCount,
    markViewed, markResolved, refetch,
  } = useActions();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<ActionItemWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    let items = [...actions].sort((a, b) => {
      const pd = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
      if (pd !== 0) return pd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    if (statusFilter !== 'ALL') items = items.filter(a => a.status === statusFilter);
    if (categoryFilter) items = items.filter(a => ACTION_CATEGORY[a.type] === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.organizationName ?? '').toLowerCase().includes(q) ||
        (a.projectTitle ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [actions, statusFilter, categoryFilter, search]);

  const openItem = (item: ActionItemWithContext) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    if (item.status === 'NEW') markViewed(item.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  const handleMarkViewed = () => {
    if (selectedItem) {
      markViewed(selectedItem.id);
      setSelectedItem(prev => prev ? { ...prev, status: 'VIEWED' } : prev);
    }
  };

  const handleMarkResolved = () => {
    if (selectedItem) {
      markResolved(selectedItem.id);
      closeDrawer();
    }
  };

  const STAT_CARDS: { label: string; count: number; category: ActionCategory }[] = [
    { label: 'Needs Review',       count: needsReviewCount,      category: 'NEEDS_REVIEW' },
    { label: 'Customer Requests',  count: customerRequestsCount, category: 'CUSTOMER_REQUESTS' },
    { label: 'Production Issues',  count: productionIssuesCount, category: 'PRODUCTION_ISSUES' },
    { label: 'System Alerts',      count: systemAlertsCount,     category: 'SYSTEM_ALERTS' },
  ];

  const FILTER_PILLS: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'New', value: 'NEW' },
    { label: 'Viewed', value: 'VIEWED' },
    { label: 'Resolved', value: 'RESOLVED' },
  ];

  const showSplitDrawer = isDesktop && drawerOpen;

  return (
    <View style={s.root}>
      {/* PAGE HEADER */}
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Zap size={20} color="#FF5A00" />
          <Text style={s.pageTitle}>Action Center</Text>
          {unresolvedCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{unresolvedCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={refetch} style={s.refreshBtn} activeOpacity={0.7}>
          <RefreshCw size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* STAT CARDS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.statsRow}
      >
        {STAT_CARDS.map(({ label, count, category }) => (
          <StatCard
            key={category}
            label={label}
            count={count}
            category={category}
            active={categoryFilter === category}
            onPress={() => setCategoryFilter(categoryFilter === category ? null : category)}
          />
        ))}
      </ScrollView>

      {/* TOOLBAR */}
      <View style={s.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPills}>
          {FILTER_PILLS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[s.pill, statusFilter === value && s.pillActive]}
              onPress={() => setStatusFilter(value)}
              activeOpacity={0.8}
            >
              <Text style={[s.pillText, statusFilter === value && s.pillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.searchWrap}>
          <Search size={14} color="#9CA3AF" />
          <TextInput
            style={s.searchInput}
            placeholder="Search…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <X size={13} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* MAIN AREA: table + split drawer */}
      <View style={[s.mainArea, showSplitDrawer && { flexDirection: 'row' }]}>

        {/* TABLE */}
        <View style={[s.tableWrap, showSplitDrawer && { flex: 1, minWidth: 0 }]}>
          {/* Table header */}
          <View style={s.tableHead}>
            <Text style={[s.thCell, { width: 100 }]}>PRIORITY</Text>
            <Text style={[s.thCell, { width: 180 }]}>TYPE</Text>
            <Text style={[s.thCell, { flex: 1, minWidth: 220 }]}>DETAILS</Text>
            <Text style={[s.thCell, { width: 90 }]}>TIME</Text>
            <Text style={[s.thCell, { width: 88 }]}>STATUS</Text>
            <Text style={[s.thCell, { width: 52 }]}> </Text>
          </View>

          {/* Rows */}
          <ScrollView style={s.tableBody} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={s.emptyState}>
                <ActivityIndicator color="#FF5A00" />
              </View>
            ) : filtered.length === 0 ? (
              <View style={s.emptyState}>
                <Zap size={28} color="#E5E7EB" />
                <Text style={s.emptyStateText}>
                  {search || statusFilter !== 'ALL' || categoryFilter
                    ? 'No items match your filters'
                    : 'No action items — you\'re all caught up!'}
                </Text>
              </View>
            ) : (
              filtered.map((item, idx) => {
                const isSelected = selectedItem?.id === item.id;
                const category = ACTION_CATEGORY[item.type];
                const catCfg = CATEGORY_CONFIG[category];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      s.tableRow,
                      idx % 2 === 1 && s.tableRowAlt,
                      isSelected && s.tableRowSelected,
                      item.status === 'RESOLVED' && s.tableRowResolved,
                    ]}
                    onPress={() => openItem(item)}
                    activeOpacity={0.75}
                  >
                    {/* Priority */}
                    <View style={[s.tdCell, { width: 100 }]}>
                      <PriorityBadge priority={item.priority} />
                    </View>

                    {/* Type */}
                    <View style={[s.tdCell, { width: 180, flexDirection: 'column', alignItems: 'flex-start', gap: 3 }]}>
                      <Text style={s.tdPrimary} numberOfLines={1}>
                        {ACTION_TYPE_LABEL[item.type]}
                      </Text>
                      <View style={s.catTag}>
                        {CATEGORY_ICONS[category]}
                        <Text style={[s.catTagText, { color: catCfg.color }]} numberOfLines={1}>
                          {ACTION_CATEGORY_LABEL[category]}
                        </Text>
                      </View>
                    </View>

                    {/* Details */}
                    <View style={[s.tdCell, { flex: 1, minWidth: 220, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                      <Text style={s.tdPrimary} numberOfLines={2}>{item.title}</Text>
                      {(item.organizationName || item.projectTitle) ? (
                        <Text style={s.tdSub} numberOfLines={1}>
                          {[item.organizationName, item.projectTitle].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>

                    {/* Time */}
                    <View style={[s.tdCell, { width: 90 }]}>
                      <Text style={s.tdSub}>{relativeTime(item.createdAt)}</Text>
                    </View>

                    {/* Status */}
                    <View style={[s.tdCell, { width: 88 }]}>
                      <StatusTag status={item.status} />
                    </View>

                    {/* Actions menu */}
                    <View style={[s.tdCell, { width: 52, justifyContent: 'center' }]}>
                      <OverlayMenu
                        menuWidth={180}
                        align="right"
                        trigger={({ open }) => (
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); open(); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={s.menuDots}
                          >
                            <Text style={s.menuDotsText}>•••</Text>
                          </TouchableOpacity>
                        )}
                      >
                        {({ close }) => (
                          <>
                            <TouchableOpacity
                              style={s.menuItem}
                              onPress={() => { close(); openItem(item); }}
                            >
                              <ExternalLink size={14} color="#374151" />
                              <Text style={s.menuItemText}>View Details</Text>
                            </TouchableOpacity>
                            {item.projectId ? (
                              <TouchableOpacity
                                style={s.menuItem}
                                onPress={() => { close(); router.push(`/quote/${item.projectId}` as any); }}
                              >
                                <ExternalLink size={14} color="#374151" />
                                <Text style={s.menuItemText}>Open Project</Text>
                              </TouchableOpacity>
                            ) : null}
                            {item.status === 'NEW' ? (
                              <TouchableOpacity
                                style={s.menuItem}
                                onPress={() => { close(); markViewed(item.id); }}
                              >
                                <Eye size={14} color="#374151" />
                                <Text style={s.menuItemText}>Mark Viewed</Text>
                              </TouchableOpacity>
                            ) : null}
                            {item.status !== 'RESOLVED' ? (
                              <TouchableOpacity
                                style={s.menuItem}
                                onPress={() => { close(); markResolved(item.id); }}
                              >
                                <CheckCircle size={14} color="#16A34A" />
                                <Text style={[s.menuItemText, { color: '#16A34A' }]}>Mark Resolved</Text>
                              </TouchableOpacity>
                            ) : null}
                          </>
                        )}
                      </OverlayMenu>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* DESKTOP SPLIT DRAWER */}
        {showSplitDrawer && selectedItem ? (
          <View style={s.splitDrawerWrap}>
            <DrawerContent
              item={selectedItem}
              onClose={closeDrawer}
              onMarkViewed={handleMarkViewed}
              onMarkResolved={handleMarkResolved}
            />
          </View>
        ) : null}
      </View>

      {/* MOBILE DRAWER MODAL */}
      {!isDesktop && (
        <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={closeDrawer}>
          <Pressable style={s.modalOverlay} onPress={closeDrawer} />
          <View style={s.modalSheet}>
            {selectedItem ? (
              <DrawerContent
                item={selectedItem}
                onClose={closeDrawer}
                onMarkViewed={handleMarkViewed}
                onMarkResolved={handleMarkResolved}
              />
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  headerBadge: {
    backgroundColor: '#FF5A00',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  refreshBtn: { padding: 6 },

  statsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  statCard: {
    flexDirection: 'row',
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  statCardAccent: { width: 4 },
  statCardBody: { flex: 1, padding: 12 },
  statCount: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  statLabel: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 2 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterPills: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  pillTextActive: { color: '#fff' },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 6,
    height: 34,
    minWidth: 140,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111',
    outlineStyle: 'none' as any,
  },

  mainArea: { flex: 1 },

  tableWrap: { flex: 1 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  thCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableBody: { flex: 1 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 54,
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableRowSelected: { backgroundColor: '#FFF7ED' },
  tableRowResolved: { opacity: 0.55 },
  tdCell: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  tdPrimary: { fontSize: 13, fontWeight: '500', color: '#111' },
  tdSub: { fontSize: 11, color: '#6B7280' },

  priTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  priTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  statusTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusTagText: { fontSize: 10, fontWeight: '700' },

  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  catTagText: { fontSize: 10, fontWeight: '600' },

  menuDots: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  menuDotsText: { fontSize: 9, color: '#374151', letterSpacing: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: { fontSize: 13, color: '#374151' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyStateText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  /* Split drawer (desktop) */
  splitDrawerWrap: {
    width: 360,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },

  /* Mobile modal */
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },

  /* Drawer content */
  drawer: { flex: 1, backgroundColor: '#fff' },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  drawerCatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  drawerCatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  drawerTitle: { fontSize: 15, fontWeight: '700', color: '#111', lineHeight: 20 },
  drawerScroll: { flex: 1 },

  drawerSection: { marginTop: 4 },
  drawerSectionHeader: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  drawerSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  drawerSectionBody: { padding: 16, gap: 10 },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  drawerRowLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', minWidth: 80 },
  drawerRowValue: { fontSize: 13, color: '#111', fontWeight: '500', textAlign: 'right' },

  drawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FF5A00',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 16,
  },
  drawerBtnSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  drawerBtnSuccess: {
    backgroundColor: '#16A34A',
  },
  drawerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
    marginTop: 4,
  },
  activityText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  activityTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
});
