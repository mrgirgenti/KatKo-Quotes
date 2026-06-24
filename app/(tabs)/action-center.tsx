import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Modal, Pressable, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search, X, CheckCircle, Eye, ExternalLink,
  AlertTriangle, MessageCircle, Bell, Settings,
  ChevronLeft, ChevronRight, SlidersHorizontal, RefreshCw, Paperclip,
} from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useActions } from '@/contexts/ActionsContext';
import OverlayMenu from '@/components/OverlayMenu';
import {
  ACTION_CATEGORY, ACTION_TYPE_LABEL, ACTION_CATEGORY_LABEL,
} from '@/types/actions';
import type { ActionItemWithContext, ActionCategory, ActionType } from '@/types/actions';

// ─── Constants ──────────────────────────────────────────────────────────────

const BRAND = '#FF5A00';
const PAGE_SIZE = 8;

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH:     '#DC2626',
  NORMAL:   '#F59E0B',
  LOW:      '#3B82F6',
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: 'Critical', HIGH: 'High', NORMAL: 'Normal', LOW: 'Low',
};

const CAT_COLOR: Record<ActionCategory, string> = {
  NEEDS_REVIEW:      '#DC2626',
  CUSTOMER_REQUESTS: '#EA580C',
  PRODUCTION_ISSUES: '#2563EB',
  SYSTEM_ALERTS:     '#D97706',
};

const CAT_LIGHT: Record<ActionCategory, string> = {
  NEEDS_REVIEW:      '#FEF2F2',
  CUSTOMER_REQUESTS: '#FFF7ED',
  PRODUCTION_ISSUES: '#EFF6FF',
  SYSTEM_ALERTS:     '#FFFBEB',
};

const ACTION_CTA: Record<ActionType, string> = {
  NEW_QUOTE_SUBMISSION:        'Open Quote',
  QUOTE_MISSING_INFORMATION:   'Open Quote',
  QUOTE_RETURNED_FOR_REVISION: 'Open Quote',
  QUOTE_REVISION_REQUEST:      'Open Quote',
  ARTWORK_UPLOADED:            'Open Project',
  CUSTOMER_COMMENT:            'Open Project',
  MISSING_ARTWORK:             'Open Project',
  MOCKUP_APPROVAL_REQUIRED:    'Open Project',
  PRODUCTION_ISSUE_REPORTED:   'Open Project',
  QUOTE_DELIVERY_FAILED:       'Open Quote',
  INVOICE_DELIVERY_FAILED:     'Open Quote',
  EMAIL_BOUNCE:                'Open Quote',
  PAYMENT_LINK_FAILED:         'Open Quote',
  PDF_GENERATION_FAILED:       'Open Quote',
};

type FilterKey = 'all' | 'new' | 'viewed' | 'resolved' | ActionCategory;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function ctaFor(item: ActionItemWithContext): string {
  if (item.projectId) return ACTION_CTA[item.type] ?? 'Open Project';
  if (item.organizationId) return 'Open Organization';
  return 'Open';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: string }) {
  const color = PRIORITY_DOT[priority] ?? '#6B7280';
  const label = PRIORITY_LABEL[priority] ?? priority;
  return (
    <View style={s.priDotRow}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.priText, { color }]}>{label}</Text>
    </View>
  );
}

