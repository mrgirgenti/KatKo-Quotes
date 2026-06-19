import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import {
  LayoutGrid,
  List,
  CalendarDays,
  BarChart3,
  Check,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useQuotes } from '@/contexts/QuotesContext';
import { useUser } from '@/contexts/UserContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProductionFilterBar } from '@/components/production/ProductionFilterBar';
import type { SavedViewItem } from '@/components/production/ProductionFilterBar';
import { ProductionBoard } from '@/components/production/ProductionBoard';
import { ProductionQueue } from '@/components/production/ProductionQueue';
import {
  EMPTY_FILTERS,
  filterProjects,
  sortProjects,
  buildDefaultViews,
} from '@/lib/production';
import type { ProductionFilters, SortField, SortDir, BuiltInView } from '@/lib/production';
import { useProductionViews } from '@/hooks/useProductionViews';
import type { ProductionViewType, ProductionView } from '@/hooks/useProductionViews';
import type { OperationalProjectStatus, ProjectPriority } from '@/types/quote';

type TabKey = 'board' | 'queue' | 'calendar' | 'analytics';

const TABS: { key: TabKey; label: string; Icon: any; soon?: boolean }[] = [
  { key: 'board', label: 'Board', Icon: LayoutGrid },
  { key: 'queue', label: 'Queue', Icon: List },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays, soon: true },
  { key: 'analytics', label: 'Analytics', Icon: BarChart3, soon: true },
];

const TAB_LABELS: Record<TabKey, string> = {
  board: 'Board',
  queue: 'Queue',
  calendar: 'Calendar',
  analytics: 'Analytics',
};

