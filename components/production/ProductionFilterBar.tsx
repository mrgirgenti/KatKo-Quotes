import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Search, X, SlidersHorizontal, Bookmark, ChevronDown, Star, Trash2, Check, Flame } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { OPERATIONAL_STATUSES, PROJECT_PRIORITIES, PRIORITY_CONFIG, OPERATIONAL_STATUS_CONFIG, SERVICE_STYLES, DELIVERY_METHODS } from '@/types/quote';
import type { ProductionFilters } from '@/lib/production';
import { DUE_RANGE_OPTIONS, EMPTY_FILTERS } from '@/lib/production';
import type { UserProfile } from '@/types/user';
import OverlayMenu from '@/components/OverlayMenu';

export interface SavedViewItem {
  id: string;
  name: string;
  builtIn?: boolean;
}

interface Props {
  filters: ProductionFilters;
  onChange: (next: ProductionFilters) => void;
  users: UserProfile[];
  views: SavedViewItem[];
  defaultViewId: string | null;
  onApplyView: (id: string) => void;
  onSetDefault: (id: string | null) => void;
  onDeleteView: (id: string) => void;
  onSaveView: () => void;
  activeFilterCount: number;
}

export function ProductionFilterBar({
  filters,
  onChange,
  users,
  views,
  defaultViewId,
  onApplyView,
  onSetDefault,
  onDeleteView,
  onSaveView,
  activeFilterCount,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const set = (patch: Partial<ProductionFilters>) => onChange({ ...filters, ...patch });

  const dueLabel = (k: string) => DUE_RANGE_OPTIONS.find((o) => o.key === k)?.label || k;
  const assigneeLabel = (id: string) => {
    if (id === 'unassigned') return 'Unassigned';
    return users.find((u) => u.id === id)?.name || 'Assigned';
  };

  // Build active filter chips from non-default dimensions.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.rush) activeChips.push({ key: 'rush', label: 'Rush', clear: () => set({ rush: false }) });
  if (filters.priority !== 'all') activeChips.push({ key: 'priority', label: filters.priority, clear: () => set({ priority: 'all' }) });
  if (filters.status !== 'all') activeChips.push({ key: 'status', label: filters.status, clear: () => set({ status: 'all' }) });
  if (filters.assignee !== 'all') activeChips.push({ key: 'assignee', label: assigneeLabel(filters.assignee), clear: () => set({ assignee: 'all' }) });
  if (filters.serviceType !== 'all') activeChips.push({ key: 'serviceType', label: filters.serviceType, clear: () => set({ serviceType: 'all' }) });
  if (filters.delivery !== 'all') activeChips.push({ key: 'delivery', label: filters.delivery, clear: () => set({ delivery: 'all' }) });
  if (filters.due !== 'all') activeChips.push({ key: 'due', label: dueLabel(filters.due), clear: () => set({ due: 'all' }) });

  const clearAll = () => onChange({ ...EMPTY_FILTERS, search: filters.search });

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Search size={15} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects, clients, project #…"
            placeholderTextColor={Colors.light.textSecondary}
            value={filters.search}
            onFocus={() => setPanelOpen(true)}
            onChangeText={(v) => set({ search: v })}
          />
          {filters.search ? (
            <TouchableOpacity onPress={() => set({ search: '' })}>
              <X size={15} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.toolBtn, (panelOpen || activeFilterCount > 0) && styles.toolBtnActive]}
          onPress={() => setPanelOpen((v) => !v)}
        >
          <SlidersHorizontal size={15} color={activeFilterCount > 0 ? Colors.light.tint : Colors.light.textSecondary} />
          <Text style={[styles.toolBtnText, activeFilterCount > 0 && styles.toolBtnTextActive]}>Filters</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeFilterCount}</Text></View>
          ) : null}
          <ChevronDown size={14} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <SavedViewsMenu
          views={views}
          defaultViewId={defaultViewId}
          onApply={onApplyView}
          onSetDefault={onSetDefault}
          onDelete={onDeleteView}
          onSaveCurrent={onSaveView}
        />
      </View>

      {/* Active filter chips */}
      {activeChips.length > 0 ? (
        <View style={styles.activeRow}>
          {activeChips.map((c) => (
            <TouchableOpacity key={c.key} style={styles.activeChip} onPress={c.clear}>
              <Text style={styles.activeChipText}>{c.label}</Text>
              <X size={12} color={Colors.light.tint} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearAllBtn} onPress={clearAll}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Filter panel */}
      {panelOpen ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Filters</Text>
            <View style={styles.panelHeaderActions}>
              {activeFilterCount > 0 ? (
                <TouchableOpacity style={styles.panelClearBtn} onPress={clearAll}>
                  <Text style={styles.panelClearText}>Clear all</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.panelDoneBtn} onPress={() => setPanelOpen(false)}>
                <Text style={styles.panelDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
            {/* Rush quick toggle */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>Service Level</Text>
              <View style={styles.chipWrap}>
                <TouchableOpacity
                  style={[styles.rushChip, filters.rush && styles.rushChipActive]}
                  onPress={() => set({ rush: !filters.rush })}
                >
                  <Flame size={13} color={filters.rush ? '#DC2626' : Colors.light.textSecondary} />
                  <Text style={[styles.rushChipText, filters.rush && styles.rushChipTextActive]}>Rush Orders</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Group label="Priority">
              <Chip label="All" active={filters.priority === 'all'} onPress={() => set({ priority: 'all' })} />
              {PROJECT_PRIORITIES.map((p) => (
                <Chip key={p} label={p} active={filters.priority === p} activeColor={PRIORITY_CONFIG[p].bg} activeTextColor={PRIORITY_CONFIG[p].color} onPress={() => set({ priority: p })} />
              ))}
            </Group>

            <Group label="Status">
              <Chip label="All" active={filters.status === 'all'} onPress={() => set({ status: 'all' })} />
              {OPERATIONAL_STATUSES.map((s) => (
                <Chip key={s} label={s} active={filters.status === s} activeColor={OPERATIONAL_STATUS_CONFIG[s].bg} activeTextColor={OPERATIONAL_STATUS_CONFIG[s].color} onPress={() => set({ status: s })} />
              ))}
            </Group>

            <Group label="Assignee">
              <Chip label="All" active={filters.assignee === 'all'} onPress={() => set({ assignee: 'all' })} />
              <Chip label="Unassigned" active={filters.assignee === 'unassigned'} onPress={() => set({ assignee: 'unassigned' })} />
              {users.map((u) => (
                <Chip key={u.id} label={u.name} active={filters.assignee === u.id} onPress={() => set({ assignee: u.id })} />
              ))}
            </Group>

            <Group label="Service">
              <Chip label="All" active={filters.serviceType === 'all'} onPress={() => set({ serviceType: 'all' })} />
              {SERVICE_STYLES.map((s) => (
                <Chip key={s} label={s} active={filters.serviceType === s} onPress={() => set({ serviceType: s })} />
              ))}
            </Group>

            <Group label="Delivery">
              <Chip label="All" active={filters.delivery === 'all'} onPress={() => set({ delivery: 'all' })} />
              {DELIVERY_METHODS.map((m) => (
                <Chip key={m} label={m} active={filters.delivery === m} onPress={() => set({ delivery: m })} />
              ))}
            </Group>

            <Group label="Due Date">
              {DUE_RANGE_OPTIONS.map((o) => (
                <Chip key={o.key} label={o.label} active={filters.due === o.key} onPress={() => set({ due: o.key })} />
              ))}
            </Group>

            <TouchableOpacity style={styles.saveViewBtn} onPress={() => { setPanelOpen(false); onSaveView(); }}>
              <Bookmark size={14} color={Colors.light.tint} />
              <Text style={styles.saveViewText}>Save as view</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function SavedViewsMenu({
  views,
  defaultViewId,
  onApply,
  onSetDefault,
  onDelete,
  onSaveCurrent,
}: {
  views: SavedViewItem[];
  defaultViewId: string | null;
  onApply: (id: string) => void;
  onSetDefault: (id: string | null) => void;
  onDelete: (id: string) => void;
  onSaveCurrent: () => void;
}) {
  return (
    <OverlayMenu
      menuWidth={260}
      align="right"
      trigger={({ open }) => (
        <TouchableOpacity style={styles.toolBtn} onPress={open}>
          <Bookmark size={15} color={Colors.light.textSecondary} />
          <Text style={styles.toolBtnText}>Views</Text>
          <ChevronDown size={14} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <View>
          {views.map((v) => {
            const isDefault = defaultViewId === v.id;
            return (
              <View key={v.id} style={styles.viewItemRow}>
                <TouchableOpacity style={styles.viewItemMain} onPress={() => { close(); onApply(v.id); }}>
                  <Text style={styles.viewItemName} numberOfLines={1}>{v.name}</Text>
                  {v.builtIn ? <Text style={styles.viewItemMeta}>Default</Text> : null}
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewItemIcon} onPress={() => onSetDefault(isDefault ? null : v.id)}>
                  <Star size={15} color={isDefault ? '#F59E0B' : '#D1D5DB'} fill={isDefault ? '#F59E0B' : 'transparent'} />
                </TouchableOpacity>
                {!v.builtIn ? (
                  <TouchableOpacity style={styles.viewItemIcon} onPress={() => { close(); onDelete(v.id); }}>
                    <Trash2 size={15} color="#DC2626" />
                  </TouchableOpacity>
                ) : <View style={styles.viewItemIcon} />}
              </View>
            );
          })}
          <TouchableOpacity style={styles.viewSaveRow} onPress={() => { close(); onSaveCurrent(); }}>
            <Check size={14} color={Colors.light.tint} />
            <Text style={styles.viewSaveText}>Save current as view…</Text>
          </TouchableOpacity>
        </View>
      )}
    </OverlayMenu>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function Chip({ label, active, onPress, activeColor, activeTextColor }: { label: string; active: boolean; onPress: () => void; activeColor?: string; activeTextColor?: string }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : null]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, active && activeTextColor ? { color: activeTextColor } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.sm, gap: 8 },
  toolbar: { flexDirection: 'row', gap: DS.spacing.sm, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },

  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface },
  toolBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  toolBtnText: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },
  toolBtnTextActive: { color: Colors.light.tint },
  countBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: Colors.light.tint, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  activeChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },
  clearAllBtn: { paddingHorizontal: 8, paddingVertical: 5 },
  clearAllText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary, textDecorationLine: 'underline' },

  panel: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, ...DS.shadow.small, maxHeight: 420 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  panelTitle: { fontSize: 14, fontWeight: '800', color: Colors.light.text },
  panelHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelClearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  panelClearText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  panelDoneBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint },
  panelDoneText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  panelBody: { paddingHorizontal: 16, paddingVertical: 8 },

  group: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  groupLabel: { fontSize: 11, fontWeight: '800', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  chipActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  chipTextActive: { color: Colors.light.tint },

  rushChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  rushChipActive: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  rushChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  rushChipTextActive: { color: '#DC2626' },

  saveViewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  saveViewText: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },

  viewItemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  viewItemMain: { flex: 1, paddingHorizontal: 8, paddingVertical: 10 },
  viewItemName: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  viewItemMeta: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', marginTop: 2 },
  viewItemIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  viewSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.light.border },
  viewSaveText: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },
});