function StatCard({
  category, count, active, onPress,
}: {
  category: ActionCategory; count: number; active: boolean; onPress: () => void;
}) {
  const color = CAT_COLOR[category];
  const bg = active ? CAT_LIGHT[category] : '#fff';
  const icons: Record<ActionCategory, React.ReactElement> = {
    NEEDS_REVIEW:      <AlertTriangle size={18} color={color} />,
    CUSTOMER_REQUESTS: <MessageCircle size={18} color={color} />,
    PRODUCTION_ISSUES: <Settings size={18} color={color} />,
    SYSTEM_ALERTS:     <Bell size={18} color={color} />,
  };
  return (
    <TouchableOpacity
      style={[s.statCard, { backgroundColor: bg, borderColor: active ? color : '#E5E7EB' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.statIconCircle, { backgroundColor: CAT_LIGHT[category] }]}>
        {icons[category]}
      </View>
      <View style={s.statBody}>
        <Text style={[s.statCount, { color: active ? color : '#111' }]}>{count}</Text>
        <Text style={s.statLabel}>{ACTION_CATEGORY_LABEL[category]}</Text>
      </View>
      <View style={[s.statBar, { backgroundColor: color }]} />
    </TouchableOpacity>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

function DrawerPanel({
  item,
  onClose,
  onMarkResolved,
}: {
  item: ActionItemWithContext;
  onClose: () => void;
  onMarkResolved: () => void;
}) {
  const router = useRouter();
  const category = ACTION_CATEGORY[item.type];
  const color = CAT_COLOR[category];
  const ctaLabel = ctaFor(item);

  const navigate = () => {
    if (item.projectId) router.push(`/quote/${item.projectId}` as any);
    else if (item.organizationId) router.push(`/crm/${item.organizationId}` as any);
  };

  const requestedByName = item.metadata?.requestedByName ?? item.metadata?.responderName ?? null;
  const requestedByEmail = item.metadata?.requestedByEmail ?? null;
  const attachments: any[] = Array.isArray(item.metadata?.attachments) ? item.metadata!.attachments : [];

  return (
    <View style={s.drawer}>
      {/* Drawer Header */}
      <View style={s.drawerHead}>
        <View style={[s.drawerIconCircle, { backgroundColor: CAT_LIGHT[category] }]}>
          {category === 'NEEDS_REVIEW'      ? <AlertTriangle size={18} color={color} /> :
           category === 'CUSTOMER_REQUESTS' ? <MessageCircle size={18} color={color} /> :
           category === 'PRODUCTION_ISSUES' ? <Settings size={18} color={color} /> :
                                              <Bell size={18} color={color} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.drawerTitleRow}>
            <Text style={s.drawerTitle} numberOfLines={2}>{item.title}</Text>
            <View style={[s.priBadge, { backgroundColor: CAT_LIGHT[category] }]}>
              <View style={[s.dot, { backgroundColor: PRIORITY_DOT[item.priority] ?? color }]} />
              <Text style={[s.priBadgeText, { color: PRIORITY_DOT[item.priority] ?? color }]}>
                {PRIORITY_LABEL[item.priority] ?? item.priority} Priority
              </Text>
            </View>
          </View>
          {(item.projectNumber || item.organizationName || item.projectTitle) ? (
            <Text style={s.drawerBreadcrumb} numberOfLines={1}>
              {[item.projectNumber, item.organizationName, item.projectTitle].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.drawerScroll} showsVerticalScrollIndicator={false}>
        {/* DETAILS */}
        <View style={s.drawerSection}>
          <View style={s.drawerSecHead}><Text style={s.drawerSecTitle}>Details</Text></View>
          <View style={s.drawerSecBody}>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Action Type</Text>
              <Text style={s.drawerRowValue}>{ACTION_TYPE_LABEL[item.type]}</Text>
            </View>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Priority</Text>
              <PriorityDot priority={item.priority} />
            </View>
            {item.organizationName ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Organization</Text>
                <Text style={s.drawerRowValue} numberOfLines={1}>{item.organizationName}</Text>
              </View>
            ) : null}
            {item.projectTitle ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Project</Text>
                <Text style={s.drawerRowValue} numberOfLines={1}>{item.projectTitle}</Text>
              </View>
            ) : null}
            {item.projectNumber ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Quote / Project #</Text>
                <Text style={s.drawerRowValue}>{item.projectNumber}</Text>
              </View>
            ) : null}
            {requestedByName ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Requested By</Text>
                <Text style={s.drawerRowValue} numberOfLines={1}>{requestedByName}</Text>
              </View>
            ) : null}
            {requestedByEmail ? (
              <View style={s.drawerRow}>
                <Text style={s.drawerRowLabel}>Requested By Email</Text>
                <Text style={s.drawerRowValue} numberOfLines={1}>{requestedByEmail}</Text>
              </View>
            ) : null}
            <View style={s.drawerRow}>
              <Text style={s.drawerRowLabel}>Date / Time</Text>
              <Text style={s.drawerRowValue}>{fullDate(item.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* COMMENTS */}
        {item.description ? (
          <View style={s.drawerSection}>
            <View style={s.drawerSecHead}><Text style={s.drawerSecTitle}>Comments</Text></View>
            <View style={s.drawerSecBody}>
              <Text style={s.drawerCommentText}>{item.description}</Text>
            </View>
          </View>
        ) : null}

        {/* ATTACHMENTS */}
        {attachments.length > 0 ? (
          <View style={s.drawerSection}>
            <View style={s.drawerSecHead}><Text style={s.drawerSecTitle}>Attachments</Text></View>
            <View style={[s.drawerSecBody, { gap: 10 }]}>
              {attachments.map((att, i) => {
                const name = typeof att === 'string'
                  ? (att.split('/').pop() || att)
                  : (att?.name || att?.url || `Attachment ${i + 1}`);
                const url = typeof att === 'string' ? att : (att?.url || null);
                return (
                  <TouchableOpacity
                    key={i}
                    style={s.relatedLink}
                    activeOpacity={0.8}
                    disabled={!url}
                    onPress={() => { if (url) Linking.openURL(url).catch(() => {}); }}
                  >
                    <Paperclip size={14} color={BRAND} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.relatedLinkTitle} numberOfLines={1}>{name}</Text>
                    </View>
                    {url ? <ChevronRight size={14} color="#9CA3AF" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom action buttons */}
      <View style={s.drawerFooter}>
        {(item.projectId || item.organizationId) ? (
          <TouchableOpacity style={s.drawerFooterPrimary} onPress={navigate} activeOpacity={0.85}>
            <Text style={s.drawerFooterPrimaryText}>{ctaLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {item.status !== 'RESOLVED' ? (
          <TouchableOpacity style={s.drawerFooterSecondary} onPress={onMarkResolved} activeOpacity={0.85}>
            <CheckCircle size={14} color="#374151" />
            <Text style={s.drawerFooterSecondaryText}>Mark as Resolved</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ActionCenterScreen() {
  const router = useRouter();
  const { isDesktop, isMobile } = useBreakpoint();
  const {
    actions, isLoading,
    needsReviewCount, customerRequestsCount,
    productionIssuesCount, systemAlertsCount,
    markViewed, markResolved, markAllRead, refetch,
  } = useActions();

  const newCount = useMemo(() => actions.filter(a => a.status === 'NEW').length, [actions]);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ActionItemWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const filtered = useMemo(() => {
    let items = [...actions];
    if (filter === 'new')     items = items.filter(a => a.status === 'NEW');
    else if (filter === 'viewed')   items = items.filter(a => a.status === 'VIEWED');
    else if (filter === 'resolved') items = items.filter(a => a.status === 'RESOLVED');
    else if (filter !== 'all') items = items.filter(a => ACTION_CATEGORY[a.type] === filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.organizationName ?? '').toLowerCase().includes(q) ||
        (a.projectTitle ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [actions, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const setFilterAndReset = useCallback((f: FilterKey) => {
    setFilter(f); setPage(1); setSearch('');
  }, []);

  const openItem = useCallback((item: ActionItemWithContext) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    if (item.status === 'NEW') markViewed(item.id);
  }, [markViewed]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedItem(null);
  }, []);

  const handleMarkResolved = useCallback(() => {
    if (selectedItem) { markResolved(selectedItem.id); closeDrawer(); }
  }, [selectedItem, markResolved, closeDrawer]);

  const navigate = useCallback((item: ActionItemWithContext) => {
    if (item.projectId) router.push(`/quote/${item.projectId}` as any);
    else if (item.organizationId) router.push(`/crm/${item.organizationId}` as any);
  }, [router]);

  const FILTERS: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all',               label: 'All' },
    { key: 'new',               label: 'New',                count: newCount },
    { key: 'NEEDS_REVIEW',      label: 'Needs Review',       count: needsReviewCount },
    { key: 'CUSTOMER_REQUESTS', label: 'Customer Requests',  count: customerRequestsCount },
    { key: 'PRODUCTION_ISSUES', label: 'Production Issues',  count: productionIssuesCount },
    { key: 'SYSTEM_ALERTS',     label: 'System Alerts',      count: systemAlertsCount },
    { key: 'resolved',          label: 'Resolved' },
  ];

  const STAT_CATS: ActionCategory[] = ['NEEDS_REVIEW', 'CUSTOMER_REQUESTS', 'PRODUCTION_ISSUES', 'SYSTEM_ALERTS'];
  const catCounts: Record<ActionCategory, number> = {
    NEEDS_REVIEW:      needsReviewCount,
    CUSTOMER_REQUESTS: customerRequestsCount,
    PRODUCTION_ISSUES: productionIssuesCount,
    SYSTEM_ALERTS:     systemAlertsCount,
  };

  const showSplit = isDesktop && drawerOpen;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* PAGE HEADER */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Action Center</Text>
        <View style={s.headerRight}>
          <View style={s.searchWrap}>
            <Search size={13} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="Search actions…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={v => { setSearch(v); setPage(1); }}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={12} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          {!isMobile && (
            <TouchableOpacity
              style={[s.headerBtn, showFiltersPanel && s.headerBtnActive]}
              onPress={() => setShowFiltersPanel(v => !v)}
              activeOpacity={0.8}
            >
              <SlidersHorizontal size={14} color={showFiltersPanel ? BRAND : '#374151'} />
              <Text style={[s.headerBtnText, showFiltersPanel && { color: BRAND }]}>Filters</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.markAllBtn}
            onPress={() => markAllRead()}
            activeOpacity={0.85}
          >
            <Text style={s.markAllText}>{isMobile ? 'Mark read' : 'Mark all as read'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={refetch} style={s.refreshBtn} activeOpacity={0.7}>
            <RefreshCw size={15} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* STAT CARDS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.statsRow}
      >
        {STAT_CATS.map(cat => (
          <StatCard
            key={cat}
            category={cat}
            count={catCounts[cat]}
            active={filter === cat}
            onPress={() => setFilterAndReset(filter === cat ? 'all' : cat)}
          />
        ))}
      </ScrollView>

      {/* FILTER PILLS */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterPills}>
          {FILTERS.map(({ key, label, count }) => (
            <TouchableOpacity
              key={key}
              style={[s.pill, filter === key && s.pillActive]}
              onPress={() => setFilterAndReset(filter === key && key !== 'all' ? 'all' : key)}
              activeOpacity={0.8}
            >
              <Text style={[s.pillText, filter === key && s.pillTextActive]}>{label}</Text>
              {count != null && count > 0 ? (
                <View style={[s.pillBadge, filter === key && s.pillBadgeActive]}>
                  <Text style={[s.pillBadgeText, filter === key && s.pillBadgeTextActive]}>{count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* MAIN AREA */}
      <View style={[s.mainArea, showSplit && { flexDirection: 'row' }]}>

        {/* TABLE */}
        <View style={[s.tableWrap, showSplit && { flex: 1, minWidth: 0 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: isMobile ? 640 : 720 }}>

              {/* Table header */}
              <View style={s.tableHead}>
                <Text style={[s.th, { width: 90 }]}>PRIORITY</Text>
                <Text style={[s.th, { width: 160 }]}>TYPE</Text>
                <Text style={[s.th, { flex: 1, minWidth: 180 }]}>DETAILS</Text>
                <Text style={[s.th, { width: 80 }]}>TIME</Text>
                <Text style={[s.th, { width: 130 }]}>ACTIONS</Text>
              </View>

              {/* Rows */}
              <ScrollView style={s.tableBody} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                  <View style={s.empty}>
                    <ActivityIndicator color={BRAND} />
                  </View>
                ) : pageItems.length === 0 ? (
                  <View style={s.empty}>
                    <Text style={s.emptyText}>
                      {search || filter !== 'all' ? 'No items match your filters.' : "You're all caught up!"}
                    </Text>
                  </View>
                ) : (
                  pageItems.map((item, idx) => {
                    const isSelected = selectedItem?.id === item.id;
                    const category = ACTION_CATEGORY[item.type];
                    const ctaLabel = ctaFor(item);
                    const isResolved = item.status === 'RESOLVED';
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          s.row,
                          idx % 2 === 1 && s.rowAlt,
                          isSelected && s.rowSelected,
                          isResolved && s.rowResolved,
                        ]}
                        onPress={() => openItem(item)}
                        activeOpacity={0.75}
                      >
                        {/* PRIORITY */}
                        <View style={[s.td, { width: 90 }]}>
                          <PriorityDot priority={item.priority} />
                        </View>

                        {/* TYPE */}
                        <View style={[s.td, { width: 160, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                          <Text style={s.tdPrimary} numberOfLines={1}>{ACTION_TYPE_LABEL[item.type]}</Text>
                          <Text style={s.tdSub} numberOfLines={1}>{ACTION_CATEGORY_LABEL[category]}</Text>
                        </View>

                        {/* DETAILS */}
                        <View style={[s.td, { flex: 1, minWidth: 180, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                          {item.organizationName ? (
                            <Text style={s.tdPrimary} numberOfLines={1}>{item.organizationName}</Text>
                          ) : null}
                          {item.projectTitle ? (
                            <Text style={s.tdSub} numberOfLines={1}>{item.projectTitle}</Text>
                          ) : (
                            <Text style={s.tdSub} numberOfLines={1}>{item.description ?? '—'}</Text>
                          )}
                        </View>

                        {/* TIME */}
                        <View style={[s.td, { width: 80, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
                          <Text style={s.tdPrimary}>{relTime(item.createdAt)}</Text>
                          <Text style={s.tdSub}>{calDate(item.createdAt)}</Text>
                        </View>

                        {/* ACTIONS */}
                        <View style={[s.td, { width: 130, gap: 4 }]}>
                          {(item.projectId || item.organizationId) && !isResolved ? (
                            <TouchableOpacity
                              style={s.ctaBtn}
                              onPress={(e) => { e.stopPropagation?.(); navigate(item); }}
                              activeOpacity={0.8}
                            >
                              <Text style={s.ctaBtnText} numberOfLines={1}>{ctaLabel}</Text>
                            </TouchableOpacity>
                          ) : null}
                          <OverlayMenu
                            menuWidth={180}
                            align="right"
                            trigger={({ open }) => (
                              <TouchableOpacity
                                onPress={(e) => { e.stopPropagation?.(); open(); }}
                                style={s.dotsBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={s.dotsBtnText}>•••</Text>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                <TouchableOpacity style={s.menuItem} onPress={() => { close(); openItem(item); }}>
                                  <Eye size={13} color="#374151" />
                                  <Text style={s.menuItemText}>View Details</Text>
                                </TouchableOpacity>
                                {(item.projectId || item.organizationId) ? (
                                  <TouchableOpacity style={s.menuItem} onPress={() => { close(); navigate(item); }}>
                                    <ExternalLink size={13} color="#374151" />
                                    <Text style={s.menuItemText}>{ctaFor(item)}</Text>
                                  </TouchableOpacity>
                                ) : null}
                                {item.status === 'NEW' ? (
                                  <TouchableOpacity style={s.menuItem} onPress={() => { close(); markViewed(item.id); }}>
                                    <Eye size={13} color="#374151" />
                                    <Text style={s.menuItemText}>Mark Viewed</Text>
                                  </TouchableOpacity>
                                ) : null}
                                {!isResolved ? (
                                  <TouchableOpacity style={s.menuItem} onPress={() => { close(); markResolved(item.id); }}>
                                    <CheckCircle size={13} color="#16A34A" />
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
          </ScrollView>

          {/* PAGINATION */}
          {filtered.length > 0 && (
            <View style={s.pagination}>
              <Text style={s.paginationInfo}>
                Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} action{filtered.length !== 1 ? 's' : ''}
              </Text>
              <View style={s.paginationBtns}>
                <TouchableOpacity
                  style={[s.pageBtn, safePage === 1 && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft size={14} color={safePage === 1 ? '#D1D5DB' : '#374151'} />
                </TouchableOpacity>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pg = totalPages <= 5 ? i + 1
                    : safePage <= 3 ? i + 1
                    : safePage >= totalPages - 2 ? totalPages - 4 + i
                    : safePage - 2 + i;
                  return (
                    <TouchableOpacity
                      key={pg}
                      style={[s.pageBtn, safePage === pg && s.pageBtnActive]}
                      onPress={() => setPage(pg)}
                    >
                      <Text style={[s.pageBtnText, safePage === pg && s.pageBtnTextActive]}>{pg}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[s.pageBtn, safePage === totalPages && s.pageBtnDisabled]}
                  onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight size={14} color={safePage === totalPages ? '#D1D5DB' : '#374151'} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* DESKTOP SPLIT DRAWER */}
        {showSplit && selectedItem ? (
          <View style={s.splitDrawer}>
            <DrawerPanel
              item={selectedItem}
              onClose={closeDrawer}
              onMarkResolved={handleMarkResolved}
            />
          </View>
        ) : null}
      </View>

      {/* MOBILE DRAWER MODAL */}
      {!isDesktop && (
        <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={closeDrawer}>
          <Pressable style={s.overlay} onPress={closeDrawer} />
          <View style={s.bottomSheet}>
            {selectedItem ? (
              <DrawerPanel
                item={selectedItem}
                onClose={closeDrawer}
                onMarkResolved={handleMarkResolved}
              />
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 10, flexWrap: 'wrap',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginRight: 4 },
  headerRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 10, height: 34, minWidth: 150, maxWidth: 240, flex: 1,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#111', outlineStyle: 'none' as any },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 10, height: 34, backgroundColor: '#fff',
  },
  headerBtnActive: { borderColor: BRAND, backgroundColor: '#FFF7ED' },
  headerBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  markAllBtn: { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 12, height: 34, justifyContent: 'center' },
  markAllText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  refreshBtn: { padding: 6 },

  // Stat cards
  statsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  statCard: {
    width: 165, borderRadius: 10, borderWidth: 1,
    overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  statIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    margin: 12, marginBottom: 6,
  },
  statBody: { paddingHorizontal: 12, paddingBottom: 12 },
  statCount: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  statLabel: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 1 },
  statBar: { height: 3 },

  // Filter pills
  filterBar: {
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  filterPills: { paddingHorizontal: 16, gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  pillTextActive: { color: '#fff' },
  pillBadge: {
    backgroundColor: '#E5E7EB', borderRadius: 8,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  pillBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  pillBadgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  pillBadgeTextActive: { color: '#fff' },

  // Main area
  mainArea: { flex: 1 },
  tableWrap: { flex: 1 },

  // Table
  tableHead: {
    flexDirection: 'row', backgroundColor: '#111',
    paddingHorizontal: 14, paddingVertical: 9,
  },
  th: {
    fontSize: 10, fontWeight: '700', color: '#fff',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tableBody: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 52,
  },
  rowAlt: { backgroundColor: '#FAFAFA' },
  rowSelected: { backgroundColor: '#FFF7ED' },
  rowResolved: { opacity: 0.5 },
  td: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  tdPrimary: { fontSize: 13, fontWeight: '600', color: '#111' },
  tdSub: { fontSize: 11, color: '#6B7280' },

  // Priority
  priDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  priText: { fontSize: 12, fontWeight: '600' },

  // Row CTA
  ctaBtn: {
    borderWidth: 1, borderColor: BRAND, borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center',
  },
  ctaBtnText: { fontSize: 11, fontWeight: '700', color: BRAND },
  dotsBtn: {
    width: 28, height: 26, alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, backgroundColor: '#F3F4F6',
  },
  dotsBtnText: { fontSize: 8, color: '#374151', letterSpacing: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { fontSize: 13, color: '#374151' },

  // Pagination
  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  paginationInfo: { fontSize: 12, color: '#6B7280' },
  paginationBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB',
  },
  pageBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  pageBtnTextActive: { color: '#fff' },

  // Empty state
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  // Split drawer (desktop)
  splitDrawer: {
    width: 380, borderLeftWidth: 1, borderLeftColor: '#E5E7EB',
  },

  // Mobile modal
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '90%', backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden',
  },

  // Drawer
  drawer: { flex: 1, backgroundColor: '#fff' },
  drawerHead: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  drawerIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  drawerTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  drawerTitle: { fontSize: 15, fontWeight: '700', color: '#111', flex: 1 },
  priBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0,
  },
  priBadgeText: { fontSize: 10, fontWeight: '700' },
  drawerBreadcrumb: { fontSize: 11, color: '#6B7280' },
  drawerScroll: { flex: 1 },
  drawerSection: { marginTop: 1 },
  drawerSecHead: {
    backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 7,
  },
  drawerSecTitle: {
    fontSize: 10, fontWeight: '700', color: '#fff',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  drawerSecBody: { padding: 14, gap: 10 },
  drawerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  drawerRowLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  drawerRowValue: { fontSize: 13, color: '#111', fontWeight: '500' },
  drawerCommentText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  drawerFooter: {
    flexDirection: 'row', gap: 8, padding: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB', flexWrap: 'wrap',
  },
  drawerFooterPrimary: {
    flex: 1, backgroundColor: BRAND, borderRadius: 8, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  drawerFooterPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  drawerFooterSecondary: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, height: 40,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    backgroundColor: '#fff',
  },
  drawerFooterSecondaryText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Attachment link
  relatedLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  relatedLinkTitle: { fontSize: 13, fontWeight: '600', color: '#111' },
});