export default function ProductionScreen() {
  const { productionProjects, setOperationalStatus, setPriority, setAssignee } = useQuotes();
  const { users, currentUserId } = useUser();
  const { views, defaultViewId, loaded, saveView, deleteView, setDefaultView } = useProductionViews();

  const [tab, setTab] = useState<TabKey>('board');
  const [filters, setFilters] = useState<ProductionFilters>(EMPTY_FILTERS);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [appliedDefault, setAppliedDefault] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductionView | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Built-in presets always available, merged with user-saved custom views.
  const builtInViews = useMemo(() => buildDefaultViews(currentUserId ?? null), [currentUserId]);
  const allViews = useMemo<(ProductionView | BuiltInView)[]>(() => [...builtInViews, ...views], [builtInViews, views]);
  const viewItems = useMemo<SavedViewItem[]>(
    () => allViews.map((v) => ({ id: v.id, name: v.name, builtIn: 'builtIn' in v && v.builtIn })),
    [allViews],
  );
  const resolvedDefault = useMemo(
    () => allViews.find((v) => v.id === defaultViewId) ?? null,
    [allViews, defaultViewId],
  );

  const applyView = useCallback((v: ProductionView | BuiltInView) => {
    setTab(v.view);
    setFilters(v.filters);
    setSortField(v.sortField);
    setSortDir(v.sortDir);
  }, []);

  const applyViewById = useCallback((id: string) => {
    const v = allViews.find((x) => x.id === id);
    if (v) applyView(v);
  }, [allViews, applyView]);

  // Apply the remembered default view once on load.
  useEffect(() => {
    if (loaded && !appliedDefault) {
      if (resolvedDefault) applyView(resolvedDefault);
      setAppliedDefault(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, appliedDefault, resolvedDefault]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const visibleProjects = useMemo(() => {
    const filtered = filterProjects(productionProjects, filters);
    return sortProjects(filtered, sortField, sortDir);
  }, [productionProjects, filters, sortField, sortDir]);

  const activeFilterCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.priority !== 'all' ? 1 : 0) +
    (filters.assignee !== 'all' ? 1 : 0) +
    (filters.serviceType !== 'all' ? 1 : 0) +
    (filters.delivery !== 'all' ? 1 : 0) +
    (filters.due !== 'all' ? 1 : 0) +
    (filters.rush ? 1 : 0);

  // Bulk selection (Queue). Selection is derived from / clamped to the full
  // visible dataset so it stays valid as filters change.
  const visibleIds = useMemo(() => visibleProjects.map((q) => q.id), [visibleProjects]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  const toggleSelect = useCallback((quoteId: string) => {
    setSelectedIds((prev) => (prev.includes(quoteId) ? prev.filter((id) => id !== quoteId) : [...prev, quoteId]));
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === visibleIds.length ? [] : [...visibleIds]));
  }, [visibleIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const bulkSetStatus = useCallback((status: OperationalProjectStatus) => {
    selectedIds.forEach((quoteId) => setOperationalStatus({ quoteId, status }));
    setSelectedIds([]);
  }, [selectedIds, setOperationalStatus]);

  const handleSaveView = () => {
    const name = newViewName.trim();
    if (!name) return;
    saveView({ name, view: tab, filters, sortField, sortDir });
    setNewViewName('');
    setSaveDialogOpen(false);
  };

  // Stats for the header.
  const stats = useMemo(() => {
    const all = productionProjects;
    return {
      total: all.length,
      inProduction: all.filter((q) => q.operationalStatus === 'In Production').length,
      onHold: all.filter((q) => q.operationalStatus === 'On Hold').length,
      completed: all.filter((q) => ['Completed', 'Delivered', 'Closed'].includes(q.operationalStatus || '')).length,
    };
  }, [productionProjects]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Production</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <Stat value={stats.total} label="In Workflow" color={Colors.light.text} />
          <View style={styles.statDivider} />
          <Stat value={stats.inProduction} label="Production" color={Colors.light.tint} />
          <View style={styles.statDivider} />
          <Stat value={stats.onHold} label="On Hold" color="#DC2626" />
          <View style={styles.statDivider} />
          <Stat value={stats.completed} label="Completed" color="#16A34A" />
        </View>

        {/* View tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map(({ key, label, Icon, soon }) => {
            const active = tab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(key)}
              >
                <Icon size={15} color={active ? Colors.light.tint : Colors.light.textSecondary} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                {soon ? (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>SOON</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {(tab === 'board' || tab === 'queue') ? (
          <ProductionFilterBar
            filters={filters}
            onChange={setFilters}
            users={users}
            views={viewItems}
            defaultViewId={defaultViewId}
            onApplyView={applyViewById}
            onSetDefault={setDefaultView}
            onDeleteView={(id) => {
              const v = views.find((x) => x.id === id);
              if (v) setDeleteTarget(v);
            }}
            onSaveView={() => setSaveDialogOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        ) : null}
      </View>

      {tab === 'board' ? (
        <ProductionBoard
          projects={visibleProjects}
          users={users}
          onSetStatus={(quoteId, status: OperationalProjectStatus) => setOperationalStatus({ quoteId, status })}
          onSetPriority={(quoteId, priority: ProjectPriority) => setPriority({ quoteId, priority })}
        />
      ) : tab === 'queue' ? (
        <ProductionQueue
          projects={visibleProjects}
          users={users}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkSetStatus={bulkSetStatus}
          onClearSelection={clearSelection}
          onSetStatus={(quoteId, status) => setOperationalStatus({ quoteId, status })}
          onSetPriority={(quoteId, priority) => setPriority({ quoteId, priority })}
          onSetAssignee={(quoteId, assignedToUserId) => setAssignee({ quoteId, assignedToUserId })}
        />
      ) : (
        <ComingSoon tab={tab} />
      )}

      {/* Save view dialog */}
      {saveDialogOpen ? (
        <SaveViewDialog
          name={newViewName}
          onChangeName={setNewViewName}
          onCancel={() => { setSaveDialogOpen(false); setNewViewName(''); }}
          onSave={handleSaveView}
          viewType={TAB_LABELS[tab]}
          filterCount={activeFilterCount}
        />
      ) : null}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete saved view?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" from your saved views?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        confirmDestructive
        onConfirm={() => { if (deleteTarget) deleteView(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SaveViewDialog({
  name,
  onChangeName,
  onCancel,
  onSave,
  viewType,
  filterCount,
}: {
  name: string;
  onChangeName: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  viewType: string;
  filterCount: number;
}) {
  return (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialogCard}>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>Save View</Text>
          <TouchableOpacity onPress={onCancel}><X size={20} color={Colors.light.textSecondary} /></TouchableOpacity>
        </View>
        <Text style={styles.dialogHint}>
          Saves the current {viewType} layout with {filterCount} active filter{filterCount !== 1 ? 's' : ''}, search and sort.
        </Text>
        <TextInput
          style={styles.dialogInput}
          placeholder="View name (e.g. Rush jobs this week)"
          placeholderTextColor={Colors.light.textSecondary}
          value={name}
          onChangeText={onChangeName}
          autoFocus
          onSubmitEditing={onSave}
        />
        <View style={styles.dialogActions}>
          <TouchableOpacity style={styles.dialogCancel} onPress={onCancel}>
            <Text style={styles.dialogCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dialogSave, !name.trim() && { opacity: 0.5 }]} onPress={onSave} disabled={!name.trim()}>
            <Check size={15} color="#fff" />
            <Text style={styles.dialogSaveText}>Save View</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ComingSoon({ tab }: { tab: TabKey }) {
  const isCalendar = tab === 'calendar';
  const Icon = isCalendar ? CalendarDays : BarChart3;
  return (
    <View style={styles.comingSoon}>
      <View style={styles.comingSoonIcon}>
        <Icon size={40} color={Colors.light.tint} />
      </View>
      <Text style={styles.comingSoonTitle}>{isCalendar ? 'Production Calendar' : 'Production Analytics'}</Text>
      <Text style={styles.comingSoonText}>
        {isCalendar
          ? 'A scheduling calendar that plots projects by due date and capacity is on the way.'
          : 'Throughput, cycle-time and bottleneck analytics for your production pipeline are coming next.'}
      </Text>
      <View style={styles.comingSoonPill}>
        <Text style={styles.comingSoonPillText}>COMING SOON</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingTop: Platform.OS === 'web' ? 0 : 48 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.xl, paddingBottom: DS.spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: Colors.light.text },

  viewsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: DS.radius.md, borderWidth: 1.5, borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  viewsBtnText: { fontSize: 14, fontWeight: '700', color: Colors.light.tint },

  statsBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: DS.spacing.lg, marginBottom: DS.spacing.md, backgroundColor: '#FAFAFA', borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingVertical: 12, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  statLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },

  tabsRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  tabActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  tabTextActive: { color: Colors.light.tint },
  soonBadge: { backgroundColor: '#E5E7EB', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  soonBadgeText: { fontSize: 8, fontWeight: '800', color: Colors.light.textSecondary, letterSpacing: 0.5 },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11 },
  menuItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.light.text },
  menuDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  menuEmpty: { fontSize: 12, color: Colors.light.textSecondary, paddingHorizontal: 12, paddingVertical: 10 },
  viewItemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, gap: 6 },
  viewItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, gap: 8 },
  viewItemMeta: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },
  viewItemIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  dialogOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogCard: { width: '100%', maxWidth: 420, backgroundColor: Colors.light.surface, borderRadius: DS.radius.xxl, padding: 20, gap: 12 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.text },
  dialogHint: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  dialogInput: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.light.text, backgroundColor: Colors.light.background, outlineStyle: 'none' as any },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  dialogCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border },
  dialogCancelText: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },
  dialogSave: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: DS.radius.md, backgroundColor: Colors.light.tint },
  dialogSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  comingSoon: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  comingSoonIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF4EE', alignItems: 'center', justifyContent: 'center' },
  comingSoonTitle: { fontSize: 20, fontWeight: '800', color: Colors.light.text },
  comingSoonText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 420 },
  comingSoonPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E5E7EB', marginTop: 4 },
  comingSoonPillText: { fontSize: 11, fontWeight: '800', color: Colors.light.textSecondary, letterSpacing: 0.6 },
});
